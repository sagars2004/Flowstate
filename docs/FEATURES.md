# Flowstate - Features Documentation

## Overview

Flowstate is organized into six major feature areas, each designed to work together to create a comprehensive productivity intelligence system. This document provides an overview of all features and their capabilities.

---

## Feature 1: Extension Monitoring System

**Purpose**: Passively capture behavioral metadata about user activity without recording actual content.

### Capabilities

#### Tab & URL Change Tracking
- Monitor when user switches between browser tabs
- Track which domains/sites are visited (sanitized, no query params)
- Record time spent on each tab/site
- Detect rapid context-switching patterns

**Privacy**: Only domain names stored (e.g., `github.com`), no full URLs with personal data

#### Typing Velocity Measurement
- Track frequency of keypress events (not actual keys pressed)
- Calculate characters per minute over rolling windows
- Detect changes in typing rhythm (fast = flow, slow = stuck)
- Identify typing bursts vs. pauses

**Privacy**: Only metadata captured (timing, frequency), never actual typed content

#### Idle State Detection
- Monitor periods of inactivity (no keyboard/mouse events)
- Differentiate between short breaks and extended idle time
- Detect return from idle state
- Track idle duration

**Thresholds**:
- Short idle: 30 seconds - 2 minutes (normal break)
- Extended idle: 2+ minutes (potential distraction or difficulty)

#### Active Window Monitoring
- Track when browser has/loses focus
- Detect switches to other applications
- Record time spent in browser vs. other apps

**Technical Implementation**:
- Chrome Tabs API: `chrome.tabs.onUpdated`, `chrome.tabs.onActivated`
- Chrome Idle API: `chrome.idle.onStateChanged`
- Content Scripts: Injected keypress listeners (metadata only)
- Service Worker: Coordinates all monitoring activities

---

## Feature 2: Backend API & Data Persistence

**Purpose**: Provide RESTful API for data management and local SQLite storage for all session data.

### Capabilities

#### Session Management Endpoints
- **POST /api/sessions/start**: Initialize new focus session
  - Returns session ID and start timestamp
  - Sets status to 'active'
  
- **POST /api/sessions/:id/end**: End active session
  - Updates end timestamp and status
  - Triggers focus score calculation
  - Initiates AI analysis
  
- **GET /api/sessions/:id**: Retrieve session details
  - Returns session metadata and calculated scores
  - Includes activity summary statistics
  
- **GET /api/sessions**: List all sessions
  - Supports filtering by date range, status
  - Pagination support
  - Sort by various fields (start time, focus score)

#### Activity Logging System
- **POST /api/activity**: Log single activity event
  - Real-time activity data ingestion
  - Validation of required fields
  
- **POST /api/activity/batch**: Log multiple activities at once
  - Bulk insertion for performance
  - Used by extension to batch events
  
- **GET /api/activity/session/:sessionId**: Retrieve all activities for session
  - Returns time-ordered activity stream
  - Used for analysis and visualization

#### SQLite Local Storage

**Database Schema**:

```sql
-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  focus_score REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Activity logs table
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  url TEXT,
  typing_velocity REAL,
  idle_duration INTEGER,
  metadata TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Insights table
CREATE TABLE insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  generated_at INTEGER NOT NULL,
  insights_json TEXT NOT NULL,
  recommendations_json TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX idx_sessions_start_time ON sessions(start_time);
CREATE INDEX idx_activities_session_id ON activity_logs(session_id);
CREATE INDEX idx_activities_timestamp ON activity_logs(timestamp);
```

#### Data Export Capabilities
- **GET /api/export/sessions**: Export sessions as JSON
- **GET /api/export/activities/:sessionId**: Export session activities
- **GET /api/export/full**: Export complete database
- **DELETE /api/sessions/:id**: Delete session and related data

**Privacy Feature**: User can export all data or delete specific sessions at any time

---

## Feature 3: Real-Time Communication Layer

**Purpose**: Enable bidirectional real-time communication between extension, backend, and frontend using WebSockets.

### Capabilities

#### Extension ↔ Backend WebSocket
- **Connection**: Extension service worker maintains persistent connection
- **Event Types**:
  - `activity:log` - Extension sends activity events to backend
  - `session:start` - Extension initiates session
  - `session:end` - Extension ends session
  - `intervention:received` - Backend sends intervention to extension
  - `connection:status` - Heartbeat and connection health

**Reconnection Logic**: Automatic reconnection with exponential backoff on disconnect

#### Frontend ↔ Backend WebSocket
- **Connection**: Frontend establishes connection when user opens dashboard
- **Event Types**:
  - `session:update` - Real-time session status updates
  - `activity:new` - New activity logged (for live view)
  - `focus:update` - Updated focus score calculation
  - `intervention:send` - AI intervention to display to user
  - `session:completed` - Session ended with final stats

#### Activity Data Streaming
- Low-latency event transmission (< 100ms typical)
- Batching of high-frequency events (typing) to reduce overhead
- Event prioritization (interventions > updates > logs)

#### Intervention Delivery
- Real-time push of AI-generated interventions
- Delivery to both extension (browser notification) and frontend (toast notification)
- Intervention acknowledgment tracking

**Technical Implementation**:
- Socket.io for WebSocket management
- Event-based architecture with typed event payloads
- Connection pooling and heartbeat monitoring
- Message queuing for offline scenarios

---

## Feature 4: AI Pattern Recognition & Interventions

**Purpose**: Analyze behavioral patterns in real-time and generate contextual interventions to help maintain focus.

### Capabilities

#### Context-Switching Detection

**Pattern**: Multiple tab switches in short time window

**Thresholds**:
- Moderate: 5-7 switches in 5 minutes
- High: 8+ switches in 5 minutes

**Intervention Examples**:
- "You've context-switched 8 times in 5 minutes—this usually means you're avoiding something hard. Want a hint or a break?"
- "Notice the rapid tab switching. Try closing tabs you don't need right now to reduce temptation."

#### Social Media Spiral Identification

**Pattern**: Repeated visits to known distracting sites

**Tracked Sites**:
- Social: twitter.com, facebook.com, instagram.com, reddit.com, tiktok.com
- Entertainment: youtube.com, netflix.com, twitch.tv
- News: news.ycombinator.com, reddit.com/r/all

**Thresholds**:
- Moderate: 3-4 visits to same site in 10 minutes
- High: 5+ visits to same site in 10 minutes

**Intervention Examples**:
- "You've opened Twitter 5 times in 8 minutes—take a 5-minute walk?"
- "Three trips to YouTube in the last 10 minutes. What task are you avoiding?"

#### Idle Period Analysis

**Pattern**: Extended periods with no keyboard/mouse activity

**Classification**:
- Short break: 30s - 2min (healthy)
- Potential stuck: 2-5 min (may need help)
- Extended idle: 5+ min (likely distracted or struggling)

**Intervention Examples**:
- "Been idle for 4 minutes. Stuck on a hard problem? Break it into smaller steps."
- "No activity for 5 minutes. Time for a quick stretch or water break?"

#### Typing Rhythm Patterns

**Pattern**: Changes in typing velocity indicating mental state

**Velocity Ranges**:
- Flow state: 150-250 CPM (consistent, sustained)
- Normal work: 80-150 CPM (variable, productive)
- Struggling: <80 CPM (slow, stop-start pattern)

**Intervention Examples**:
- "Your typing rhythm matches your best 'flow sessions'—you're on fire! 🔥"
- "Typing velocity dropped 40%. Grab a quick break or try a different approach?"

#### Real-Time Intervention Generation

**Process**:
1. Pattern detection engine identifies distraction pattern
2. Context builder gathers relevant session data
3. Groq Llama 3.1 8B Instant generates contextual message (< 1 second)
4. Intervention delivered via WebSocket to frontend/extension

**Intervention Frequency Limits**:
- Max 1 intervention per 10 minutes (avoid annoyance)
- Max 4 interventions per hour
- User can snooze interventions for 30 minutes

#### Contextual Messaging Strategy

**Tone Guidelines**:
- Supportive, not judgmental
- Specific to detected pattern
- Actionable suggestions
- Occasional humor (friendly, not sarcastic)
- Reference personal patterns when available

**Message Types**:
1. **Alert**: Notify of distraction pattern detected
2. **Question**: Prompt self-reflection ("What are you avoiding?")
3. **Suggestion**: Offer specific action ("Take 5-minute walk", "Close unused tabs")
4. **Encouragement**: Positive reinforcement for good focus

**Technical Implementation**:
- Pattern detection runs on every activity event
- Sliding window algorithms for time-based patterns
- Groq API integration with prompt templates
- Rate limiting and response caching

---

## Feature 5: Frontend UI & Visualizations

**Purpose**: Provide intuitive interfaces for real-time monitoring, historical analysis, and insights display.

### Capabilities

#### Dashboard (Main Landing Page)

**Components**:
- **Quick Stats**: Today's focus score, total deep work time, session count
- **Session List**: Recent sessions with thumbnails and key metrics
- **Start Session Button**: Prominent CTA to begin new session
- **Weekly Trend Chart**: Focus score over past 7 days
- **Quick Links**: Access reports, settings, data export

**Features**:
- Real-time updates via WebSocket
- Filter sessions by date, score, duration
- Search sessions by insights content
- Dark/light mode toggle

#### Live Session View (Real-Time Monitoring)

**Components**:
- **Session Timer**: Elapsed time in HH:MM:SS
- **Current Focus Score**: Live 0-100 score with color indicator
  - Green (80-100): Deep focus
  - Yellow (50-79): Moderate focus
  - Red (0-49): Distracted
- **Typing Velocity Gauge**: Real-time CPM with sparkline
- **Active Tab Display**: Current site/app with time spent
- **Activity Stream**: Recent events (tab switches, typing bursts, idle periods)
- **Intervention Notifications**: Toast-style alerts for AI interventions

**Real-Time Features**:
- WebSocket connection status indicator
- Auto-refresh every second
- Smooth animations for metric updates
- Intervention history in sidebar

#### Post-Session Report (Detailed Analytics)

**Visualizations**:

1. **Focus Timeline** (Area Chart)
   - X-axis: Time (session start to end)
   - Y-axis: Focus score (0-100)
   - Color zones: Green (deep work), yellow (moderate), red (distracted)
   - Hover tooltips showing exact events at that time
   - Click to drill down into specific time periods

2. **App Usage Breakdown** (Pie Chart)
   - Proportions of time spent on different sites/apps
   - Color-coded by category (productive, neutral, distracting)
   - Interactive segments (click to filter timeline)

3. **Typing Velocity Over Time** (Line Chart)
   - Shows CPM throughout session
   - Highlights flow state periods
   - Correlate velocity changes with tab switches

4. **Context Switch Frequency** (Bar Chart)
   - Number of tab switches per 5-minute window
   - Identify peak distraction periods

**Metrics Displayed**:
- **Focus Score**: 0-100 composite score
- **Deep Work Time**: Total minutes in green zone
- **Shallow Work Time**: Total minutes in yellow zone
- **Distracted Time**: Total minutes in red zone
- **Distraction Frequency**: Number of distracting events
- **Weekly Comparison**: This session vs. weekly average

**AI Insights Section**:
- 3-5 personalized insights with icons
- Example: "🔥 Your typing rhythm today matches your 'flow sessions' from last week"
- Example: "⚠️ Tuesday afternoons consistently show 60% more distractions"
- Actionable recommendations for next session
- Trend identification (improving, declining, stable)

#### Responsive Design
- Desktop-first, responsive down to tablet (768px)
- Mobile view: Stacked cards, simplified charts
- Touch-friendly interactions on mobile

#### Notification System
- Toast notifications for interventions (top-right corner)
- Dismissible with animation
- Sound effects (optional, user preference)
- Browser notifications when tab not focused

**Technical Implementation**:
- React 18 with TypeScript
- React Router for navigation
- Recharts for all visualizations
- Tailwind CSS for styling
- Socket.io-client for real-time updates
- React Context for state management

---

## Feature 6: Post-Session Analytics & Insights Generation

**Purpose**: Leverage AI to generate deep, personalized insights about focus patterns and productivity trends.

### Capabilities

#### Focus Score Calculation Algorithm

**Formula**: Weighted composite of 4 factors

```
Focus Score = (Typing Consistency × 0.4) + 
              (Low Context-Switching × 0.3) + 
              (Minimal Idle Time × 0.2) + 
              (Site Focus × 0.1)
```

**Factor Calculations**:

1. **Typing Consistency (40%)**
   - Coefficient of variation in typing velocity
   - Low CV = consistent rhythm = high score
   - Range: 0-100

2. **Low Context-Switching (30%)**
   - Inverse of tab switch frequency
   - Fewer switches = higher score
   - Normalized to 0-100 scale

3. **Minimal Idle Time (20%)**
   - Percentage of session that's active
   - Active time / total time × 100
   - Penalize extended idle periods more

4. **Site Focus (10%)**
   - Ratio of productive site time to distracting site time
   - Categorize sites as: productive, neutral, distracting
   - Productive focus = high score

**Output**: Single 0-100 score updated in real-time

#### Session Analysis Workflow

**Trigger**: When user ends session (POST /api/sessions/:id/end)

**Process**:
1. Aggregate all activity data for session
2. Calculate focus score and component sub-scores
3. Identify key patterns and anomalies
4. Build context for AI analysis
5. Call Groq Llama 3.1 70B with comprehensive prompt
6. Parse AI response into structured insights
7. Store insights in database
8. Return insights to frontend for display

**Analysis Duration**: 3-8 seconds (deep analysis with 70B model)

#### Comparative Metrics Computation

**Comparisons Made**:
- This session vs. user's average
- This session vs. user's best session
- Today vs. yesterday
- This week vs. last week
- Weekday pattern analysis (Mon-Fri trends)

**Metrics Computed**:
- Focus score delta (±X points)
- Deep work time delta (±X minutes)
- Distraction frequency delta (±X events)
- Improvement percentage
- Streak tracking (consecutive good sessions)

#### Trend Detection Logic

**Algorithms**:
- **Moving Average**: 7-day and 30-day averages
- **Regression Analysis**: Slope of focus score over time
- **Pattern Matching**: Recurring distraction triggers
- **Anomaly Detection**: Unusual sessions (very high/low scores)

**Trends Identified**:
- Improving (upward trend in focus scores)
- Declining (downward trend)
- Stable (within ±5 points)
- Day-of-week patterns (e.g., "Thursdays are hardest")
- Time-of-day patterns (e.g., "Morning person")

#### AI Insights Generation (Groq 70B)

**Prompt Structure**:
```
You are a supportive productivity coach analyzing a focus session.

Session Summary:
- Duration: 2h 45m
- Focus Score: 73/100
- Deep Work: 1h 32m (56%)
- Distraction Events: 12 (context-switches: 8, social media: 4)
- Typing Velocity: Avg 165 CPM (range: 140-185)

Patterns Detected:
- Consistent typing rhythm (good flow state)
- Context-switching increased in last 30 minutes
- 3 visits to Twitter clustered around 2:30 PM

Historical Context:
- User's average focus score: 68
- User's best session: 89 (last Tuesday)
- User typically struggles mid-afternoon

Generate:
1. 3-5 specific, actionable insights
2. What worked well this session
3. What to improve next time
4. Personalized recommendations based on patterns

Tone: Supportive, non-judgmental, evidence-based
```

**Output Structure**:
```json
{
  "insights": [
    {
      "type": "positive",
      "icon": "🔥",
      "message": "Your typing rhythm was excellent—consistent 165 CPM matching your best flow sessions"
    },
    {
      "type": "warning",
      "icon": "⚠️",
      "message": "Context-switching spiked in the last 30 minutes. Consider pre-scheduling a break next time."
    },
    {
      "type": "pattern",
      "icon": "📊",
      "message": "You visited Twitter 3 times around 2:30 PM—this matches your typical afternoon energy dip"
    }
  ],
  "strengths": [
    "Maintained focus for 90+ minutes before first major distraction",
    "Typing velocity indicates deep engagement with material"
  ],
  "improvements": [
    "Take proactive break at 2 PM before energy dip",
    "Use website blocker for social media after lunch"
  ],
  "recommendations": [
    "Try Pomodoro sprint intervals (45 min work, 5 min break) based on your sustained focus ability",
    "Protect 1-3 PM as deep work block—schedule meetings before or after"
  ],
  "trend": "improving",
  "trendMessage": "Focus score +5 points from last week's average. You're building momentum!"
}
```

#### Actionable Recommendations Engine

**Recommendation Types**:
1. **Technique Adjustments**: Suggest different focus methods
2. **Environmental Changes**: Optimal work conditions
3. **Time Management**: Best times for deep work
4. **Break Strategies**: When and how to take breaks
5. **Tool Suggestions**: Website blockers, app recommendations

**Personalization**:
- Based on user's historical patterns
- Reference specific past sessions
- Adapt to what's worked before
- Learn from failed interventions

**Technical Implementation**:
- Groq Llama 3.1 70B Versatile for deep analysis
- Structured prompts with session context
- JSON response parsing and validation
- Caching of insights for fast retrieval
- Retry logic for API failures

---

## Feature Integration & Data Flow

### End-to-End Session Flow

```
1. User clicks "Start Session" in Extension Popup
2. Extension → WebSocket → Backend: session:start event
3. Backend creates session in SQLite, returns session ID
4. Extension begins monitoring (tabs, typing, idle)
5. Extension → WebSocket → Backend: activity:log events (continuous)
6. Backend: 
   - Stores activities in SQLite
   - Pattern recognition engine analyzes real-time
   - If pattern detected → Groq 8B generates intervention
   - Intervention → WebSocket → Frontend/Extension
7. Frontend displays intervention notification
8. User continues working...
9. User clicks "End Session" in Extension Popup
10. Extension → WebSocket → Backend: session:end event
11. Backend:
    - Calculates focus score
    - Groq 70B analyzes full session
    - Generates insights and recommendations
    - Stores insights in SQLite
12. Backend → WebSocket → Frontend: session:completed event
13. Frontend automatically navigates to Post-Session Report
14. User reviews insights and visualizations
```

### Privacy Guarantee Across Features

Every feature respects privacy principles:

- **Extension**: Never captures actual content, only metadata
- **Backend**: Sanitizes all URLs, stores behavioral data locally
- **AI Layer**: Only sends anonymized patterns to Groq
- **Frontend**: User can view/export/delete all data at any time

---

## Future Feature Enhancements (Post-MVP)

### Phase 2 Additions
- **Calendar Integration**: Analyze meeting impact on focus
- **Sleep Tracking**: Correlate sleep quality with focus scores
- **Team Features**: Anonymous benchmarking, shared focus blocks
- **Smart Scheduling**: AI suggests optimal work time blocks

### Phase 3 Additions
- **Natural Language Queries**: "When am I most creative?"
- **Predictive Insights**: "You'll likely struggle Thursday afternoon"
- **Cross-App Tracking**: Extend beyond browser to desktop apps
- **Voice Interventions**: Optional audio coaching

---

## Technical Summary

| Feature | Tech Stack | Key Dependencies |
|---------|-----------|------------------|
| Extension Monitoring | TypeScript, Chrome APIs | Manifest V3, Service Workers |
| Backend API | Express.js, SQLite3 | TypeScript, Socket.io |
| WebSocket Layer | Socket.io | Real-time bidirectional events |
| AI Pattern Recognition | Groq SDK | Llama 3.1 8B Instant |
| Frontend UI | React 18, Recharts | Tailwind CSS, React Router |
| Analytics & Insights | Groq SDK | Llama 3.1 70B Versatile |

---

*This features document provides a comprehensive overview. For detailed implementation specifications, see individual RFCs for each feature.*

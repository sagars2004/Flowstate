# Flowstate - Product Requirements Document

## Executive Summary

**Product Name**: Flowstate  
**Version**: 1.0.0  
**Last Updated**: January 8, 2026  
**Status**: Development

Flowstate is a local-first productivity intelligence system that uses behavioral metadata and adaptive AI interventions to personalize and sustain deep focus. Unlike traditional productivity tools that either passively track or rigidly enforce focus techniques, Flowstate learns each user's unique productivity patterns and provides timely, contextual coaching to help maintain flow state.

## Problem Statement

Knowledge workers consistently struggle with focus and productivity:
- **The Reality**: Sitting down to work for 3 hours often yields only 47 minutes of actual productive time
- **Current Solutions Fall Short**:
  - Passive trackers only tell you after the fact that you were distracted
  - Rigid productivity apps treat everyone the same (one-size-fits-all Pomodoro timers)
  - None provide real-time, intelligent interventions when you're spiraling

**The Core Issue**: People need adaptive, real-time support that understands their unique focus patterns, not generic productivity prescriptions.

## Vision & Purpose

### Vision
Create an AI-powered focus companion that learns your personal "flow state fingerprint" and provides intelligent interventions to help you achieve and maintain deep work.

### Purpose
Flowstate transforms productivity from a one-size-fits-all metric into a personalized, adaptive system. By monitoring behavioral metadata (not content), it identifies when you're in flow vs. when you're struggling, and intervenes with contextual suggestions that actually help.

### Core Value Proposition
"AI that adapts to your rhythm and doesn't treat productivity like a metronome. Turn your life into actionable endpoints."

## Target Users

### Primary Personas

1. **The Student** (Ages 18-25)
   - Struggles with procrastination and context-switching during study sessions
   - Needs help maintaining focus through long problem sets or essay writing
   - Values privacy (doesn't want tracking of actual content)

2. **The Knowledge Worker** (Ages 25-45)
   - 9-5 workers juggling multiple projects and constant distractions
   - Needs to maximize productivity during limited deep work windows
   - Wants data-driven insights to improve work habits

3. **The Entrepreneur** (Ages 25-50)
   - Self-directed work requires strong self-discipline
   - Needs to identify peak productivity times and protect them
   - Values actionable insights to optimize limited time

4. **The Chronic Procrastinator** (All Ages)
   - Recognizes their patterns but struggles to break them
   - Needs external nudges at the right moments
   - Benefits from understanding what triggers their avoidance

## Core Features

### 1. Passive Background Monitoring (Chrome Extension)

**What it tracks**:
- Typing velocity (keypress frequency, not content)
- Tab/URL changes and switching patterns
- Time spent per site/application
- Idle periods and activity resumption
- Active window focus

**Privacy Guarantees**:
- No keystroke logging (only frequency/velocity metadata)
- URLs sanitized before storage
- All data stored locally
- User has full control to view/delete all data

### 2. Real-Time AI Coaching & Interventions

**Pattern Detection**:
- Rapid context-switching (e.g., 8 tab switches in 5 minutes)
- Social media spirals (repeated visits to distracting sites)
- Prolonged idle periods (stuck on hard problems)
- Typing velocity changes (flow vs. struggling)

**Intelligent Interventions**:
- Contextual messages delivered at the right moment
- Example: "You've opened Twitter 5 times in 8 minutes—take a 5-minute walk?"
- Example: "You've context-switched 8 times in 5 minutes—this usually means you're avoiding something hard. Want a hint or a break?"
- Non-judgmental tone focused on support, not criticism

### 3. Personal Focus Fingerprinting

**Learning Your Patterns**:
- Optimal work duration before breaks needed
- Peak focus times of day
- What "flow state" looks like for you (typing rhythm, focus duration, etc.)
- What "struggling" looks like (context-switching, slow typing, etc.)

**Pattern Recognition**:
- Identifies triggers for distraction (afternoon energy crashes, difficult problems)
- Correlates environmental factors with performance
- Builds historical baseline for comparison

### 4. Post-Session Analytics & Insights

**Visual Focus Timeline**:
- Color-coded intensity map (green = deep work, yellow = moderate, red = distracted)
- Drill-down to see exact moments of distraction
- Hover for context on what derailed focus

**Performance Metrics**:
- Focus score (0-100) based on multiple factors
- Total deep work time vs. shallow work
- Distraction frequency and patterns
- Comparison to weekly/monthly averages

**AI-Generated Insights**:
- 3-5 personalized insights per session
- Example: "Your typing rhythm today matches your 'flow sessions' from last week—you're on fire"
- Example: "Tuesday afternoons consistently show 60% more distractions than mornings"
- Technique recommendations for next session

### 5. Privacy-First Architecture

**Local-First Design**:
- All sensitive data stored locally in SQLite
- Backend runs on localhost (no cloud dependency)
- User controls all data with easy export/delete

**Anonymized AI Analysis**:
- Only behavioral patterns sent to AI (never content)
- Example of what's sent: "User switched tabs 8 times in 5 minutes"
- No personal identifiers, URLs, or content in AI requests

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast hot reload, optimized builds)
- **Styling**: Tailwind CSS (rapid UI development)
- **UI Components**: shadcn/ui (optional, for polished components)
- **Charts**: Recharts (focus timeline, app usage, typing velocity)
- **Real-Time**: Socket.io-client (WebSocket connection to backend)
- **Routing**: React Router v6

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (type safety, better DX)
- **Database**: SQLite3 (local-first, no server setup needed)
- **Real-Time**: Socket.io (WebSocket server for live updates)
- **AI Integration**: Groq SDK (free, fast inference)
- **Middleware**: cors, helmet (security), morgan (logging)

### Chrome Extension
- **Manifest**: V3 (latest standard)
- **Language**: TypeScript
- **Components**: 
  - Service Worker (background monitoring)
  - Content Scripts (typing detection)
  - Popup UI (session control)
- **Permissions**: tabs, activeTab, idle, storage, background

### AI Layer
- **Provider**: Groq (free, 14,400 requests/day)
- **Models**:
  - Llama 3.1 8B Instant (real-time interventions, low latency)
  - Llama 3.1 70B Versatile (post-session analysis, deeper insights)
- **Rate Limit**: 14,400 requests/day (sufficient for demo + testing)

### Development Tools
- **Monorepo**: npm/yarn workspaces
- **TypeScript Config**: Shared across workspaces
- **Linting**: ESLint with TypeScript rules
- **Code Style**: Prettier (enforced via Cursor Rules)

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Service    │  │   Content    │  │    Popup     │      │
│  │   Worker     │  │   Scripts    │  │      UI      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                   WebSocket/HTTP
                             │
          ┌──────────────────▼──────────────────┐
          │          Express Backend            │
          │  ┌────────────┐  ┌────────────┐    │
          │  │  REST API  │  │  WebSocket │    │
          │  └─────┬──────┘  └─────┬──────┘    │
          │  ┌─────▼────────────────▼──────┐   │
          │  │   Pattern Recognition       │   │
          │  │   & Intervention Engine     │   │
          │  └─────────────┬────────────────┘   │
          │  ┌─────────────▼────────────────┐   │
          │  │      SQLite Database         │   │
          │  └──────────────────────────────┘   │
          └─────────────────┬───────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Groq API     │
                    │ (Llama 3.1)    │
                    └────────────────┘
                            │
          ┌─────────────────▼──────────────────┐
          │         React Frontend             │
          │  ┌──────────────────────────────┐  │
          │  │        Dashboard             │  │
          │  │  ┌────────────────────────┐  │  │
          │  │  │   Live Session View    │  │  │
          │  │  └────────────────────────┘  │  │
          │  │  ┌────────────────────────┐  │  │
          │  │  │  Post-Session Report   │  │  │
          │  │  └────────────────────────┘  │  │
          │  └──────────────────────────────┘  │
          └─────────────────────────────────────┘
```

### Data Flow

1. **Activity Capture**: Extension monitors user behavior → generates activity events
2. **Transmission**: Activity data sent to backend via WebSocket
3. **Storage**: Backend logs data to SQLite database
4. **Analysis**: Pattern recognition engine analyzes activity in real-time
5. **AI Intervention**: Patterns trigger Groq API calls for intervention generation
6. **Delivery**: Interventions pushed to frontend via WebSocket
7. **Display**: Frontend shows intervention notifications to user
8. **Session End**: Deep analysis via Groq 70B generates comprehensive insights
9. **Visualization**: Frontend displays post-session report with charts

## Success Criteria

### MVP (Minimum Viable Product) - Day 3 Goal

#### Functional Requirements
- [ ] User can start a focus session from Chrome extension
- [ ] Extension tracks typing velocity, tab switches, and idle time
- [ ] Backend receives and stores activity data in SQLite
- [ ] Pattern detection identifies at least 3 distraction patterns
- [ ] Real-time interventions appear in frontend within 5 seconds of pattern detection
- [ ] User can end session gracefully
- [ ] Post-session report displays with at least 3 visualizations
- [ ] AI insights are contextual and reference actual session data
- [ ] All data stored locally (verified via database inspection)

#### Technical Requirements
- [ ] Monorepo builds successfully with all 3 workspaces
- [ ] Chrome extension loads in developer mode without errors
- [ ] Backend runs on localhost:3001
- [ ] Frontend runs on localhost:5173
- [ ] WebSocket connections stable (auto-reconnect on disconnect)
- [ ] Groq API integration working (rate limits not exceeded)
- [ ] No console errors in production builds

#### User Experience Requirements
- [ ] Intervention messages are non-judgmental and supportive
- [ ] Focus timeline is intuitive and color-coded clearly
- [ ] Dashboard loads in < 2 seconds
- [ ] Live session view updates in real-time (< 1 second latency)
- [ ] Extension popup provides clear session status

### Demo Validation Checklist

Pre-loaded demo data must demonstrate:
- [ ] High-focus session (80+ focus score)
- [ ] Distracted session (< 50 focus score)
- [ ] Mixed session with clear pattern changes
- [ ] At least 5 different distraction patterns detected across demo sessions
- [ ] AI insights vary by session type (not generic)

### Privacy Validation
- [ ] No actual typed content in database
- [ ] URLs properly sanitized (no query params with personal data)
- [ ] Groq API requests contain only anonymized behavioral patterns
- [ ] User can view all stored data via dashboard
- [ ] User can delete any session with one click

## Future Scalability Vision

### Phase 2: Expanded Data Integration (Post-MVP)
- Calendar API integration (Google Cal) for meeting impact analysis
- Sleep tracking integration (Oura, Apple Health) for energy correlation
- Financial data integration for stress pattern analysis
- Email pattern analysis (volume, response time as stress indicators)

### Phase 3: Unified Personal Intelligence Layer
- Natural language query interface: "When am I most creative?"
- Cross-context insights: "Your focus drops 40% on days with <6 hours sleep"
- Proactive optimization: "You're overcommitted next Tuesday based on your typical capacity"
- Pattern prediction: "Wednesday afternoon usually has 3x distractions—block focus time?"

### Phase 4: Social & Team Features
- Anonymous benchmarking (compare your patterns to similar roles)
- Team focus scores (without exposing individual data)
- Focus time coordination (automatically schedule team deep work blocks)

## Non-Goals (Out of Scope for MVP)

- Mobile app (Chrome extension + web UI only)
- Cloud sync (local-first only for MVP)
- Team/collaboration features
- Browser support beyond Chrome (future: Firefox, Edge)
- Screen recording or content capture
- Integration with task management tools (Notion, Todoist)
- Calendar integration
- Slack/Discord integrations

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chrome Extension Manifest V3 limitations | Medium | High | Prototype early, use established patterns |
| Groq API rate limits during demo | Low | High | Implement caching, use pre-loaded insights for demo |
| WebSocket connection stability | Medium | Medium | Implement reconnection logic, queue messages |
| SQLite performance with large datasets | Low | Medium | Index properly, implement data archival |

### Privacy Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Accidental keystroke logging | Low | Critical | Code review, automated tests, clear documentation |
| URL data leakage | Medium | High | Sanitize all URLs before storage, strip query params |
| AI prompt injection | Low | Medium | Validate all data before sending to Groq |

### User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Interventions feel judgmental | Medium | High | Carefully craft prompts, user testing |
| Interventions become annoying | High | Medium | Implement frequency limits, user preferences |
| Complex setup process | Medium | Medium | Clear onboarding, video walkthrough |

## Timeline

### Phase 0: Documentation (Day 0 - Pre-Implementation)
- PRD (this document) ✓
- Cursor Rules (.cursorrules)
- Features Documentation
- 6 RFCs (one per major feature)

### Day 1: Core Infrastructure
- Monorepo setup
- Frontend skeleton (React + Vite + Tailwind)
- Backend (Express + SQLite + Groq)
- Extension (Manifest V3, basic monitoring)
- WebSocket communication layer
- **Goal**: Can start/stop session and see data logged

### Day 2: AI Integration + UI
- Pattern recognition engine
- Real-time intervention system
- Live Session View UI
- Post-session AI analysis
- Report visualization components
- **Goal**: Complete session with AI insights and visualizations

### Day 3: Polish + Demo Prep
- Refine intervention logic
- Dashboard page
- Pre-loaded demo data
- Error handling & edge cases
- Landing/onboarding pages
- Demo practice
- **Goal**: Bulletproof demo ready

## Approval & Sign-Off

**Product Owner**: [Your Name]  
**Technical Lead**: [Your Name]  
**Target Completion**: Day 3 of Sprint  
**Status**: ✅ Approved - Ready for Implementation

---

*This PRD is a living document and will be updated as implementation reveals new insights or requirements change.*

# RFC-006: Analytics & Insights Generation

**Status**: Approved  
**Created**: January 8, 2026  
**Author**: Flowstate Team  
**Related Features**: Post-Session Analytics & Insights Generation

## Overview

This RFC defines the analytics engine and AI-powered insights generation system. After a session ends, the system calculates comprehensive metrics (focus score, deep work time, distraction patterns) and uses Groq API (Llama 3.1 70B) to generate personalized insights and actionable recommendations.

## Purpose

Transform raw activity data into meaningful insights that help users understand their focus patterns, identify improvement opportunities, and optimize their productivity strategies over time.

## Technical Approach

### Analysis Pipeline

```
┌─────────────────────────────────────────────────────────┐
│              Session End Trigger                         │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│         Fetch All Session Activities                     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│       Calculate Focus Score Components                   │
│  - Typing consistency (40%)                             │
│  - Context-switching frequency (30%)                    │
│  - Idle time percentage (20%)                           │
│  - Site focus ratio (10%)                               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│       Calculate Session Statistics                       │
│  - Deep work time, shallow work time                    │
│  - Distraction count and types                          │
│  - Peak focus periods                                   │
│  - Typing velocity trends                               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│       Comparative Analysis                               │
│  - Compare to user's historical average                 │
│  - Identify trends (improving/declining/stable)         │
│  - Find day-of-week patterns                            │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│       Groq API (Llama 3.1 70B)                          │
│  - Generate 3-5 personalized insights                   │
│  - Identify strengths and improvements                  │
│  - Create actionable recommendations                    │
│  - Determine trend and trend message                    │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│       Store Insights in Database                         │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│       Notify Frontend (WebSocket)                        │
└─────────────────────────────────────────────────────────┘
```

## Focus Score Calculation

### Algorithm

The focus score is a weighted composite of four factors:

```typescript
// src/ai/focusScoreCalculator.ts
export interface FocusScoreComponents {
  typingConsistency: number;     // 0-100
  contextSwitching: number;       // 0-100
  idleTime: number;               // 0-100
  siteFocus: number;              // 0-100
}

export interface FocusScoreResult {
  overall: number;                // 0-100
  components: FocusScoreComponents;
  breakdown: {
    typingWeight: number;
    contextSwitchWeight: number;
    idleWeight: number;
    siteWeight: number;
  };
}

export class FocusScoreCalculator {
  private readonly TYPING_WEIGHT = 0.4;
  private readonly CONTEXT_SWITCH_WEIGHT = 0.3;
  private readonly IDLE_WEIGHT = 0.2;
  private readonly SITE_WEIGHT = 0.1;

  calculate(activities: Activity[]): FocusScoreResult {
    const components: FocusScoreComponents = {
      typingConsistency: this.calculateTypingConsistency(activities),
      contextSwitching: this.calculateContextSwitchScore(activities),
      idleTime: this.calculateIdleScore(activities),
      siteFocus: this.calculateSiteFocusScore(activities)
    };

    const overall =
      components.typingConsistency * this.TYPING_WEIGHT +
      components.contextSwitching * this.CONTEXT_SWITCH_WEIGHT +
      components.idleTime * this.IDLE_WEIGHT +
      components.siteFocus * this.SITE_WEIGHT;

    return {
      overall: Math.round(overall),
      components,
      breakdown: {
        typingWeight: this.TYPING_WEIGHT,
        contextSwitchWeight: this.CONTEXT_SWITCH_WEIGHT,
        idleWeight: this.IDLE_WEIGHT,
        siteWeight: this.SITE_WEIGHT
      }
    };
  }

  private calculateTypingConsistency(activities: Activity[]): number {
    const typingActivities = activities.filter(a => 
      a.eventType === 'typing' && a.typingVelocity !== null
    );

    if (typingActivities.length < 3) return 50; // Insufficient data

    const velocities = typingActivities.map(a => a.typingVelocity!);
    const mean = this.average(velocities);
    const stdDev = this.standardDeviation(velocities);
    const cv = stdDev / mean; // Coefficient of variation

    // Lower CV = more consistent = higher score
    // CV ranges typically 0.1 (very consistent) to 0.5+ (very inconsistent)
    const score = Math.max(0, Math.min(100, 100 - (cv * 200)));

    return Math.round(score);
  }

  private calculateContextSwitchScore(activities: Activity[]): number {
    const sessionDuration = this.getSessionDuration(activities);
    const tabSwitches = activities.filter(a => a.eventType === 'tab_switch').length;

    // Calculate switches per hour
    const switchesPerHour = (tabSwitches / sessionDuration) * 3600000;

    // Good: < 10 switches/hour, Bad: > 50 switches/hour
    const score = Math.max(0, Math.min(100, 100 - (switchesPerHour * 2)));

    return Math.round(score);
  }

  private calculateIdleScore(activities: Activity[]): number {
    const sessionDuration = this.getSessionDuration(activities);
    const idleActivities = activities.filter(a => a.eventType === 'idle_end');
    
    const totalIdleTime = idleActivities.reduce((sum, a) => 
      sum + (a.idleDuration || 0), 0
    );

    const activeTime = sessionDuration - totalIdleTime;
    const activePercentage = (activeTime / sessionDuration) * 100;

    // High active percentage = high score
    return Math.round(Math.max(0, Math.min(100, activePercentage)));
  }

  private calculateSiteFocusScore(activities: Activity[]): number {
    const PRODUCTIVE_SITES = [
      'github.com',
      'stackoverflow.com',
      'docs.google.com',
      'notion.so',
      'figma.com',
      'vercel.com'
    ];

    const DISTRACTING_SITES = [
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'reddit.com',
      'youtube.com',
      'netflix.com'
    ];

    const urlActivities = activities.filter(a => 
      (a.eventType === 'url_change' || a.eventType === 'tab_activated') && a.url
    );

    let productiveCount = 0;
    let distractingCount = 0;

    for (const activity of urlActivities) {
      const domain = this.extractDomain(activity.url!);
      
      if (PRODUCTIVE_SITES.includes(domain)) {
        productiveCount++;
      } else if (DISTRACTING_SITES.includes(domain)) {
        distractingCount++;
      }
    }

    const total = productiveCount + distractingCount;
    if (total === 0) return 70; // Neutral if no classified sites

    const focusRatio = productiveCount / total;
    return Math.round(focusRatio * 100);
  }

  private getSessionDuration(activities: Activity[]): number {
    if (activities.length === 0) return 0;

    const timestamps = activities.map(a => a.timestamp.getTime());
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private standardDeviation(values: number[]): number {
    const mean = this.average(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = this.average(squaredDiffs);
    return Math.sqrt(variance);
  }
}
```

## Session Statistics Calculator

```typescript
// src/ai/sessionStatsCalculator.ts
export interface SessionStatistics {
  duration: number; // milliseconds
  deepWorkTime: number; // milliseconds (focus score >= 80)
  moderateWorkTime: number; // milliseconds (50-79)
  distractedTime: number; // milliseconds (0-49)
  totalActivities: number;
  typingEvents: number;
  tabSwitches: number;
  idleEvents: number;
  averageTypingVelocity: number;
  peakFocusPeriods: Array<{
    startTime: Date;
    endTime: Date;
    avgScore: number;
  }>;
  distractionEvents: Array<{
    time: Date;
    type: string;
    details: string;
  }>;
}

export class SessionStatsCalculator {
  calculate(session: Session, activities: Activity[]): SessionStatistics {
    const duration = session.endTime && session.startTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : 0;

    // Calculate time in each focus zone (simplified - would need time-series analysis)
    const focusTimeBreakdown = this.calculateFocusTimeBreakdown(activities, duration);

    const typingActivities = activities.filter(a => a.eventType === 'typing');
    const avgTypingVelocity = typingActivities.length > 0
      ? typingActivities.reduce((sum, a) => sum + (a.typingVelocity || 0), 0) / typingActivities.length
      : 0;

    return {
      duration,
      deepWorkTime: focusTimeBreakdown.deep,
      moderateWorkTime: focusTimeBreakdown.moderate,
      distractedTime: focusTimeBreakdown.distracted,
      totalActivities: activities.length,
      typingEvents: typingActivities.length,
      tabSwitches: activities.filter(a => a.eventType === 'tab_switch').length,
      idleEvents: activities.filter(a => a.eventType === 'idle_end').length,
      averageTypingVelocity: Math.round(avgTypingVelocity),
      peakFocusPeriods: this.findPeakFocusPeriods(activities),
      distractionEvents: this.findDistractionEvents(activities)
    };
  }

  private calculateFocusTimeBreakdown(activities: Activity[], totalDuration: number) {
    // Simplified - in reality would analyze focus score over time
    // For MVP, use heuristics based on activity types
    const tabSwitches = activities.filter(a => a.eventType === 'tab_switch').length;
    const idleTime = activities
      .filter(a => a.eventType === 'idle_end')
      .reduce((sum, a) => sum + (a.idleDuration || 0), 0);

    const activeTime = totalDuration - idleTime;
    const switchesPerHour = (tabSwitches / totalDuration) * 3600000;

    let deepWorkRatio = 0.3; // Default
    if (switchesPerHour < 10) {
      deepWorkRatio = 0.6;
    } else if (switchesPerHour < 25) {
      deepWorkRatio = 0.4;
    } else {
      deepWorkRatio = 0.2;
    }

    return {
      deep: Math.round(activeTime * deepWorkRatio),
      moderate: Math.round(activeTime * (1 - deepWorkRatio)),
      distracted: idleTime
    };
  }

  private findPeakFocusPeriods(activities: Activity[]) {
    // Simplified - would need sliding window analysis
    return [];
  }

  private findDistractionEvents(activities: Activity[]) {
    const distractions: Array<{ time: Date; type: string; details: string }> = [];

    // Find rapid tab switches
    const tabSwitches = activities.filter(a => a.eventType === 'tab_switch');
    for (let i = 0; i < tabSwitches.length - 4; i++) {
      const window = tabSwitches.slice(i, i + 5);
      const timeSpan = window[4].timestamp.getTime() - window[0].timestamp.getTime();
      
      if (timeSpan < 2 * 60 * 1000) { // 5 switches in 2 minutes
        distractions.push({
          time: window[0].timestamp,
          type: 'rapid_switching',
          details: '5 tab switches in 2 minutes'
        });
      }
    }

    return distractions;
  }
}
```

## Comparative Analysis Engine

```typescript
// src/ai/comparativeAnalyzer.ts
export interface ComparativeMetrics {
  focusScoreDelta: number;
  focusScoreDeltaPercent: number;
  deepWorkTimeDelta: number;
  distractionCountDelta: number;
  vsUserAverage: {
    focusScore: number;
    deepWorkTime: number;
  };
  vsBestSession: {
    focusScore: number;
    sessionId: string;
  };
  streak: {
    current: number;
    best: number;
  };
}

export class ComparativeAnalyzer {
  constructor(
    private sessionRepository: SessionRepository
  ) {}

  async analyze(currentSession: Session, currentStats: SessionStatistics): Promise<ComparativeMetrics> {
    // Fetch historical sessions
    const historicalSessions = await this.sessionRepository.findAll({
      limit: 30,
      status: 'completed'
    });

    const avgFocusScore = this.calculateAverage(
      historicalSessions.map(s => s.focusScore || 0)
    );

    const avgDeepWorkTime = this.calculateAverage(
      historicalSessions.map(s => 
        // Would need to fetch stats for each session - simplified here
        3600000 // 1 hour estimate
      )
    );

    // Find best session
    const bestSession = historicalSessions.reduce((best, current) => 
      (current.focusScore || 0) > (best.focusScore || 0) ? current : best
    , historicalSessions[0]);

    // Calculate streak
    const streak = this.calculateStreak(historicalSessions);

    // Calculate yesterday's session for delta
    const yesterday = historicalSessions.find(s => {
      const sessionDate = new Date(s.startTime);
      const today = new Date();
      const diff = today.getTime() - sessionDate.getTime();
      return diff < 48 * 60 * 60 * 1000 && diff > 0; // Within last 48h
    });

    const yesterdayScore = yesterday?.focusScore || avgFocusScore;

    return {
      focusScoreDelta: (currentSession.focusScore || 0) - yesterdayScore,
      focusScoreDeltaPercent: ((currentSession.focusScore || 0) - yesterdayScore) / yesterdayScore * 100,
      deepWorkTimeDelta: currentStats.deepWorkTime - avgDeepWorkTime,
      distractionCountDelta: 0, // Would compare to historical average
      vsUserAverage: {
        focusScore: avgFocusScore,
        deepWorkTime: avgDeepWorkTime
      },
      vsBestSession: {
        focusScore: bestSession?.focusScore || 0,
        sessionId: bestSession?.id || ''
      },
      streak: {
        current: streak.current,
        best: streak.best
      }
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStreak(sessions: Session[]): { current: number; best: number } {
    // Sort by date
    const sorted = sessions.sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime()
    );

    let currentStreak = 0;
    let bestStreak = 0;
    let lastDate: Date | null = null;

    for (const session of sorted) {
      if (session.focusScore && session.focusScore >= 70) { // Good session
        if (!lastDate || this.isConsecutiveDay(lastDate, session.startTime)) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
        lastDate = session.startTime;
      } else {
        currentStreak = 0;
      }
    }

    return { current: currentStreak, best: bestStreak };
  }

  private isConsecutiveDay(date1: Date, date2: Date): boolean {
    const diff = date2.getTime() - date1.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    return diff >= 0 && diff <= dayInMs * 1.5; // Within 36 hours
  }
}
```

## AI Insights Generation (Groq 70B)

```typescript
// src/ai/insightsGenerator.ts
import { GroqClient } from './groqClient';

export interface SessionInsights {
  insights: Array<{
    type: 'positive' | 'warning' | 'pattern' | 'improvement';
    icon: string;
    message: string;
  }>;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  trend: 'improving' | 'declining' | 'stable';
  trendMessage: string;
}

export class InsightsGenerator {
  constructor(
    private groqClient: GroqClient
  ) {}

  async generate(
    session: Session,
    stats: SessionStatistics,
    comparative: ComparativeMetrics
  ): Promise<SessionInsights> {
    const prompt = this.buildPrompt(session, stats, comparative);

    try {
      const insights = await this.groqClient.analyzeSession(session, []);
      return this.validateAndNormalize(insights);
    } catch (error) {
      console.error('Failed to generate insights:', error);
      return this.getFallbackInsights(session, stats);
    }
  }

  private buildPrompt(
    session: Session,
    stats: SessionStatistics,
    comparative: ComparativeMetrics
  ): string {
    const durationMinutes = Math.round(stats.duration / 60000);
    const deepWorkMinutes = Math.round(stats.deepWorkTime / 60000);
    const moderateWorkMinutes = Math.round(stats.moderateWorkTime / 60000);

    return `Analyze this focus session and generate structured JSON insights.

Session Summary:
- Duration: ${durationMinutes} minutes
- Focus Score: ${session.focusScore}/100
- Deep Work: ${deepWorkMinutes} minutes (${Math.round(stats.deepWorkTime / stats.duration * 100)}%)
- Moderate Work: ${moderateWorkMinutes} minutes
- Tab Switches: ${stats.tabSwitches}
- Average Typing Velocity: ${stats.averageTypingVelocity} CPM
- Total Activities: ${stats.totalActivities}

Comparative Data:
- Focus Score vs Average: ${comparative.focusScoreDelta > 0 ? '+' : ''}${Math.round(comparative.focusScoreDelta)} points
- Focus Score vs Best: ${comparative.vsBestSession.focusScore - (session.focusScore || 0)} points below best
- Current Streak: ${comparative.streak.current} good sessions

Generate JSON with this exact structure:
{
  "insights": [
    {
      "type": "positive",
      "icon": "🔥",
      "message": "Your typing rhythm was excellent—${stats.averageTypingVelocity} CPM matching flow state"
    }
  ],
  "strengths": ["Maintained focus for first 45 minutes"],
  "improvements": ["Reduce tab switching in final hour"],
  "recommendations": [
    "Block Twitter during afternoon sessions (3 visits detected)",
    "Take 5-minute break after 60 minutes of continuous work"
  ],
  "trend": "${comparative.focusScoreDelta > 5 ? 'improving' : comparative.focusScoreDelta < -5 ? 'declining' : 'stable'}",
  "trendMessage": "Focus score ${comparative.focusScoreDelta > 0 ? 'up' : 'down'} ${Math.abs(Math.round(comparative.focusScoreDelta))} points from last session"
}

Guidelines:
- Generate 3-5 specific insights referencing actual numbers
- Be supportive and evidence-based, never judgmental
- Make recommendations actionable and specific
- Reference specific times, events, or patterns when relevant
- Use appropriate emoji icons (🔥 for positive, ⚠️ for warnings, 📊 for patterns, 💡 for improvements)`;
  }

  private validateAndNormalize(insights: SessionInsights): SessionInsights {
    // Ensure insights has required structure
    return {
      insights: insights.insights || [],
      strengths: insights.strengths || [],
      improvements: insights.improvements || [],
      recommendations: insights.recommendations || [],
      trend: insights.trend || 'stable',
      trendMessage: insights.trendMessage || 'Keep up the good work!'
    };
  }

  private getFallbackInsights(session: Session, stats: SessionStatistics): SessionInsights {
    const focusScore = session.focusScore || 0;
    const deepWorkPercent = Math.round(stats.deepWorkTime / stats.duration * 100);

    return {
      insights: [
        {
          type: focusScore >= 70 ? 'positive' : 'warning',
          icon: focusScore >= 70 ? '✅' : '⚠️',
          message: `Focus score of ${focusScore}/100 with ${deepWorkPercent}% deep work time`
        },
        {
          type: 'pattern',
          icon: '📊',
          message: `Completed ${Math.round(stats.duration / 60000)} minute session with ${stats.totalActivities} activities logged`
        }
      ],
      strengths: ['Session completed successfully'],
      improvements: ['Continue building consistent focus habits'],
      recommendations: ['Try the Pomodoro technique for your next session'],
      trend: 'stable',
      trendMessage: 'Keep building your focus practice'
    };
  }
}
```

## Session Analysis Service

```typescript
// src/services/SessionAnalysisService.ts
export class SessionAnalysisService {
  constructor(
    private sessionRepository: SessionRepository,
    private activityRepository: ActivityRepository,
    private insightsRepository: InsightsRepository,
    private focusScoreCalculator: FocusScoreCalculator,
    private statsCalculator: SessionStatsCalculator,
    private comparativeAnalyzer: ComparativeAnalyzer,
    private insightsGenerator: InsightsGenerator
  ) {}

  async analyzeSession(sessionId: string): Promise<void> {
    console.log(`Starting analysis for session ${sessionId}`);

    // 1. Fetch session and activities
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }

    const activities = await this.activityRepository.findBySessionId(sessionId);

    // 2. Calculate focus score
    const focusScoreResult = this.focusScoreCalculator.calculate(activities);
    
    // Update session with focus score
    await this.sessionRepository.update(sessionId, {
      focusScore: focusScoreResult.overall
    });

    // 3. Calculate session statistics
    const stats = this.statsCalculator.calculate(session, activities);

    // 4. Perform comparative analysis
    const comparative = await this.comparativeAnalyzer.analyze(session, stats);

    // 5. Generate AI insights
    const insights = await this.insightsGenerator.generate(session, stats, comparative);

    // 6. Store insights
    await this.insightsRepository.create({
      sessionId,
      generatedAt: new Date(),
      insightsJson: JSON.stringify(insights.insights),
      recommendationsJson: JSON.stringify(insights.recommendations),
      trend: insights.trend
    });

    console.log(`Analysis complete for session ${sessionId}`);
  }
}
```

## Insights Repository

```typescript
// src/repositories/InsightsRepository.ts
export interface CreateInsightsData {
  sessionId: string;
  generatedAt: Date;
  insightsJson: string;
  recommendationsJson: string;
  trend: 'improving' | 'declining' | 'stable';
}

export class InsightsRepository extends BaseRepository {
  async create(data: CreateInsightsData): Promise<void> {
    const sql = `
      INSERT INTO insights (
        session_id, generated_at, insights_json,
        recommendations_json, trend
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.run(sql, [
      data.sessionId,
      data.generatedAt.getTime(),
      data.insightsJson,
      data.recommendationsJson,
      data.trend
    ]);
  }

  async findBySessionId(sessionId: string): Promise<SessionInsights | null> {
    const sql = 'SELECT * FROM insights WHERE session_id = ?';
    const row = await this.get<any>(sql, [sessionId]);

    if (!row) return null;

    return {
      insights: JSON.parse(row.insights_json),
      strengths: [],
      improvements: [],
      recommendations: JSON.parse(row.recommendations_json),
      trend: row.trend,
      trendMessage: ''
    };
  }
}
```

## Testing Criteria

### Unit Tests
- [ ] Focus score calculation is accurate
- [ ] Each component (typing, context-switch, idle, site) calculates correctly
- [ ] Statistics calculator produces correct metrics
- [ ] Comparative analyzer computes deltas accurately
- [ ] Insights generator handles Groq API responses

### Integration Tests
- [ ] Full analysis pipeline completes successfully
- [ ] Insights stored in database correctly
- [ ] WebSocket notification sent after analysis
- [ ] Frontend receives and displays insights

### Validation Tests
- [ ] Focus score always between 0-100
- [ ] Statistics sum to session duration
- [ ] AI-generated insights are coherent
- [ ] Fallback insights work when API fails

## Implementation Checklist

- [ ] Implement FocusScoreCalculator
- [ ] Implement SessionStatsCalculator
- [ ] Implement ComparativeAnalyzer
- [ ] Implement InsightsGenerator with Groq integration
- [ ] Create InsightsRepository
- [ ] Build SessionAnalysisService orchestrator
- [ ] Integrate with session end event
- [ ] Add WebSocket notification after analysis
- [ ] Test with real session data
- [ ] Validate insights quality
- [ ] Add error handling and fallbacks

## Performance Considerations

- Analysis should complete in < 10 seconds
- Use database indices for historical queries
- Cache user averages to reduce computation
- Queue analysis jobs if multiple sessions end simultaneously
- Rate limit Groq API calls

## Privacy Considerations

Only anonymized data sent to Groq:
- Aggregate statistics (counts, averages)
- Domain names (no full URLs)
- Behavioral patterns (no actual content)

## Future Enhancements

- Machine learning to improve focus score accuracy
- Predictive insights ("You'll likely struggle this afternoon")
- Weekly/monthly trend reports
- Goal setting and tracking
- Peer benchmarking (anonymous)
- Custom insight preferences

---

**Approval**: Ready for Implementation  
**Dependencies**: RFC-002 (Backend API), RFC-004 (Pattern Recognition)

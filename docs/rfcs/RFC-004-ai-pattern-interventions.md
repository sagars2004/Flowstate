# RFC-004: AI Pattern Recognition & Interventions

**Status**: Approved  
**Created**: January 8, 2026  
**Author**: Flowstate Team  
**Related Features**: AI Pattern Recognition & Interventions

## Overview

This RFC defines the AI-powered pattern recognition engine and real-time intervention system using Groq API (Llama 3.1). The system detects distraction patterns in real-time and generates contextual, supportive intervention messages to help users maintain focus.

## Purpose

Provide intelligent, adaptive interventions based on behavioral patterns, using AI to generate personalized, contextual messages that help users recognize and overcome distractions without being judgmental or annoying.

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Activity Stream (Real-time)                 │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│            Pattern Recognition Engine                    │
│  - Context-switching detector                           │
│  - Social media spiral detector                         │
│  - Idle period analyzer                                 │
│  - Typing rhythm analyzer                               │
└──────────────────┬──────────────────────────────────────┘
                   │
         Pattern Detected?
                   │ Yes
┌──────────────────▼──────────────────────────────────────┐
│          Intervention Decision Engine                    │
│  - Check frequency limits                               │
│  - Build context                                        │
│  - Determine priority                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Groq API (Llama 3.1 8B)                    │
│  - Generate contextual message                          │
│  - < 1 second response time                             │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│          WebSocket → User Notification                   │
└─────────────────────────────────────────────────────────┘
```

## Pattern Detection Algorithms

### 1. Context-Switching Detection

**Pattern**: Frequent tab switches in short time window

```typescript
// src/ai/detectors/contextSwitchDetector.ts
export interface ContextSwitchPattern {
  type: 'context_switch';
  severity: 'moderate' | 'high' | 'critical';
  switchCount: number;
  timeWindow: number; // milliseconds
  trigger: boolean;
}

export class ContextSwitchDetector {
  private readonly WINDOW_SIZE = 5 * 60 * 1000; // 5 minutes
  private readonly MODERATE_THRESHOLD = 5;
  private readonly HIGH_THRESHOLD = 8;
  private readonly CRITICAL_THRESHOLD = 12;

  private recentSwitches: number[] = []; // timestamps

  analyze(activity: Activity): ContextSwitchPattern | null {
    if (activity.eventType !== 'tab_switch') {
      return null;
    }

    const now = activity.timestamp.getTime();
    this.recentSwitches.push(now);

    // Remove old switches outside window
    this.recentSwitches = this.recentSwitches.filter(
      ts => now - ts < this.WINDOW_SIZE
    );

    const count = this.recentSwitches.length;

    if (count >= this.CRITICAL_THRESHOLD) {
      return {
        type: 'context_switch',
        severity: 'critical',
        switchCount: count,
        timeWindow: this.WINDOW_SIZE,
        trigger: true
      };
    } else if (count >= this.HIGH_THRESHOLD) {
      return {
        type: 'context_switch',
        severity: 'high',
        switchCount: count,
        timeWindow: this.WINDOW_SIZE,
        trigger: true
      };
    } else if (count >= this.MODERATE_THRESHOLD) {
      return {
        type: 'context_switch',
        severity: 'moderate',
        switchCount: count,
        timeWindow: this.WINDOW_SIZE,
        trigger: true
      };
    }

    return null;
  }

  reset(): void {
    this.recentSwitches = [];
  }
}
```

### 2. Social Media Spiral Detection

**Pattern**: Repeated visits to distracting sites

```typescript
// src/ai/detectors/socialMediaDetector.ts
export interface SocialMediaPattern {
  type: 'social_media_spiral';
  severity: 'moderate' | 'high';
  site: string;
  visitCount: number;
  timeWindow: number;
  trigger: boolean;
}

export class SocialMediaDetector {
  private readonly WINDOW_SIZE = 10 * 60 * 1000; // 10 minutes
  private readonly MODERATE_THRESHOLD = 3;
  private readonly HIGH_THRESHOLD = 5;

  private readonly DISTRACTING_SITES = [
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'reddit.com',
    'tiktok.com',
    'youtube.com',
    'netflix.com',
    'twitch.tv',
    'news.ycombinator.com'
  ];

  private siteVisits = new Map<string, number[]>(); // site -> timestamps[]

  analyze(activity: Activity): SocialMediaPattern | null {
    if (activity.eventType !== 'url_change' && activity.eventType !== 'tab_activated') {
      return null;
    }

    if (!activity.url) return null;

    const site = this.extractDomain(activity.url);
    if (!this.DISTRACTING_SITES.includes(site)) {
      return null;
    }

    const now = activity.timestamp.getTime();
    const visits = this.siteVisits.get(site) || [];
    visits.push(now);

    // Remove old visits
    const recentVisits = visits.filter(ts => now - ts < this.WINDOW_SIZE);
    this.siteVisits.set(site, recentVisits);

    const count = recentVisits.length;

    if (count >= this.HIGH_THRESHOLD) {
      return {
        type: 'social_media_spiral',
        severity: 'high',
        site,
        visitCount: count,
        timeWindow: this.WINDOW_SIZE,
        trigger: true
      };
    } else if (count >= this.MODERATE_THRESHOLD) {
      return {
        type: 'social_media_spiral',
        severity: 'moderate',
        site,
        visitCount: count,
        timeWindow: this.WINDOW_SIZE,
        trigger: true
      };
    }

    return null;
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  reset(): void {
    this.siteVisits.clear();
  }
}
```

### 3. Idle Period Analysis

**Pattern**: Extended periods with no activity

```typescript
// src/ai/detectors/idleDetector.ts
export interface IdlePattern {
  type: 'idle_period';
  severity: 'normal' | 'potential_stuck' | 'extended';
  duration: number; // milliseconds
  trigger: boolean;
}

export class IdleDetector {
  private readonly SHORT_BREAK_MAX = 2 * 60 * 1000; // 2 minutes
  private readonly POTENTIAL_STUCK = 5 * 60 * 1000; // 5 minutes

  analyze(activity: Activity): IdlePattern | null {
    if (activity.eventType !== 'idle_end') {
      return null;
    }

    const duration = activity.idleDuration || 0;

    if (duration >= this.POTENTIAL_STUCK) {
      return {
        type: 'idle_period',
        severity: 'extended',
        duration,
        trigger: true
      };
    } else if (duration >= this.SHORT_BREAK_MAX) {
      return {
        type: 'idle_period',
        severity: 'potential_stuck',
        duration,
        trigger: true
      };
    } else {
      return {
        type: 'idle_period',
        severity: 'normal',
        duration,
        trigger: false // Normal break, don't intervene
      };
    }
  }
}
```

### 4. Typing Rhythm Analysis

**Pattern**: Changes in typing velocity indicating mental state

```typescript
// src/ai/detectors/typingRhythmDetector.ts
export interface TypingRhythmPattern {
  type: 'typing_rhythm';
  state: 'flow' | 'normal' | 'struggling';
  velocity: number; // CPM
  consistency: number; // Coefficient of variation
  trigger: boolean;
}

export class TypingRhythmDetector {
  private readonly FLOW_MIN = 150;
  private readonly FLOW_MAX = 250;
  private readonly NORMAL_MIN = 80;
  private readonly STRUGGLING_MAX = 80;
  private readonly CONSISTENCY_THRESHOLD = 0.3;

  private recentVelocities: number[] = [];
  private readonly MAX_SAMPLES = 10;

  analyze(activity: Activity): TypingRhythmPattern | null {
    if (activity.eventType !== 'typing' || !activity.typingVelocity) {
      return null;
    }

    this.recentVelocities.push(activity.typingVelocity);

    if (this.recentVelocities.length > this.MAX_SAMPLES) {
      this.recentVelocities.shift();
    }

    if (this.recentVelocities.length < 3) {
      return null; // Need at least 3 samples
    }

    const avgVelocity = this.average(this.recentVelocities);
    const consistency = this.coefficientOfVariation(this.recentVelocities);

    let state: 'flow' | 'normal' | 'struggling';
    let trigger = false;

    if (avgVelocity >= this.FLOW_MIN && avgVelocity <= this.FLOW_MAX && consistency < this.CONSISTENCY_THRESHOLD) {
      state = 'flow';
      trigger = true; // Positive reinforcement
    } else if (avgVelocity >= this.NORMAL_MIN) {
      state = 'normal';
      trigger = false;
    } else {
      state = 'struggling';
      trigger = true; // Offer help
    }

    return {
      type: 'typing_rhythm',
      state,
      velocity: avgVelocity,
      consistency,
      trigger
    };
  }

  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private coefficientOfVariation(values: number[]): number {
    const mean = this.average(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / mean;
  }

  reset(): void {
    this.recentVelocities = [];
  }
}
```

## Pattern Analyzer Orchestration

```typescript
// src/ai/patternAnalyzer.ts
import { ContextSwitchDetector } from './detectors/contextSwitchDetector';
import { SocialMediaDetector } from './detectors/socialMediaDetector';
import { IdleDetector } from './detectors/idleDetector';
import { TypingRhythmDetector } from './detectors/typingRhythmDetector';

export type DetectedPattern = 
  | ContextSwitchPattern 
  | SocialMediaPattern 
  | IdlePattern 
  | TypingRhythmPattern;

export class PatternAnalyzer {
  private contextSwitchDetector = new ContextSwitchDetector();
  private socialMediaDetector = new SocialMediaDetector();
  private idleDetector = new IdleDetector();
  private typingRhythmDetector = new TypingRhythmDetector();

  async analyzeActivity(activityPayload: ActivityLogPayload): Promise<DetectedPattern | null> {
    // Convert payload to Activity object
    const activity: Activity = {
      id: 0,
      sessionId: activityPayload.sessionId,
      timestamp: new Date(activityPayload.timestamp),
      eventType: activityPayload.eventType,
      url: activityPayload.metadata.url || null,
      typingVelocity: activityPayload.metadata.typingVelocity || null,
      idleDuration: activityPayload.metadata.idleDuration || null,
      metadata: activityPayload.metadata,
      createdAt: new Date()
    };

    // Run all detectors
    const patterns: (DetectedPattern | null)[] = [
      this.contextSwitchDetector.analyze(activity),
      this.socialMediaDetector.analyze(activity),
      this.idleDetector.analyze(activity),
      this.typingRhythmDetector.analyze(activity)
    ];

    // Find first pattern that triggers intervention
    const triggeredPattern = patterns.find(p => p && p.trigger);
    
    return triggeredPattern || null;
  }

  resetSession(): void {
    this.contextSwitchDetector.reset();
    this.socialMediaDetector.reset();
    this.typingRhythmDetector.reset();
  }
}
```

## Intervention Decision Engine

```typescript
// src/ai/interventionEngine.ts
export interface InterventionDecision {
  shouldIntervene: boolean;
  pattern: DetectedPattern;
  priority: 'low' | 'medium' | 'high';
  type: 'alert' | 'suggestion' | 'encouragement' | 'question';
  context: Record<string, unknown>;
}

export class InterventionEngine {
  private lastInterventionTime: number = 0;
  private interventionCount: number = 0;
  private readonly MIN_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_PER_HOUR = 4;
  private readonly HOUR = 60 * 60 * 1000;

  async decideIntervention(pattern: DetectedPattern): Promise<InterventionDecision | null> {
    const now = Date.now();

    // Check frequency limits
    if (now - this.lastInterventionTime < this.MIN_INTERVAL) {
      console.log('Intervention suppressed: too soon since last intervention');
      return null;
    }

    // Reset count if hour passed
    if (now - this.lastInterventionTime > this.HOUR) {
      this.interventionCount = 0;
    }

    if (this.interventionCount >= this.MAX_PER_HOUR) {
      console.log('Intervention suppressed: max per hour reached');
      return null;
    }

    // Determine intervention details based on pattern
    const decision = this.buildDecision(pattern);

    if (decision.shouldIntervene) {
      this.lastInterventionTime = now;
      this.interventionCount++;
    }

    return decision;
  }

  private buildDecision(pattern: DetectedPattern): InterventionDecision {
    switch (pattern.type) {
      case 'context_switch':
        return {
          shouldIntervene: true,
          pattern,
          priority: pattern.severity === 'critical' ? 'high' : pattern.severity === 'high' ? 'medium' : 'low',
          type: 'question',
          context: {
            switchCount: pattern.switchCount,
            timeWindow: pattern.timeWindow
          }
        };

      case 'social_media_spiral':
        return {
          shouldIntervene: true,
          pattern,
          priority: pattern.severity === 'high' ? 'high' : 'medium',
          type: 'suggestion',
          context: {
            site: pattern.site,
            visitCount: pattern.visitCount
          }
        };

      case 'idle_period':
        return {
          shouldIntervene: true,
          pattern,
          priority: pattern.severity === 'extended' ? 'medium' : 'low',
          type: pattern.severity === 'extended' ? 'suggestion' : 'question',
          context: {
            duration: pattern.duration
          }
        };

      case 'typing_rhythm':
        if (pattern.state === 'flow') {
          return {
            shouldIntervene: true,
            pattern,
            priority: 'low',
            type: 'encouragement',
            context: {
              velocity: pattern.velocity,
              state: pattern.state
            }
          };
        } else if (pattern.state === 'struggling') {
          return {
            shouldIntervene: true,
            pattern,
            priority: 'medium',
            type: 'suggestion',
            context: {
              velocity: pattern.velocity,
              state: pattern.state
            }
          };
        }
        return {
          shouldIntervene: false,
          pattern,
          priority: 'low',
          type: 'alert',
          context: {}
        };
    }
  }

  resetSession(): void {
    this.lastInterventionTime = 0;
    this.interventionCount = 0;
  }
}
```

## Groq API Integration

### Client Setup

```typescript
// src/ai/groqClient.ts
import Groq from 'groq-sdk';

export class GroqClient {
  private client: Groq;
  private readonly MODEL_8B = 'llama-3.1-8b-instant';
  private readonly MODEL_70B = 'llama-3.1-70b-versatile';

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async generateIntervention(decision: InterventionDecision): Promise<string> {
    const prompt = this.buildInterventionPrompt(decision);

    const response = await this.client.chat.completions.create({
      model: this.MODEL_8B, // Fast for real-time
      messages: [
        {
          role: 'system',
          content: 'You are a supportive productivity coach. Generate brief, non-judgmental intervention messages (max 2 sentences) that help users recognize distractions without feeling bad. Be specific, actionable, and occasionally use light humor.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return response.choices[0]?.message?.content || 'Stay focused!';
  }

  async analyzeSession(
    session: Session,
    activities: Activity[]
  ): Promise<SessionInsights> {
    const prompt = this.buildSessionAnalysisPrompt(session, activities);

    const response = await this.client.chat.completions.create({
      model: this.MODEL_70B, // Deeper analysis
      messages: [
        {
          role: 'system',
          content: 'You are a productivity intelligence system analyzing focus sessions. Generate structured JSON with insights, patterns, and recommendations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  private buildInterventionPrompt(decision: InterventionDecision): string {
    const { pattern, type, context } = decision;

    switch (pattern.type) {
      case 'context_switch':
        return `The user has switched tabs ${context.switchCount} times in ${Math.round((context.timeWindow as number) / 60000)} minutes. This rapid context-switching suggests they might be avoiding a difficult task or feeling overwhelmed. Generate a ${type} message that:
- Acknowledges the pattern without judgment
- Suggests this might indicate avoidance of something challenging
- Offers a concrete action (take a break, close unused tabs, or break task into smaller steps)`;

      case 'social_media_spiral':
        return `The user has visited ${context.site} ${context.visitCount} times in the last 10 minutes. Generate a ${type} message that:
- Points out the repeated visits
- Suggests they're seeking distraction
- Offers an alternative (5-minute walk, stretch, water break)
- Uses light humor if appropriate`;

      case 'idle_period':
        const minutes = Math.round((context.duration as number) / 60000);
        return `The user has been idle for ${minutes} minutes. Generate a ${type} message that:
- Acknowledges the break
- ${minutes >= 5 ? 'Suggests they might be stuck on a hard problem or need a proper break' : 'Gently prompts them to resume if it was unintentional'}
- Offers actionable suggestion`;

      case 'typing_rhythm':
        if (pattern.state === 'flow') {
          return `The user's typing rhythm indicates they're in a flow state (${Math.round(context.velocity as number)} CPM, consistent). Generate an ${type} message that:
- Celebrates their focus
- References their flow state
- Is brief and motivating
- Uses fire emoji 🔥`;
        } else {
          return `The user's typing velocity has dropped to ${Math.round(context.velocity as number)} CPM, suggesting they might be struggling. Generate a ${type} message that:
- Acknowledges the challenge
- Suggests taking a quick break or trying a different approach
- Is supportive and non-judgmental`;
        }

      default:
        return 'Generate a brief, supportive focus reminder.';
    }
  }

  private buildSessionAnalysisPrompt(session: Session, activities: Activity[]): string {
    // Calculate summary statistics
    const duration = session.endTime && session.startTime
      ? (session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60 // minutes
      : 0;

    const typingActivities = activities.filter(a => a.eventType === 'typing');
    const tabSwitches = activities.filter(a => a.eventType === 'tab_switch').length;
    const idleEvents = activities.filter(a => a.eventType === 'idle_end');
    const totalIdleTime = idleEvents.reduce((sum, a) => sum + (a.idleDuration || 0), 0) / 1000 / 60; // minutes

    const avgTypingVelocity = typingActivities.length > 0
      ? typingActivities.reduce((sum, a) => sum + (a.typingVelocity || 0), 0) / typingActivities.length
      : 0;

    return `Analyze this focus session and generate structured JSON insights.

Session Summary:
- Duration: ${Math.round(duration)} minutes
- Focus Score: ${session.focusScore}/100
- Total Activities: ${activities.length}
- Tab Switches: ${tabSwitches}
- Average Typing Velocity: ${Math.round(avgTypingVelocity)} CPM
- Total Idle Time: ${Math.round(totalIdleTime)} minutes

Generate JSON with this structure:
{
  "insights": [
    {
      "type": "positive" | "warning" | "pattern" | "improvement",
      "icon": "🔥" | "⚠️" | "📊" | "💡",
      "message": "Specific insight about the session"
    }
  ],
  "strengths": ["What worked well"],
  "improvements": ["What to improve next time"],
  "recommendations": ["Specific, actionable suggestions"],
  "trend": "improving" | "declining" | "stable",
  "trendMessage": "Brief message about the trend"
}

Guidelines:
- 3-5 specific insights referencing actual data
- Be supportive and evidence-based
- Reference specific times or events when relevant
- Offer actionable recommendations based on patterns`;
  }
}
```

### Prompt Templates

```typescript
// src/ai/prompts.ts
export const INTERVENTION_PROMPTS = {
  contextSwitch: {
    moderate: `You've switched tabs {{count}} times in {{minutes}} minutes. Notice the rapid context-switching. Try closing tabs you don't need right now to reduce temptation.`,
    high: `{{count}} tab switches in {{minutes}} minutes—this usually means you're avoiding something hard. Want to break it into smaller steps or take a 5-minute walk?`,
    critical: `Heavy context-switching detected ({{count}} switches in {{minutes}} min). Close unnecessary tabs and commit to one task for the next 15 minutes.`
  },
  
  socialMedia: {
    moderate: `You've visited {{site}} {{count}} times in the last 10 minutes. What task are you avoiding?`,
    high: `{{site}} opened {{count}} times in 10 minutes—time for a real break? Take a 5-minute walk instead of scrolling.`
  },
  
  idle: {
    potentialStuck: `Been idle for {{minutes}} minutes. Stuck on a hard problem? Try breaking it into smaller steps or explaining it out loud.`,
    extended: `No activity for {{minutes}} minutes. Time for a proper break? Stretch, hydrate, or step outside for a few minutes.`
  },
  
  typingRhythm: {
    flow: `Your typing rhythm is excellent—{{velocity}} CPM matching your best flow sessions. You're on fire! 🔥`,
    struggling: `Typing velocity dropped to {{velocity}} CPM. Take a quick break or try a different approach to the problem.`
  }
};
```

## Rate Limiting & Caching

```typescript
// src/ai/rateLimiter.ts
export class GroqRateLimiter {
  private requestCount = 0;
  private readonly MAX_REQUESTS_PER_DAY = 14400; // Groq free tier
  private lastResetTime = Date.now();
  private cache = new Map<string, { message: string; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async checkLimit(): Promise<boolean> {
    // Reset counter every 24 hours
    if (Date.now() - this.lastResetTime > 24 * 60 * 60 * 1000) {
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    return this.requestCount < this.MAX_REQUESTS_PER_DAY;
  }

  incrementCount(): void {
    this.requestCount++;
  }

  getCached(key: string): string | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.message;
    }
    return null;
  }

  setCached(key: string, message: string): void {
    this.cache.set(key, { message, timestamp: Date.now() });
  }

  getCurrentUsage(): { used: number; limit: number; percentage: number } {
    return {
      used: this.requestCount,
      limit: this.MAX_REQUESTS_PER_DAY,
      percentage: (this.requestCount / this.MAX_REQUESTS_PER_DAY) * 100
    };
  }
}
```

## Testing Criteria

### Unit Tests
- [ ] Each detector identifies patterns correctly
- [ ] Thresholds trigger at correct counts
- [ ] Pattern analyzer orchestrates detectors
- [ ] Intervention engine respects frequency limits
- [ ] Groq client formats prompts correctly

### Integration Tests
- [ ] Real activity stream triggers pattern detection
- [ ] Detected patterns generate interventions
- [ ] Groq API responds within 2 seconds
- [ ] Rate limiter prevents exceeding quota
- [ ] Cache reduces redundant API calls

### User Acceptance Tests
- [ ] Interventions feel helpful, not annoying
- [ ] Messages are contextually relevant
- [ ] Frequency limits prevent notification fatigue
- [ ] Users can dismiss/snooze interventions

## Implementation Checklist

- [ ] Implement all 4 pattern detectors
- [ ] Create PatternAnalyzer orchestrator
- [ ] Build InterventionEngine with frequency limits
- [ ] Set up Groq API client
- [ ] Create prompt templates for each pattern type
- [ ] Implement rate limiter with caching
- [ ] Integrate with WebSocket for delivery
- [ ] Add intervention logging for effectiveness tracking
- [ ] Test with real activity data
- [ ] Tune thresholds based on user feedback

## Privacy Considerations

### Data Sent to Groq API

Only anonymized behavioral patterns, never actual content:

```typescript
// ✅ GOOD: Anonymized pattern
{
  "pattern": "User switched tabs 8 times in 5 minutes",
  "sites": ["twitter.com", "github.com"], // domains only
  "velocity": 165 // CPM, not actual text
}

// ❌ BAD: Never send this
{
  "content": "actual typed text",
  "urls": "https://mail.google.com?user=john@example.com"
}
```

## Future Enhancements

- User feedback on interventions (thumbs up/down)
- ML model to learn optimal thresholds per user
- Contextual awareness (time of day, day of week)
- Integration with calendar for meeting impact
- Personalized intervention styles based on preferences
- A/B testing different message formats

---

**Approval**: Ready for Implementation  
**Dependencies**: RFC-002 (Backend API), RFC-003 (WebSocket)

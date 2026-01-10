import type { Activity, Session } from '@flowstate/shared';

export interface DistractionPattern {
  type: 'context_switching' | 'social_media_spiral' | 'extended_idle' | 'fragmented_focus';
  severity: 'low' | 'medium' | 'high';
  description: string;
  metadata?: Record<string, any>;
}

export interface SessionSummary {
  duration: number; // minutes
  totalActivities: number;
  tabSwitchCount: number;
  typingBursts: number;
  idleTime: number; // seconds
  dominantUrls: Array<{ url: string; count: number }>;
}

/**
 * Prompt templates for Groq AI interactions
 * Following privacy-first principles: no actual content, only behavioral patterns
 */
export class PromptTemplates {
  /**
   * Generate a supportive real-time intervention message
   * Used with Llama 3.1 8B for fast responses
   */
  static realtimeIntervention(pattern: DistractionPattern): string {
    const severityContext = {
      low: 'slightly distracted',
      medium: 'experiencing some distraction',
      high: 'significantly distracted',
    };

    return `You are a supportive focus coach for a productivity app called Flowstate. A user is currently ${
      severityContext[pattern.severity]
    }.

Pattern detected: ${pattern.type.replace(/_/g, ' ')}
Description: ${pattern.description}

Generate a brief, supportive intervention message (2-3 sentences max) that:
1. Acknowledges what's happening without judgment
2. Gently encourages refocusing
3. Uses warm, conversational tone
4. Avoids being preachy or condescending
5. Offers a specific, actionable suggestion

Examples of good interventions:
- "I noticed you've been hopping between a few different sites. Want to take a quick breath and choose one thing to focus on for the next 10 minutes?"
- "Looks like you took a short break—perfect timing to reset. What's the one thing you want to accomplish next?"
- "You've been in the flow! Consider wrapping up this task before switching gears to keep your momentum."

Generate ONLY the intervention message, nothing else.`;
  }

  /**
   * Generate comprehensive post-session insights
   * Used with Llama 3.1 70B for deep analysis
   */
  static postSessionAnalysis(session: Session, activities: Activity[], summary: SessionSummary): string {
    const activityBreakdown = this.buildActivityBreakdown(activities);

    return `You are an expert focus coach analyzing a completed work session for Flowstate, a productivity intelligence app.

SESSION DATA (Privacy-safe behavioral patterns only):
- Duration: ${summary.duration} minutes
- Total activities logged: ${summary.totalActivities}
- Tab switches: ${summary.tabSwitchCount}
- Typing bursts: ${summary.typingBursts}
- Total idle time: ${Math.round(summary.idleTime / 60)} minutes
- Focus score: ${session.focusScore?.toFixed(1) || 'N/A'}

ACTIVITY BREAKDOWN:
${activityBreakdown}

TOP VISITED SITES (sanitized URLs, no personal data):
${summary.dominantUrls.map((u, i) => `${i + 1}. ${u.url} (${u.count} visits)`).join('\n')}

Generate a comprehensive analysis with the following structure:

# Session Summary
[1-2 sentences summarizing overall performance]

# What Went Well
[2-3 specific positive patterns, with data to back it up]

# Areas for Improvement
[2-3 specific challenges observed, framed constructively]

# Personalized Recommendations
[3-4 actionable techniques tailored to this user's patterns]

# Focus Fingerprint
[A unique insight about this user's work style based on patterns]

Use a warm, coaching tone. Be specific with data points but avoid overwhelming with numbers. Frame everything constructively—this is about growth, not judgment.

Generate the complete analysis in Markdown format.`;
  }

  /**
   * Generate technique recommendations based on detected patterns
   * Used with either model depending on urgency
   */
  static techniqueRecommendations(patterns: DistractionPattern[]): string {
    const patternSummary = patterns
      .map((p) => `- ${p.type.replace(/_/g, ' ')}: ${p.severity} severity`)
      .join('\n');

    return `You are a focus coach recommending specific techniques for a Flowstate user.

DETECTED PATTERNS:
${patternSummary}

Recommend 3-4 specific, evidence-based focus techniques that address these patterns. For each technique:

1. **Technique Name**
   - Why it helps: [1 sentence]
   - How to apply it: [2-3 sentences with concrete steps]
   - Expected benefit: [1 sentence]

Choose from techniques like:
- Pomodoro Technique (time-boxing)
- Time-blocking calendars
- "One Tab Rule" for deep work
- Batching similar tasks
- Implementation intentions
- Environment design
- Digital minimalism
- Attention restoration breaks
- Progressive focus building

Tailor recommendations to the specific patterns detected. Be practical and actionable.

Generate ONLY the recommendations in the format above, nothing else.`;
  }

  /**
   * Compare current session to historical performance
   * Used with Llama 3.1 70B for nuanced comparison
   */
  static comparativeAnalysis(
    currentSession: SessionSummary,
    historicalAverage: SessionSummary,
    trend: 'improving' | 'stable' | 'declining'
  ): string {
    return `You are analyzing performance trends for a Flowstate user.

CURRENT SESSION:
- Duration: ${currentSession.duration} min
- Tab switches: ${currentSession.tabSwitchCount}
- Idle time: ${Math.round(currentSession.idleTime / 60)} min
- Typing bursts: ${currentSession.typingBursts}

HISTORICAL AVERAGE (last 10 sessions):
- Duration: ${historicalAverage.duration} min
- Tab switches: ${historicalAverage.tabSwitchCount}
- Idle time: ${Math.round(historicalAverage.idleTime / 60)} min
- Typing bursts: ${historicalAverage.typingBursts}

OVERALL TREND: ${trend}

Generate a brief comparative insight (3-4 sentences) that:
1. Highlights the most significant change (positive or negative)
2. Provides context for what this means
3. Offers encouragement if improving, or supportive guidance if declining
4. Maintains a growth mindset framing

Be specific with numbers but focus on meaning, not just data.

Generate ONLY the comparative insight, nothing else.`;
  }

  /**
   * Helper: Build activity breakdown for prompts
   */
  private static buildActivityBreakdown(activities: Activity[]): string {
    const eventCounts = activities.reduce(
      (acc, activity) => {
        acc[activity.eventType] = (acc[activity.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(eventCounts)
      .map(([type, count]) => `- ${type.replace(/_/g, ' ')}: ${count}`)
      .join('\n');
  }

  /**
   * Generate a focus state description based on recent activity
   * Used for live session monitoring
   */
  static focusStateDescription(recentActivities: Activity[], timeWindowMinutes: number): string {
    const activitySummary = this.buildActivityBreakdown(recentActivities);

    return `Based on the last ${timeWindowMinutes} minutes of activity:

${activitySummary}

Provide a 1-sentence assessment of the user's current focus state. Choose from:
- "Deep focus" (steady typing, no tab switches, no idle)
- "Moderate focus" (mostly on task with occasional context switches)
- "Distracted" (frequent tab switches, low typing activity)
- "Idle/Break" (minimal activity detected)

Respond with ONLY the state and a brief justification (max 10 words). Format: "State: [state] - [justification]"`;
  }
}

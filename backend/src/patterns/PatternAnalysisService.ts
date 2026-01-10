import type { Activity, Session } from '@flowstate/shared';
import { PatternDetector, DEFAULT_PATTERN_CONFIG } from './PatternDetector.js';
import { FocusScoreCalculator, DEFAULT_FOCUS_SCORE_CONFIG } from './FocusScoreCalculator.js';
import type { DistractionPattern, SessionSummary } from '../ai/PromptTemplates.js';
import type { FocusScoreComponents } from './FocusScoreCalculator.js';

export interface PatternAnalysisResult {
  patterns: DistractionPattern[];
  focusScore: FocusScoreComponents;
  summary: SessionSummary;
  recommendations: string[];
}

export class PatternAnalysisService {
  private patternDetector: PatternDetector;
  private focusScoreCalculator: FocusScoreCalculator;

  constructor() {
    this.patternDetector = new PatternDetector(DEFAULT_PATTERN_CONFIG);
    this.focusScoreCalculator = new FocusScoreCalculator(DEFAULT_FOCUS_SCORE_CONFIG);
  }

  /**
   * Analyze a session and its activities for patterns and focus score
   */
  async analyzeSession(session: Session, activities: Activity[]): Promise<PatternAnalysisResult> {
    // Calculate session duration
    const endTime = session.endTime || new Date();
    const durationMs = endTime.getTime() - session.startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    // Detect patterns
    const patterns = this.patternDetector.detectPatterns(activities);

    // Calculate focus score
    const focusScore = this.focusScoreCalculator.calculate(activities, durationMs);

    // Build session summary
    const summary = this.buildSessionSummary(activities, durationMinutes);

    // Generate recommendations based on patterns
    const recommendations = this.generateRecommendations(patterns, focusScore);

    return {
      patterns,
      focusScore,
      summary,
      recommendations,
    };
  }

  /**
   * Analyze real-time activity stream (for live interventions)
   */
  async analyzeRealtime(recentActivities: Activity[]): Promise<DistractionPattern[]> {
    return this.patternDetector.detectPatterns(recentActivities);
  }

  /**
   * Build session summary for AI prompts
   */
  private buildSessionSummary(activities: Activity[], durationMinutes: number): SessionSummary {
    // Count event types
    const tabSwitchCount = activities.filter(
      (a) => a.eventType === 'tab_switch' || a.eventType === 'app_switch'
    ).length;

    const typingBursts = activities.filter((a) => a.eventType === 'typing').length;

    const idleEvents = activities.filter((a) => a.eventType === 'idle_end' && a.idleDuration);
    const totalIdleTime = idleEvents.reduce((sum, e) => sum + (e.idleDuration || 0), 0);

    // Get dominant URLs
    const urlCounts: Record<string, number> = {};
    activities
      .filter((a) => a.url)
      .forEach((a) => {
        const url = a.url!;
        urlCounts[url] = (urlCounts[url] || 0) + 1;
      });

    const dominantUrls = Object.entries(urlCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([url, count]) => ({ url, count }));

    return {
      duration: durationMinutes,
      totalActivities: activities.length,
      tabSwitchCount,
      typingBursts,
      idleTime: totalIdleTime,
      dominantUrls,
    };
  }

  /**
   * Generate actionable recommendations based on detected patterns
   */
  private generateRecommendations(
    patterns: DistractionPattern[],
    focusScore: FocusScoreComponents
  ): string[] {
    const recommendations: string[] = [];

    // Pattern-based recommendations
    if (patterns.some((p) => p.type === 'context_switching')) {
      recommendations.push('Try the "One Tab Rule": Keep only one work-related tab open at a time');
      recommendations.push('Use time-blocking: Dedicate 25-minute Pomodoro sessions to single tasks');
    }

    if (patterns.some((p) => p.type === 'social_media_spiral')) {
      recommendations.push('Use a website blocker during focus sessions (e.g., Freedom, Cold Turkey)');
      recommendations.push('Schedule specific "social media check" times instead of browsing throughout the day');
    }

    if (patterns.some((p) => p.type === 'extended_idle')) {
      recommendations.push('Set an "idle alert" to notify you after 5 minutes of inactivity');
      recommendations.push('If taking a break, explicitly start a break timer to separate work from rest');
    }

    if (patterns.some((p) => p.type === 'fragmented_focus')) {
      recommendations.push('Batch similar tasks together to reduce context switching');
      recommendations.push('Use "implementation intentions": Plan specific actions before starting work');
    }

    // Score-based recommendations
    if (focusScore.typingConsistency < 60) {
      recommendations.push('Build up to longer focus periods gradually (start with 15 minutes, increase weekly)');
    }

    if (focusScore.lowContextSwitching < 50) {
      recommendations.push('Close unnecessary browser tabs and apps before starting focused work');
    }

    if (focusScore.minimalIdle > 80 && focusScore.overall > 80) {
      recommendations.push("Great focus! Remember to take breaks to avoid burnout—your brain needs rest too");
    }

    // Default if no patterns detected
    if (recommendations.length === 0) {
      recommendations.push('Keep up the good work! Your focus patterns look healthy');
      recommendations.push('Consider tracking what time of day you focus best to optimize your schedule');
    }

    return recommendations.slice(0, 4); // Return top 4 recommendations
  }

  /**
   * Calculate trend compared to historical average
   */
  calculateTrend(currentScore: number, historicalAverage: number): 'improving' | 'stable' | 'declining' {
    const difference = currentScore - historicalAverage;
    const percentChange = (difference / historicalAverage) * 100;

    if (percentChange >= 10) return 'improving';
    if (percentChange <= -10) return 'declining';
    return 'stable';
  }
}

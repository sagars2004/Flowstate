import type { Session, Activity } from '@flowstate/shared';
import { InsightRepository } from '../repositories/InsightRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { AIService, type SessionInsights } from '../ai/index.js';
import { PatternAnalysisService } from '../patterns/PatternAnalysisService.js';
import { NotFoundError } from '../middleware/errors.js';

export interface FullSessionInsights {
  sessionId: string;
  focusScore: number;
  insights: SessionInsights;
  recommendations: string[];
  patterns: any[];
  statistics: any;
}

export class InsightsService {
  constructor(
    private insightRepository: InsightRepository,
    private activityRepository: ActivityRepository,
    private aiService: AIService | null,
    private patternAnalysisService: PatternAnalysisService
  ) {}

  /**
   * Generate comprehensive AI-powered insights for a completed session
   */
  async generateSessionInsights(session: Session): Promise<FullSessionInsights> {
    // Get activities
    const activities = await this.activityRepository.findBySessionId(session.id);

    if (activities.length === 0) {
      throw new Error('Cannot generate insights for session with no activities');
    }

    // Run pattern analysis
    const analysis = await this.patternAnalysisService.analyzeSession(session, activities);

    // Generate AI insights if available
    let aiInsights: SessionInsights | null = null;
    if (this.aiService) {
      try {
        aiInsights = await this.aiService.generateSessionInsights(
          session,
          activities,
          analysis.summary
        );
      } catch (error) {
        console.error('Failed to generate AI insights:', error);
        // Fall back to pattern-based recommendations
      }
    }

    // Combine pattern-based and AI-generated recommendations
    const recommendations = aiInsights
      ? this.extractRecommendationsFromInsights(aiInsights)
      : analysis.recommendations;

    // Store insights in database
    await this.saveInsights(session.id, aiInsights, recommendations);

    return {
      sessionId: session.id,
      focusScore: analysis.focusScore.overall,
      insights: aiInsights || this.createFallbackInsights(analysis),
      recommendations,
      patterns: analysis.patterns,
      statistics: analysis.summary,
    };
  }

  /**
   * Get stored insights for a session (if exists)
   */
  async getSessionInsights(sessionId: string): Promise<FullSessionInsights | null> {
    const storedInsight = await this.insightRepository.findLatestBySessionId(sessionId);

    if (!storedInsight) {
      return null;
    }

    const insightsData = JSON.parse(storedInsight.insightsJson);
    const recommendations = JSON.parse(storedInsight.recommendationsJson);

    return {
      sessionId,
      focusScore: 0, // Will be populated from session
      insights: insightsData,
      recommendations,
      patterns: [],
      statistics: {},
    };
  }

  /**
   * Get or generate insights (checks cache first)
   */
  async getOrGenerateInsights(session: Session): Promise<FullSessionInsights> {
    // Check if insights already exist
    const existing = await this.getSessionInsights(session.id);
    if (existing) {
      return existing;
    }

    // Generate new insights
    return await this.generateSessionInsights(session);
  }

  /**
   * Generate comparative insight vs historical sessions
   */
  async generateComparativeInsight(
    session: Session,
    historicalSessions: Session[]
  ): Promise<string> {
    if (!this.aiService || historicalSessions.length === 0) {
      return 'Not enough historical data for comparison';
    }

    // Get activities for current and historical sessions
    const currentActivities = await this.activityRepository.findBySessionId(session.id);
    const currentAnalysis = await this.patternAnalysisService.analyzeSession(session, currentActivities);

    // Calculate historical average focus score
    const historicalScores = historicalSessions
      .map((s) => s.focusScore)
      .filter((score): score is number => score !== null && score !== undefined);

    if (historicalScores.length === 0) {
      return 'No completed sessions with focus scores for comparison';
    }

    const avgHistoricalScore = historicalScores.reduce((sum, score) => sum + score, 0) / historicalScores.length;

    // Calculate historical activity averages
    const historicalActivityCounts = await Promise.all(
      historicalSessions.slice(0, 10).map(async (s) => {
        const acts = await this.activityRepository.findBySessionId(s.id);
        const duration = s.endTime
          ? s.endTime.getTime() - s.startTime.getTime()
          : Date.now() - s.startTime.getTime();
        return {
          duration: Math.round(duration / (1000 * 60)),
          tabSwitchCount: acts.filter((a) => a.eventType === 'tab_switch').length,
          typingBursts: acts.filter((a) => a.eventType === 'typing').length,
        };
      })
    );

    const avgHistoricalDuration =
      historicalActivityCounts.reduce((sum, h) => sum + h.duration, 0) / historicalActivityCounts.length;
    const avgHistoricalSwitches =
      historicalActivityCounts.reduce((sum, h) => sum + h.tabSwitchCount, 0) / historicalActivityCounts.length;

    // Determine trend
    const trend = this.patternAnalysisService.calculateTrend(
      currentAnalysis.focusScore.overall,
      avgHistoricalScore
    );

    // Generate AI comparative insight
    try {
      const comparativeInsight = await this.aiService.generateComparativeInsight(
        {
          duration: currentAnalysis.summary.duration,
          tabSwitchCount: currentAnalysis.summary.tabSwitchCount,
          typingBursts: currentAnalysis.summary.typingBursts,
          totalActivities: currentAnalysis.summary.totalActivities,
          idleTime: currentAnalysis.summary.idleTime,
          dominantUrls: currentAnalysis.summary.dominantUrls,
        },
        {
          duration: Math.round(avgHistoricalDuration),
          tabSwitchCount: Math.round(avgHistoricalSwitches),
          typingBursts: 0,
          totalActivities: 0,
          idleTime: 0,
          dominantUrls: [],
        },
        trend
      );

      return comparativeInsight.insight;
    } catch (error) {
      console.error('Failed to generate comparative insight:', error);
      return this.createFallbackComparison(currentAnalysis.focusScore.overall, avgHistoricalScore, trend);
    }
  }

  /**
   * Save insights to database
   */
  private async saveInsights(
    sessionId: string,
    insights: SessionInsights | null,
    recommendations: string[]
  ): Promise<void> {
    const insightsJson = JSON.stringify(insights || {});
    const recommendationsJson = JSON.stringify(recommendations);

    await this.insightRepository.create({
      sessionId,
      insightsJson,
      recommendationsJson,
    });
  }

  /**
   * Extract recommendations from AI insights
   */
  private extractRecommendationsFromInsights(insights: SessionInsights): string[] {
    // Parse recommendations section
    const recText = insights.recommendations;
    const recommendations: string[] = [];

    // Split by technique headers (looking for **Technique Name** pattern)
    const sections = recText.split(/\d+\.\s+\*\*/).filter((s) => s.trim());

    sections.forEach((section) => {
      const lines = section.split('\n').filter((l) => l.trim());
      if (lines.length > 0) {
        // Get technique name (first line, remove closing **)
        const techniqueName = lines[0].replace(/\*\*$/, '').trim();
        // Find "How to apply it" section
        const howToLine = lines.find((l) => l.includes('How to apply'));
        if (howToLine) {
          const idx = lines.indexOf(howToLine);
          if (idx >= 0 && idx + 1 < lines.length) {
            const howTo = lines[idx + 1].replace(/^-\s*/, '').trim();
            recommendations.push(`${techniqueName}: ${howTo}`);
          }
        }
      }
    });

    return recommendations.slice(0, 4); // Top 4 recommendations
  }

  /**
   * Create fallback insights when AI is unavailable
   */
  private createFallbackInsights(analysis: any): SessionInsights {
    return {
      summary: `Session completed with a focus score of ${analysis.focusScore.overall.toFixed(1)}. ${analysis.patterns.length > 0 ? `Detected ${analysis.patterns.length} distraction pattern(s).` : 'No significant distraction patterns detected.'}`,
      whatWentWell: analysis.focusScore.overall >= 70
        ? 'Maintained good focus throughout the session with consistent work patterns.'
        : 'Completed the session and logged activity data for analysis.',
      areasForImprovement: analysis.patterns.length > 0
        ? `Focus on reducing ${analysis.patterns[0].type.replace(/_/g, ' ')}.`
        : 'Continue monitoring patterns to identify areas for improvement.',
      recommendations: analysis.recommendations.join('\n\n'),
      focusFingerprint: this.generateFocusFingerprint(analysis.focusScore),
      generatedAt: new Date(),
    };
  }

  /**
   * Generate a focus fingerprint description
   */
  private generateFocusFingerprint(focusScore: any): string {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (focusScore.typingConsistency >= 70) strengths.push('consistent work rhythm');
    else weaknesses.push('inconsistent typing patterns');

    if (focusScore.lowContextSwitching >= 70) strengths.push('minimal context switching');
    else weaknesses.push('frequent task switching');

    if (focusScore.minimalIdle >= 70) strengths.push('high engagement');
    else weaknesses.push('extended idle periods');

    const primary = strengths.length > 0 ? strengths[0] : weaknesses[0];
    return `Your focus style is characterized by ${primary}. ${strengths.length >= 2 ? 'You work best with sustained attention on single tasks.' : 'Consider implementing techniques to maintain deeper focus.'}`;
  }

  /**
   * Create fallback comparison when AI is unavailable
   */
  private createFallbackComparison(currentScore: number, avgScore: number, trend: string): string {
    const diff = currentScore - avgScore;
    const pct = Math.abs((diff / avgScore) * 100).toFixed(0);

    if (trend === 'improving') {
      return `Great work! Your focus score of ${currentScore.toFixed(1)} is ${pct}% higher than your average of ${avgScore.toFixed(1)}. You're building stronger focus habits.`;
    } else if (trend === 'declining') {
      return `Your focus score of ${currentScore.toFixed(1)} is ${pct}% lower than your average of ${avgScore.toFixed(1)}. Consider what might be affecting your concentration recently.`;
    } else {
      return `Your focus score of ${currentScore.toFixed(1)} is consistent with your average of ${avgScore.toFixed(1)}. You're maintaining steady performance.`;
    }
  }
}

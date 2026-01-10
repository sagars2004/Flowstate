import { GroqClient } from './GroqClient.js';
import { PromptTemplates, DistractionPattern, SessionSummary } from './PromptTemplates.js';
import type { Activity, Session } from '@flowstate/shared';

export interface InterventionMessage {
  message: string;
  pattern: DistractionPattern;
  timestamp: Date;
}

export interface SessionInsights {
  summary: string;
  whatWentWell: string;
  areasForImprovement: string;
  recommendations: string;
  focusFingerprint: string;
  generatedAt: Date;
}

export interface ComparativeInsight {
  insight: string;
  trend: 'improving' | 'stable' | 'declining';
  generatedAt: Date;
}

export class AIService {
  constructor(private groqClient: GroqClient) {}

  /**
   * Generate real-time intervention message
   * Uses Llama 3.1 8B for fast response
   */
  async generateIntervention(pattern: DistractionPattern): Promise<InterventionMessage> {
    const prompt = PromptTemplates.realtimeIntervention(pattern);
    const message = await this.groqClient.generateFast(prompt, {
      maxTokens: 150,
      temperature: 0.7,
    });

    return {
      message: message.trim(),
      pattern,
      timestamp: new Date(),
    };
  }

  /**
   * Generate comprehensive post-session insights
   * Uses Llama 3.1 70B for deep analysis
   */
  async generateSessionInsights(
    session: Session,
    activities: Activity[],
    summary: SessionSummary
  ): Promise<SessionInsights> {
    const prompt = PromptTemplates.postSessionAnalysis(session, activities, summary);
    const fullAnalysis = await this.groqClient.generateDeep(prompt, {
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Parse the markdown response into sections
    const parsed = this.parseSessionAnalysis(fullAnalysis);

    return {
      ...parsed,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate technique recommendations
   * Uses Llama 3.1 8B for faster response
   */
  async generateTechniqueRecommendations(patterns: DistractionPattern[]): Promise<string> {
    const prompt = PromptTemplates.techniqueRecommendations(patterns);
    const recommendations = await this.groqClient.generateFast(prompt, {
      maxTokens: 800,
      temperature: 0.7,
    });

    return recommendations.trim();
  }

  /**
   * Generate comparative analysis against historical performance
   * Uses Llama 3.1 70B for nuanced comparison
   */
  async generateComparativeInsight(
    currentSession: SessionSummary,
    historicalAverage: SessionSummary,
    trend: 'improving' | 'stable' | 'declining'
  ): Promise<ComparativeInsight> {
    const prompt = PromptTemplates.comparativeAnalysis(currentSession, historicalAverage, trend);
    const insight = await this.groqClient.generateDeep(prompt, {
      maxTokens: 200,
      temperature: 0.7,
    });

    return {
      insight: insight.trim(),
      trend,
      generatedAt: new Date(),
    };
  }

  /**
   * Assess current focus state
   * Uses Llama 3.1 8B for quick assessment
   */
  async assessFocusState(recentActivities: Activity[], timeWindowMinutes: number): Promise<string> {
    const prompt = PromptTemplates.focusStateDescription(recentActivities, timeWindowMinutes);
    const state = await this.groqClient.generateFast(prompt, {
      maxTokens: 50,
      temperature: 0.3,
    });

    return state.trim();
  }

  /**
   * Helper: Parse markdown session analysis into structured sections
   */
  private parseSessionAnalysis(markdown: string): Omit<SessionInsights, 'generatedAt'> {
    const sections = {
      summary: '',
      whatWentWell: '',
      areasForImprovement: '',
      recommendations: '',
      focusFingerprint: '',
    };

    // Simple markdown parsing by section headers
    const lines = markdown.split('\n');
    let currentSection: keyof typeof sections | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('# Session Summary') || trimmed.startsWith('## Session Summary')) {
        currentSection = 'summary';
        continue;
      } else if (trimmed.startsWith('# What Went Well') || trimmed.startsWith('## What Went Well')) {
        currentSection = 'whatWentWell';
        continue;
      } else if (
        trimmed.startsWith('# Areas for Improvement') ||
        trimmed.startsWith('## Areas for Improvement')
      ) {
        currentSection = 'areasForImprovement';
        continue;
      } else if (
        trimmed.startsWith('# Personalized Recommendations') ||
        trimmed.startsWith('## Personalized Recommendations')
      ) {
        currentSection = 'recommendations';
        continue;
      } else if (
        trimmed.startsWith('# Focus Fingerprint') ||
        trimmed.startsWith('## Focus Fingerprint')
      ) {
        currentSection = 'focusFingerprint';
        continue;
      }

      if (currentSection && trimmed) {
        sections[currentSection] += line + '\n';
      }
    }

    // Clean up sections
    return {
      summary: sections.summary.trim() || 'No summary generated',
      whatWentWell: sections.whatWentWell.trim() || 'No insights generated',
      areasForImprovement: sections.areasForImprovement.trim() || 'No insights generated',
      recommendations: sections.recommendations.trim() || 'No recommendations generated',
      focusFingerprint: sections.focusFingerprint.trim() || 'No fingerprint generated',
    };
  }
}

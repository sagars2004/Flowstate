import type { Activity } from '@flowstate/shared';

export interface FocusScoreComponents {
  typingConsistency: number; // 0-100
  lowContextSwitching: number; // 0-100
  minimalIdle: number; // 0-100
  siteFocus: number; // 0-100
  overall: number; // Weighted average
}

export interface FocusScoreConfig {
  weights: {
    typingConsistency: number;
    lowContextSwitching: number;
    minimalIdle: number;
    siteFocus: number;
  };
  productiveDomains: string[];
  distractingDomains: string[];
}

export const DEFAULT_FOCUS_SCORE_CONFIG: FocusScoreConfig = {
  weights: {
    typingConsistency: 0.4, // 40% - Most important for flow state
    lowContextSwitching: 0.3, // 30% - Second most important
    minimalIdle: 0.2, // 20% - Active engagement
    siteFocus: 0.1, // 10% - Least important (work varies)
  },
  productiveDomains: [
    'github.com',
    'stackoverflow.com',
    'docs.google.com',
    'notion.so',
    'figma.com',
    'vscode.dev',
    'replit.com',
    'codesandbox.io',
    'vercel.com',
    'netlify.com',
  ],
  distractingDomains: [
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'reddit.com',
    'tiktok.com',
    'youtube.com',
    'netflix.com',
    'twitch.tv',
  ],
};

export class FocusScoreCalculator {
  constructor(private config: FocusScoreConfig = DEFAULT_FOCUS_SCORE_CONFIG) {}

  /**
   * Calculate comprehensive focus score for a session
   */
  calculate(activities: Activity[], sessionDurationMs: number): FocusScoreComponents {
    const typingConsistency = this.calculateTypingConsistency(activities);
    const lowContextSwitching = this.calculateLowContextSwitching(activities, sessionDurationMs);
    const minimalIdle = this.calculateMinimalIdle(activities, sessionDurationMs);
    const siteFocus = this.calculateSiteFocus(activities);

    const overall =
      typingConsistency * this.config.weights.typingConsistency +
      lowContextSwitching * this.config.weights.lowContextSwitching +
      minimalIdle * this.config.weights.minimalIdle +
      siteFocus * this.config.weights.siteFocus;

    return {
      typingConsistency,
      lowContextSwitching,
      minimalIdle,
      siteFocus,
      overall: Math.round(overall * 10) / 10, // Round to 1 decimal
    };
  }

  /**
   * Calculate typing consistency score (steady rhythm = flow state)
   */
  private calculateTypingConsistency(activities: Activity[]): number {
    const typingEvents = activities.filter((a) => a.eventType === 'typing' && a.typingVelocity);

    if (typingEvents.length < 3) {
      return 50; // Not enough data, neutral score
    }

    // Calculate velocity variance (lower = more consistent)
    const velocities = typingEvents.map((a) => a.typingVelocity!);
    const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const variance =
      velocities.reduce((sum, v) => sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation (CV)
    const cv = avgVelocity > 0 ? stdDev / avgVelocity : 1;

    // Lower CV = higher score (more consistent typing)
    // CV of 0.2 or less = excellent (100)
    // CV of 0.5 or more = poor (0)
    const score = Math.max(0, Math.min(100, 100 - cv * 200));

    return Math.round(score);
  }

  /**
   * Calculate low context switching score (fewer switches = better focus)
   */
  private calculateLowContextSwitching(activities: Activity[], sessionDurationMs: number): number {
    const switches = activities.filter((a) => a.eventType === 'tab_switch' || a.eventType === 'app_switch');

    if (sessionDurationMs === 0) return 50;

    const sessionHours = sessionDurationMs / (1000 * 60 * 60);
    const switchesPerHour = switches.length / sessionHours;

    // Scoring:
    // 0-5 switches/hour = excellent (100)
    // 5-15 switches/hour = good (70-100)
    // 15-30 switches/hour = moderate (40-70)
    // 30+ switches/hour = poor (0-40)

    if (switchesPerHour <= 5) return 100;
    if (switchesPerHour <= 15) return Math.round(100 - (switchesPerHour - 5) * 3);
    if (switchesPerHour <= 30) return Math.round(70 - (switchesPerHour - 15) * 2);
    return Math.max(0, Math.round(40 - (switchesPerHour - 30)));
  }

  /**
   * Calculate minimal idle score (active = better, but breaks are OK)
   */
  private calculateMinimalIdle(activities: Activity[], sessionDurationMs: number): number {
    const idleEvents = activities.filter((a) => a.eventType === 'idle_end' && a.idleDuration);

    const totalIdleSeconds = idleEvents.reduce((sum, e) => sum + (e.idleDuration || 0), 0);
    const sessionSeconds = sessionDurationMs / 1000;

    if (sessionSeconds === 0) return 50;

    const idlePercentage = (totalIdleSeconds / sessionSeconds) * 100;

    // Scoring:
    // 0-10% idle = excellent (100)
    // 10-20% idle = good (80-100) - healthy breaks
    // 20-40% idle = moderate (50-80)
    // 40%+ idle = poor (0-50)

    if (idlePercentage <= 10) return 100;
    if (idlePercentage <= 20) return Math.round(100 - (idlePercentage - 10));
    if (idlePercentage <= 40) return Math.round(80 - (idlePercentage - 20) * 1.5);
    return Math.max(0, Math.round(50 - (idlePercentage - 40) * 1.25));
  }

  /**
   * Calculate site focus score (time on productive vs distracting sites)
   */
  private calculateSiteFocus(activities: Activity[]): number {
    const urlActivities = activities.filter((a) => a.url);

    if (urlActivities.length === 0) return 50; // No data

    let productiveCount = 0;
    let distractingCount = 0;
    let neutralCount = 0;

    urlActivities.forEach((activity) => {
      const url = activity.url!;
      const isProductive = this.config.productiveDomains.some((d) => url.includes(d));
      const isDistracting = this.config.distractingDomains.some((d) => url.includes(d));

      if (isProductive) productiveCount++;
      else if (isDistracting) distractingCount++;
      else neutralCount++;
    });

    // Calculate ratio
    const total = urlActivities.length;
    const productiveRatio = productiveCount / total;
    const distractingRatio = distractingCount / total;

    // Score based on balance
    // High productive, low distracting = 100
    // Balanced or neutral = 70
    // High distracting = 0-30

    if (distractingRatio > 0.5) {
      // Mostly distracting
      return Math.round(30 * (1 - distractingRatio));
    }

    if (productiveRatio > 0.7) {
      // Highly productive
      return 100;
    }

    if (productiveRatio > 0.4) {
      // Good balance
      return Math.round(70 + productiveRatio * 30);
    }

    // Neutral or mixed
    return Math.round(50 + productiveRatio * 40);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FocusScoreConfig>): void {
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
    if (config.productiveDomains) {
      this.config.productiveDomains = config.productiveDomains;
    }
    if (config.distractingDomains) {
      this.config.distractingDomains = config.distractingDomains;
    }
  }
}

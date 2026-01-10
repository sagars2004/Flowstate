import type { Activity } from '@flowstate/shared';
import type { DistractionPattern } from '../ai/PromptTemplates.js';

export interface PatternDetectionConfig {
  contextSwitchWindow: number; // milliseconds
  contextSwitchThreshold: number; // number of switches
  socialMediaDomains: string[];
  idleThresholdShort: number; // seconds
  idleThresholdExtended: number; // seconds
  fragmentedFocusWindow: number; // milliseconds
  fragmentedFocusThreshold: number; // number of short bursts
}

export const DEFAULT_PATTERN_CONFIG: PatternDetectionConfig = {
  contextSwitchWindow: 5 * 60 * 1000, // 5 minutes
  contextSwitchThreshold: 8, // 8+ switches in 5 min = distracted
  socialMediaDomains: [
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'reddit.com',
    'tiktok.com',
    'youtube.com',
    'linkedin.com',
  ],
  idleThresholdShort: 30, // 30 seconds
  idleThresholdExtended: 300, // 5 minutes
  fragmentedFocusWindow: 10 * 60 * 1000, // 10 minutes
  fragmentedFocusThreshold: 10, // 10+ short bursts = fragmented
};

export class PatternDetector {
  constructor(private config: PatternDetectionConfig = DEFAULT_PATTERN_CONFIG) {}

  /**
   * Analyze activities and detect all distraction patterns
   */
  detectPatterns(activities: Activity[]): DistractionPattern[] {
    const patterns: DistractionPattern[] = [];

    // Detect context switching
    const contextSwitching = this.detectContextSwitching(activities);
    if (contextSwitching) {
      patterns.push(contextSwitching);
    }

    // Detect social media spirals
    const socialMediaSpiral = this.detectSocialMediaSpiral(activities);
    if (socialMediaSpiral) {
      patterns.push(socialMediaSpiral);
    }

    // Detect extended idle periods
    const extendedIdle = this.detectExtendedIdle(activities);
    if (extendedIdle) {
      patterns.push(extendedIdle);
    }

    // Detect fragmented focus
    const fragmentedFocus = this.detectFragmentedFocus(activities);
    if (fragmentedFocus) {
      patterns.push(fragmentedFocus);
    }

    return patterns;
  }

  /**
   * Detect excessive context switching (rapid tab/app switching)
   */
  private detectContextSwitching(activities: Activity[]): DistractionPattern | null {
    const now = Date.now();
    const windowStart = now - this.config.contextSwitchWindow;

    // Get recent tab switches
    const recentSwitches = activities.filter(
      (a) =>
        (a.eventType === 'tab_switch' || a.eventType === 'app_switch') &&
        a.timestamp.getTime() > windowStart
    );

    if (recentSwitches.length < this.config.contextSwitchThreshold) {
      return null;
    }

    // Calculate unique URLs
    const uniqueUrls = new Set(recentSwitches.map((a) => a.url).filter(Boolean));
    const severity = this.calculateSeverity(recentSwitches.length, this.config.contextSwitchThreshold);

    return {
      type: 'context_switching',
      severity,
      description: `${recentSwitches.length} tab switches in ${this.config.contextSwitchWindow / 60000} minutes across ${uniqueUrls.size} different sites`,
      metadata: {
        switchCount: recentSwitches.length,
        uniqueUrls: uniqueUrls.size,
        windowMinutes: this.config.contextSwitchWindow / 60000,
      },
    };
  }

  /**
   * Detect social media spiral (repeated visits to social platforms)
   */
  private detectSocialMediaSpiral(activities: Activity[]): DistractionPattern | null {
    const now = Date.now();
    const windowStart = now - this.config.contextSwitchWindow;

    // Get recent social media visits
    const socialMediaVisits = activities.filter((a) => {
      if (!a.url || a.timestamp.getTime() <= windowStart) return false;
      return this.config.socialMediaDomains.some((domain) => a.url?.includes(domain));
    });

    if (socialMediaVisits.length < 3) {
      return null; // Need at least 3 visits to be a "spiral"
    }

    // Group by domain
    const domainCounts: Record<string, number> = {};
    socialMediaVisits.forEach((visit) => {
      const domain = this.config.socialMediaDomains.find((d) => visit.url?.includes(d));
      if (domain) {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
    });

    const dominantDomain = Object.keys(domainCounts).reduce((a, b) =>
      domainCounts[a] > domainCounts[b] ? a : b
    );

    const severity = socialMediaVisits.length >= 10 ? 'high' : socialMediaVisits.length >= 5 ? 'medium' : 'low';

    return {
      type: 'social_media_spiral',
      severity,
      description: `${socialMediaVisits.length} visits to social media (${dominantDomain}: ${domainCounts[dominantDomain]} times) in ${this.config.contextSwitchWindow / 60000} minutes`,
      metadata: {
        totalVisits: socialMediaVisits.length,
        domainCounts,
        dominantDomain,
        windowMinutes: this.config.contextSwitchWindow / 60000,
      },
    };
  }

  /**
   * Detect extended idle periods
   */
  private detectExtendedIdle(activities: Activity[]): DistractionPattern | null {
    // Find most recent idle_end event
    const idleEndEvents = activities
      .filter((a) => a.eventType === 'idle_end' && a.idleDuration)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (idleEndEvents.length === 0) return null;

    const mostRecentIdle = idleEndEvents[0];
    const idleDuration = mostRecentIdle.idleDuration!;

    // Only report if idle period was significant
    if (idleDuration < this.config.idleThresholdShort) {
      return null;
    }

    const severity =
      idleDuration >= this.config.idleThresholdExtended
        ? 'high'
        : idleDuration >= 120
          ? 'medium'
          : 'low';

    return {
      type: 'extended_idle',
      severity,
      description: `Idle for ${Math.round(idleDuration / 60)} minutes`,
      metadata: {
        idleDurationSeconds: idleDuration,
        idleDurationMinutes: Math.round(idleDuration / 60),
      },
    };
  }

  /**
   * Detect fragmented focus (many short typing bursts instead of sustained work)
   */
  private detectFragmentedFocus(activities: Activity[]): DistractionPattern | null {
    const now = Date.now();
    const windowStart = now - this.config.fragmentedFocusWindow;

    // Get recent activities in window
    const recentActivities = activities.filter((a) => a.timestamp.getTime() > windowStart);

    // Count typing events
    const typingEvents = recentActivities.filter((a) => a.eventType === 'typing');
    const tabSwitches = recentActivities.filter((a) => a.eventType === 'tab_switch');

    // Fragmented focus = lots of switches relative to typing
    const switchToTypingRatio = typingEvents.length > 0 ? tabSwitches.length / typingEvents.length : 0;

    // Need significant activity to detect pattern
    if (typingEvents.length < 5 || tabSwitches.length < this.config.fragmentedFocusThreshold) {
      return null;
    }

    // High ratio = fragmented (switching more than typing)
    if (switchToTypingRatio < 0.5) {
      return null; // Good focus
    }

    const severity = switchToTypingRatio >= 1.5 ? 'high' : switchToTypingRatio >= 0.8 ? 'medium' : 'low';

    return {
      type: 'fragmented_focus',
      severity,
      description: `Work fragmented across ${tabSwitches.length} context switches with ${typingEvents.length} typing bursts in ${this.config.fragmentedFocusWindow / 60000} minutes`,
      metadata: {
        typingBursts: typingEvents.length,
        contextSwitches: tabSwitches.length,
        ratio: switchToTypingRatio,
        windowMinutes: this.config.fragmentedFocusWindow / 60000,
      },
    };
  }

  /**
   * Calculate severity based on how much threshold was exceeded
   */
  private calculateSeverity(
    actual: number,
    threshold: number
  ): 'low' | 'medium' | 'high' {
    const ratio = actual / threshold;
    if (ratio >= 2.0) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PatternDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Idle detection module
 * Monitors user idle state using Chrome's idle API
 */

import type { ActivityLogPayload } from '@flowstate/shared';

const IDLE_THRESHOLD = 30; // 30 seconds of idle time

export class IdleDetector {
  private isIdle = false;
  private idleStartTime: number | null = null;
  private readonly onActivityCallback: (payload: ActivityLogPayload) => void;
  private readonly sessionId: string;

  constructor(
    sessionId: string,
    onActivityCallback: (payload: ActivityLogPayload) => void
  ) {
    this.sessionId = sessionId;
    this.onActivityCallback = onActivityCallback;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen for idle state changes
    chrome.idle.onStateChanged.addListener((newState: chrome.idle.IdleState) => {
      const now = Date.now();

      if (newState === 'idle' || newState === 'locked') {
        if (!this.isIdle) {
          this.isIdle = true;
          this.idleStartTime = now;

          this.logActivity({
            eventType: 'idle_start',
            timestamp: now,
            metadata: {
              state: newState,
            },
          });
        }
      } else if (newState === 'active') {
        if (this.isIdle) {
          const idleDuration = this.idleStartTime
            ? now - this.idleStartTime
            : 0;

          // Only log if idle duration exceeds threshold
          if (idleDuration >= IDLE_THRESHOLD * 1000) {
            this.logActivity({
              eventType: 'idle_end',
              timestamp: now,
              metadata: {
                idleDuration,
                idleDurationSeconds: Math.floor(idleDuration / 1000),
              },
            });
          }

          this.isIdle = false;
          this.idleStartTime = null;
        }
      }
    });

    // Check idle state periodically (Chrome requires this)
    chrome.idle.setDetectionInterval(IDLE_THRESHOLD);
  }

  private logActivity(payload: Omit<ActivityLogPayload, 'sessionId'>): void {
    this.onActivityCallback({
      ...payload,
      sessionId: this.sessionId,
    });
  }

  destroy(): void {
    // Cleanup - Chrome will handle listener removal
    this.isIdle = false;
    this.idleStartTime = null;
  }

  getCurrentIdleState(): { isIdle: boolean; idleDuration: number | null } {
    return {
      isIdle: this.isIdle,
      idleDuration: this.idleStartTime ? Date.now() - this.idleStartTime : null,
    };
  }
}

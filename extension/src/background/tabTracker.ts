/**
 * Tab tracking module
 * Monitors tab switches and URL changes
 */

import { sanitizeURL } from '../utils/urlSanitizer.js';
import type { ActivityLogPayload } from '@flowstate/shared';

export class TabTracker {
  private currentTabId: number | null = null;
  private currentURL: string | null = null;
  private lastTabSwitchTime: number = 0;
  private tabSwitchBuffer: Array<{ timestamp: number; url: string }> = [];
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
    // Track tab updates (URL changes)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.url) {
        this.handleURLChange(tabId, tab.url);
      }
    });

    // Track tab activation (switching between tabs)
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo.tabId);
    });

    // Track window focus/blur
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        this.handleWindowBlur();
      } else {
        this.handleWindowFocus(windowId);
      }
    });
  }

  private async handleURLChange(tabId: number, url: string): Promise<void> {
    const sanitizedURL = sanitizeURL(url);

    // Only log if this is the active tab
    if (tabId === this.currentTabId) {
      const now = Date.now();

      // Check if this is a rapid switch (within 1 second of last switch)
      if (now - this.lastTabSwitchTime < 1000) {
        // Buffer rapid switches and aggregate
        this.tabSwitchBuffer.push({ timestamp: now, url: sanitizedURL });
      } else {
        // Flush buffer if exists and log new switch
        if (this.tabSwitchBuffer.length > 0) {
          this.flushTabSwitchBuffer();
        }

        this.logActivity({
          eventType: 'url_change',
          timestamp: now,
          metadata: {
            tabId,
            url: sanitizedURL,
            previousURL: this.currentURL,
          },
        });

        this.currentURL = sanitizedURL;
        this.lastTabSwitchTime = now;
      }
    }
  }

  private async handleTabActivated(tabId: number): Promise<void> {
    const now = Date.now();
    const previousTabId = this.currentTabId;
    this.currentTabId = tabId;

    // Get the active tab's URL
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const sanitizedURL = sanitizeURL(tab.url);
        this.currentURL = sanitizedURL;

        if (previousTabId !== null && previousTabId !== tabId) {
          this.logActivity({
            eventType: 'tab_switch',
            timestamp: now,
            metadata: {
              fromTabId: previousTabId,
              toTabId: tabId,
              url: sanitizedURL,
            },
          });

          this.lastTabSwitchTime = now;
        } else {
          // First tab activation
          this.logActivity({
            eventType: 'tab_activated',
            timestamp: now,
            metadata: {
              tabId,
              url: sanitizedURL,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error getting tab info:', error);
    }
  }

  private handleWindowFocus(windowId: number): void {
    this.logActivity({
      eventType: 'window_focus',
      timestamp: Date.now(),
      metadata: { windowId },
    });
  }

  private handleWindowBlur(): void {
    this.logActivity({
      eventType: 'window_blur',
      timestamp: Date.now(),
      metadata: {},
    });
  }

  private flushTabSwitchBuffer(): void {
    if (this.tabSwitchBuffer.length === 0) {
      return;
    }

    // Aggregate rapid tab switches
    const firstItem = this.tabSwitchBuffer[0];
    if (!firstItem) {
      return;
    }

    const uniqueURLs = new Set(this.tabSwitchBuffer.map((item) => item.url));
    const switchCount = this.tabSwitchBuffer.length;

    this.logActivity({
      eventType: 'tab_switch',
      timestamp: firstItem.timestamp,
      metadata: {
        rapidSwitch: true,
        switchCount,
        uniqueURLs: Array.from(uniqueURLs),
      },
    });

    this.tabSwitchBuffer = [];
  }

  private logActivity(payload: Omit<ActivityLogPayload, 'sessionId'>): void {
    this.onActivityCallback({
      ...payload,
      sessionId: this.sessionId,
    });
  }

  destroy(): void {
    // Cleanup handled by Chrome automatically when service worker terminates
    // But we can clear any pending state
    this.tabSwitchBuffer = [];
    this.currentTabId = null;
    this.currentURL = null;
  }
}

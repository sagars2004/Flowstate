/**
 * Service Worker (Background Script) for Flowstate Extension
 * Coordinates tab tracking, idle detection, typing metrics, and WebSocket communication
 */

import { WebSocketClient } from './webSocketClient.js';
import { TabTracker } from './tabTracker.js';
import { IdleDetector } from './idleDetector.js';
import { EventBatcher } from '../utils/eventBatcher.js';
import type { ActivityLogPayload, SessionStartPayload } from '@flowstate/shared';

const TYPING_BATCH_INTERVAL = 10000; // 10 seconds

let wsClient: WebSocketClient | null = null;
let tabTracker: TabTracker | null = null;
let idleDetector: IdleDetector | null = null;
let typingVelocityBatcher: EventBatcher<ActivityLogPayload> | null = null;
let currentSessionId: string | null = null;

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Flowstate extension installed');
  initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Flowstate extension started');
  initializeExtension();
});

async function initializeExtension(): Promise<void> {
  // Restore session state from storage
  const storageData = await chrome.storage.local.get(['sessionId', 'sessionStartTime']);
  currentSessionId = storageData.sessionId || null;

  // Initialize WebSocket client
  wsClient = new WebSocketClient();

  // If there's an active session, resume tracking
  if (currentSessionId) {
    await resumeSession(currentSessionId);
  }

  // Set up periodic heartbeat using alarms (not setInterval - service workers can be terminated)
  chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat') {
    if (wsClient && !wsClient.isConnected()) {
      await wsClient.connect();
    }
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TYPING_VELOCITY') {
    handleTypingVelocity(message.payload);
    sendResponse({ success: true });
    return true; // Keep message channel open for async response
  }

  return false;
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_SESSION') {
    startSession().then((sessionId) => {
      sendResponse({ success: true, sessionId });
    });
    return true;
  }

  if (message.type === 'END_SESSION') {
    endSession().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_SESSION_STATUS') {
    sendResponse({
      sessionId: currentSessionId,
      isActive: currentSessionId !== null,
      wsConnected: wsClient?.isConnected() ?? false,
    });
    return false;
  }

  return false;
});

async function startSession(): Promise<string | null> {
  if (currentSessionId) {
    console.warn('Session already active:', currentSessionId);
    return currentSessionId;
  }

  const sessionId = generateSessionId();
  const startTime = Date.now();

  currentSessionId = sessionId;

  // Store session state
  await chrome.storage.local.set({
    sessionId,
    sessionStartTime: startTime,
  });

  // Initialize tracking components
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }

  // Wait for WebSocket connection
  if (!wsClient.isConnected()) {
    await wsClient.connect();
    // Wait a bit for connection (with timeout)
    await waitForConnection(5000);
  }

  // Start session on backend
  const sessionStartPayload: SessionStartPayload = {
    sessionId,
    startTime,
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
  };

  wsClient.startSession(sessionStartPayload);

  // Initialize trackers
  tabTracker = new TabTracker(sessionId, (payload) => {
    if (wsClient) {
      wsClient.logActivity(payload);
    }
  });

  idleDetector = new IdleDetector(sessionId, (payload) => {
    if (wsClient) {
      wsClient.logActivity(payload);
    }
  });

  // Initialize typing velocity batcher (use alarms in service worker)
  typingVelocityBatcher = new EventBatcher<ActivityLogPayload>(
    (events) => {
      // Flush batch of typing events
      events.forEach((event) => {
        if (wsClient) {
          wsClient.logActivity(event);
        }
      });
    },
    TYPING_BATCH_INTERVAL,
    50, // maxBatchSize
    true, // useAlarms for service worker
    'typingVelocity_flush' // unique alarm name
  );

  console.log('Session started:', sessionId);
  return sessionId;
}

async function endSession(): Promise<void> {
  if (!currentSessionId || !wsClient) {
    return;
  }

  const endTime = Date.now();

  // Flush any pending typing metrics
  if (typingVelocityBatcher) {
    typingVelocityBatcher.flush();
    typingVelocityBatcher = null;
  }

  // End session on backend
  wsClient.endSession({
    sessionId: currentSessionId,
    endTime,
  });

  // Cleanup trackers
  if (tabTracker) {
    tabTracker.destroy();
    tabTracker = null;
  }

  if (idleDetector) {
    idleDetector.destroy();
    idleDetector = null;
  }

  // Clear session state
  await chrome.storage.local.remove(['sessionId', 'sessionStartTime']);
  currentSessionId = null;

  console.log('Session ended');
}

async function resumeSession(sessionId: string): Promise<void> {
  // Reinitialize components for existing session
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }

  if (!wsClient.isConnected()) {
    await wsClient.connect();
    await waitForConnection(5000);
  }

  tabTracker = new TabTracker(sessionId, (payload) => {
    if (wsClient) {
      wsClient.logActivity(payload);
    }
  });

  idleDetector = new IdleDetector(sessionId, (payload) => {
    if (wsClient) {
      wsClient.logActivity(payload);
    }
  });

  typingVelocityBatcher = new EventBatcher<ActivityLogPayload>(
    (events) => {
      events.forEach((event) => {
        if (wsClient) {
          wsClient.logActivity(event);
        }
      });
    },
    TYPING_BATCH_INTERVAL,
    50, // maxBatchSize
    true, // useAlarms for service worker
    'typingVelocity_flush_resume' // unique alarm name for resumed session
  );
}

function handleTypingVelocity(payload: {
  velocity: number;
  keypressCount: number;
  timestamp: number;
  windowDuration: number;
}): void {
  if (!currentSessionId || !typingVelocityBatcher) {
    return;
  }

  const activityPayload: ActivityLogPayload = {
    sessionId: currentSessionId,
    eventType: 'typing',
    timestamp: payload.timestamp,
    metadata: {
      velocity: payload.velocity,
      keypressCount: payload.keypressCount,
      windowDuration: payload.windowDuration,
    },
  };

  typingVelocityBatcher.add(activityPayload);
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function waitForConnection(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (wsClient?.isConnected()) {
      resolve();
      return;
    }

    const checkInterval = setInterval(() => {
      if (wsClient?.isConnected()) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(); // Resolve even if not connected (timeout)
    }, timeout);
  });
}

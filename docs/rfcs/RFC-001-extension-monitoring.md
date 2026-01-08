# RFC-001: Extension Monitoring System

**Status**: Approved  
**Created**: January 8, 2026  
**Author**: Flowstate Team  
**Related Features**: Extension Monitoring System

## Overview

This RFC defines the Chrome Extension (Manifest V3) architecture for passive behavioral monitoring. The extension captures typing velocity, tab switches, idle periods, and active window state—all without recording actual content typed or full URLs with personal data.

## Purpose

Enable non-intrusive background monitoring of user activity to provide behavioral metadata for AI-powered pattern recognition and interventions, while maintaining strict privacy guarantees.

## Technical Approach

### Manifest V3 Architecture

Chrome Manifest V3 introduces service workers instead of persistent background pages, requiring adaptation of traditional extension patterns.

#### Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Flowstate",
  "version": "1.0.0",
  "description": "AI-powered focus companion for deep work",
  "permissions": [
    "tabs",
    "idle",
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/serviceWorker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/contentScript.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  }
}
```

#### Permission Justifications

- **tabs**: Required for tab tracking (URL changes, active tab detection)
- **idle**: Required for idle state detection
- **storage**: Required for local state persistence (session ID, settings)
- **alarms**: Required for periodic tasks in service worker (replaces setInterval)
- **host_permissions**: Required to inject content scripts for typing detection

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Chrome Extension                        │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Service Worker (Background)               │  │
│  │  - Tab tracking                                   │  │
│  │  - Idle detection                                 │  │
│  │  - WebSocket client to backend                    │  │
│  │  - Activity event coordinator                     │  │
│  └─────────────┬─────────────────┬───────────────────┘  │
│                │                 │                       │
│  ┌─────────────▼──────┐    ┌─────▼────────────────┐    │
│  │   Content Scripts  │    │   Popup UI           │    │
│  │  - Typing velocity │    │  - Start/End session │    │
│  │  - Keypress events │    │  - Session status    │    │
│  └────────────────────┘    └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Service Worker (Background Monitoring)

#### Lifecycle Management

Service workers can be terminated by Chrome at any time. Must handle:
- State persistence using `chrome.storage.local`
- Reconnection logic for WebSocket
- Event listener registration on startup

```typescript
// background/serviceWorker.ts
import { WebSocketClient } from './webSocketClient';
import { TabTracker } from './tabTracker';
import { IdleDetector } from './idleDetector';

let wsClient: WebSocketClient;
let tabTracker: TabTracker;
let idleDetector: IdleDetector;
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
  const { sessionId } = await chrome.storage.local.get('sessionId');
  currentSessionId = sessionId || null;

  // Initialize components
  wsClient = new WebSocketClient('ws://localhost:3001');
  tabTracker = new TabTracker(wsClient);
  idleDetector = new IdleDetector(wsClient);

  // Connect to backend
  await wsClient.connect();

  // Set up periodic heartbeat using alarms (not setInterval)
  chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    wsClient.sendHeartbeat();
  }
});
```

#### Tab Tracking

```typescript
// background/tabTracker.ts
export class TabTracker {
  private currentTabId: number | null = null;
  private currentTabStartTime: number = 0;

  constructor(private wsClient: WebSocketClient) {
    this.setupListeners();
  }

  private setupListeners(): void {
    // Track tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabSwitch(activeInfo.tabId);
    });

    // Track tab URL updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tabId === this.currentTabId) {
        this.handleURLChange(changeInfo.url);
      }
    });

    // Track window focus changes
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        this.handleWindowBlur();
      } else {
        this.handleWindowFocus();
      }
    });
  }

  private async handleTabSwitch(tabId: number): Promise<void> {
    const now = Date.now();

    // Log time spent on previous tab
    if (this.currentTabId !== null) {
      const timeSpent = now - this.currentTabStartTime;
      await this.logActivity('tab_switch', {
        previousTabId: this.currentTabId,
        newTabId: tabId,
        timeSpent
      });
    }

    this.currentTabId = tabId;
    this.currentTabStartTime = now;

    // Get URL of new tab
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      await this.logActivity('tab_activated', {
        url: this.sanitizeURL(tab.url),
        title: tab.title
      });
    }
  }

  private async handleURLChange(url: string): Promise<void> {
    await this.logActivity('url_change', {
      url: this.sanitizeURL(url)
    });
  }

  private async handleWindowBlur(): Promise<void> {
    await this.logActivity('window_blur', {
      timestamp: Date.now()
    });
  }

  private async handleWindowFocus(): Promise<void> {
    await this.logActivity('window_focus', {
      timestamp: Date.now()
    });
  }

  private sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      // Only keep protocol, hostname, and pathname (no query params or hash)
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }

  private async logActivity(eventType: string, metadata: Record<string, unknown>): Promise<void> {
    const { sessionId } = await chrome.storage.local.get('sessionId');
    if (!sessionId) return; // No active session

    await this.wsClient.sendActivity({
      sessionId,
      eventType,
      timestamp: Date.now(),
      metadata
    });
  }
}
```

#### Idle Detection

```typescript
// background/idleDetector.ts
export class IdleDetector {
  private idleThresholdSeconds = 30;
  private currentState: 'active' | 'idle' | 'locked' = 'active';
  private idleStartTime: number | null = null;

  constructor(private wsClient: WebSocketClient) {
    this.setupListeners();
  }

  private setupListeners(): void {
    // Set detection interval (30 seconds)
    chrome.idle.setDetectionInterval(this.idleThresholdSeconds);

    // Listen for state changes
    chrome.idle.onStateChanged.addListener((newState: chrome.idle.IdleState) => {
      this.handleStateChange(newState);
    });
  }

  private async handleStateChange(newState: chrome.idle.IdleState): Promise<void> {
    const now = Date.now();
    const previousState = this.currentState;
    this.currentState = newState;

    if (newState === 'idle' || newState === 'locked') {
      // User went idle
      this.idleStartTime = now;
      await this.logActivity('idle_start', {
        previousState,
        newState
      });
    } else if (newState === 'active' && this.idleStartTime !== null) {
      // User returned from idle
      const idleDuration = now - this.idleStartTime;
      await this.logActivity('idle_end', {
        duration: idleDuration,
        previousState
      });
      this.idleStartTime = null;
    }
  }

  private async logActivity(eventType: string, metadata: Record<string, unknown>): Promise<void> {
    const { sessionId } = await chrome.storage.local.get('sessionId');
    if (!sessionId) return;

    await this.wsClient.sendActivity({
      sessionId,
      eventType,
      timestamp: Date.now(),
      metadata
    });
  }
}
```

### 2. Content Scripts (Typing Detection)

Content scripts run in the context of web pages and can access the DOM but not chrome.* APIs directly.

```typescript
// content/contentScript.ts
interface TypingMetrics {
  startTime: number;
  keypressCount: number;
  lastKeypressTime: number;
}

class TypingVelocityTracker {
  private metrics: TypingMetrics = {
    startTime: 0,
    keypressCount: 0,
    lastKeypressTime: 0
  };

  private batchInterval = 10000; // Send batch every 10 seconds
  private batchTimer: number | null = null;

  constructor() {
    this.setupListeners();
    this.startBatching();
  }

  private setupListeners(): void {
    // Listen for keypress events (but don't capture the actual keys!)
    document.addEventListener('keypress', () => {
      this.handleKeypress();
    }, { passive: true });

    // Listen for typing start after idle
    document.addEventListener('keydown', () => {
      if (this.metrics.keypressCount === 0) {
        this.metrics.startTime = Date.now();
      }
    }, { passive: true, once: false });
  }

  private handleKeypress(): void {
    const now = Date.now();
    this.metrics.keypressCount++;
    this.metrics.lastKeypressTime = now;
  }

  private startBatching(): void {
    this.batchTimer = window.setInterval(() => {
      this.sendBatch();
    }, this.batchInterval);
  }

  private sendBatch(): void {
    if (this.metrics.keypressCount === 0) return; // No typing activity

    const now = Date.now();
    const duration = now - this.metrics.startTime;
    const velocity = (this.metrics.keypressCount / duration) * 60000; // CPM

    // Send to service worker via message passing
    chrome.runtime.sendMessage({
      type: 'TYPING_METRICS',
      payload: {
        velocity,
        duration,
        keypressCount: this.metrics.keypressCount,
        timestamp: now
      }
    });

    // Reset metrics
    this.metrics = {
      startTime: now,
      keypressCount: 0,
      lastKeypressTime: now
    };
  }
}

// Initialize tracker
new TypingVelocityTracker();
```

Service worker receives typing metrics:

```typescript
// background/serviceWorker.ts (add to initialization)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TYPING_METRICS') {
    handleTypingMetrics(message.payload, sender.tab?.id);
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

async function handleTypingMetrics(payload: any, tabId?: number): Promise<void> {
  const { sessionId } = await chrome.storage.local.get('sessionId');
  if (!sessionId) return;

  await wsClient.sendActivity({
    sessionId,
    eventType: 'typing',
    timestamp: payload.timestamp,
    metadata: {
      velocity: payload.velocity,
      duration: payload.duration,
      keypressCount: payload.keypressCount,
      tabId
    }
  });
}
```

### 3. Popup UI (Session Control)

```typescript
// popup/popup.ts
interface SessionState {
  sessionId: string | null;
  startTime: number | null;
  isActive: boolean;
}

class PopupController {
  private state: SessionState = {
    sessionId: null,
    startTime: null,
    isActive: false
  };

  constructor() {
    this.loadState();
    this.setupEventListeners();
    this.render();
  }

  private async loadState(): Promise<void> {
    const stored = await chrome.storage.local.get(['sessionId', 'startTime']);
    this.state.sessionId = stored.sessionId || null;
    this.state.startTime = stored.startTime || null;
    this.state.isActive = this.state.sessionId !== null;
    this.render();
  }

  private setupEventListeners(): void {
    document.getElementById('startButton')?.addEventListener('click', () => {
      this.startSession();
    });

    document.getElementById('endButton')?.addEventListener('click', () => {
      this.endSession();
    });
  }

  private async startSession(): Promise<void> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    // Store in extension storage
    await chrome.storage.local.set({ sessionId, startTime });

    // Notify service worker
    await chrome.runtime.sendMessage({
      type: 'START_SESSION',
      payload: { sessionId, startTime }
    });

    this.state = { sessionId, startTime, isActive: true };
    this.render();
  }

  private async endSession(): Promise<void> {
    if (!this.state.sessionId) return;

    // Notify service worker
    await chrome.runtime.sendMessage({
      type: 'END_SESSION',
      payload: { sessionId: this.state.sessionId }
    });

    // Clear storage
    await chrome.storage.local.remove(['sessionId', 'startTime']);

    this.state = { sessionId: null, startTime: null, isActive: false };
    this.render();
  }

  private render(): void {
    const startButton = document.getElementById('startButton') as HTMLButtonElement;
    const endButton = document.getElementById('endButton') as HTMLButtonElement;
    const statusDiv = document.getElementById('status');
    const timerDiv = document.getElementById('timer');

    if (this.state.isActive) {
      startButton.style.display = 'none';
      endButton.style.display = 'block';
      statusDiv!.textContent = 'Session Active';
      statusDiv!.className = 'status active';

      // Update timer every second
      this.updateTimer(timerDiv!);
    } else {
      startButton.style.display = 'block';
      endButton.style.display = 'none';
      statusDiv!.textContent = 'No Active Session';
      statusDiv!.className = 'status inactive';
      timerDiv!.textContent = '00:00:00';
    }
  }

  private updateTimer(timerDiv: HTMLElement): void {
    if (!this.state.startTime) return;

    const updateInterval = setInterval(() => {
      if (!this.state.isActive) {
        clearInterval(updateInterval);
        return;
      }

      const elapsed = Date.now() - this.state.startTime!;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);

      timerDiv.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
```

## Data Sanitization & Privacy

### URL Sanitization Rules

```typescript
function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove sensitive parts
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    // Query params (? ...) and hash (#...) are stripped
  } catch (error) {
    return 'invalid-url';
  }
}

// Examples:
// Input:  https://mail.google.com/mail/u/0/#inbox?sessionId=abc123
// Output: https://mail.google.com/mail/u/0/

// Input:  https://github.com/user/repo/issues/42?tab=comments
// Output: https://github.com/user/repo/issues/42
```

### Content Privacy Guarantee

**What is captured**:
- Keypress frequency (number of keypresses per time window)
- Typing velocity (calculated CPM)
- Typing duration (length of typing burst)

**What is NEVER captured**:
- Actual key values (which keys were pressed)
- Input field content
- Password fields
- Form data
- Clipboard content

```typescript
// ❌ WRONG: Never do this
document.addEventListener('keypress', (e) => {
  const key = e.key; // NEVER capture actual keys
});

// ✅ CORRECT: Only metadata
document.addEventListener('keypress', () => {
  keypressCount++; // Just count, don't capture content
});
```

## WebSocket Communication

### Connection Management

```typescript
// background/webSocketClient.ts
import { io, Socket } from 'socket.io-client';

export class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private url: string) {}

  async connect(): Promise<void> {
    this.socket = io(this.url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('intervention:send', (data) => {
      this.handleIntervention(data);
    });
  }

  async sendActivity(activity: ActivityPayload): Promise<void> {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, queuing activity');
      // TODO: Queue activities for later sending
      return;
    }

    this.socket.emit('activity:log', activity);
  }

  sendHeartbeat(): void {
    if (this.socket?.connected) {
      this.socket.emit('heartbeat', { timestamp: Date.now() });
    }
  }

  private handleIntervention(data: any): void {
    // Show browser notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Flowstate',
      message: data.message,
      priority: 2
    });
  }
}
```

## Testing Criteria

### Unit Tests
- [ ] URL sanitization removes query params and hash
- [ ] Typing velocity calculation is accurate
- [ ] Session ID generation is unique
- [ ] Event batching works correctly

### Integration Tests
- [ ] Tab switches are detected and logged
- [ ] Idle detection triggers at correct threshold
- [ ] Typing metrics are sent to backend
- [ ] WebSocket reconnects on disconnect
- [ ] Popup UI updates session state correctly

### Manual Testing
- [ ] Extension loads without errors in chrome://extensions
- [ ] Start session creates session ID in storage
- [ ] Tab switches generate activity events
- [ ] Typing on any page generates velocity metrics
- [ ] Going idle for 30+ seconds triggers idle event
- [ ] Returning from idle triggers idle_end event
- [ ] End session clears storage and notifies backend
- [ ] Popup shows correct session status

## Security Considerations

### Chrome Web Store Compliance
- No remote code execution
- All code bundled in extension
- Permissions clearly justified
- Privacy policy included

### Content Security Policy
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

### Data Minimization
- Only collect necessary behavioral metadata
- No personally identifiable information
- Local storage only (no cloud sync in MVP)

## Performance Considerations

### Service Worker Lifecycle
- Service worker may be terminated after 30 seconds of inactivity
- Use `chrome.alarms` for periodic tasks (persists across terminations)
- Store state in `chrome.storage.local` (persists across terminations)
- Reconnect WebSocket on service worker restart

### Event Batching
- Batch typing metrics every 10 seconds (not every keypress)
- Aggregate tab switch events within 1 second window
- Reduces network overhead and backend load

### Memory Management
- Limit in-memory activity queue size (max 100 events)
- Clear old data from storage periodically
- Unregister event listeners on session end

## Implementation Checklist

- [ ] Create manifest.json with Manifest V3 structure
- [ ] Implement service worker with tab tracking
- [ ] Implement idle detection using chrome.idle API
- [ ] Implement content script for typing velocity
- [ ] Create popup UI with start/end session controls
- [ ] Implement WebSocket client in service worker
- [ ] Add URL sanitization utility
- [ ] Add event batching for typing metrics
- [ ] Implement session state persistence in chrome.storage
- [ ] Add reconnection logic for WebSocket
- [ ] Create browser notifications for interventions
- [ ] Add error handling for all chrome.* API calls
- [ ] Test extension loading in developer mode
- [ ] Test all event listeners fire correctly
- [ ] Verify no actual content is captured

## Future Enhancements (Post-MVP)

- Multi-browser support (Firefox, Edge)
- Configurable idle threshold
- User-defined site categories (productive/distracting)
- Offline mode with activity queue
- Export extension logs for debugging

---

**Approval**: Ready for Implementation  
**Dependencies**: None (starting point for system)

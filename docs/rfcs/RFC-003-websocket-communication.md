# RFC-003: Real-Time Communication (WebSocket)

**Status**: Approved  
**Created**: January 8, 2026  
**Author**: Flowstate Team  
**Related Features**: Real-Time Communication Layer

## Overview

This RFC defines the WebSocket architecture using Socket.io for bidirectional real-time communication between extension, backend, and frontend. The system enables live activity streaming, real-time interventions, and session status updates.

## Purpose

Enable low-latency, event-driven communication between all system components to support real-time monitoring, instant interventions, and live dashboard updates without polling.

## Technical Approach

### Architecture Overview

```
┌─────────────────┐         WebSocket          ┌─────────────────┐
│    Extension    │◄────────────────────────────►│                 │
│  Service Worker │                             │                 │
└─────────────────┘                             │                 │
                                                │   Socket.io     │
┌─────────────────┐         WebSocket          │     Server      │
│     React       │◄────────────────────────────►│   (Backend)     │
│    Frontend     │                             │                 │
└─────────────────┘                             └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Pattern Engine  │
                                                │  AI Services     │
                                                │  Database        │
                                                └─────────────────┘
```

### Socket.io vs Native WebSockets

**Why Socket.io**:
- Automatic reconnection with exponential backoff
- Event-based API (cleaner than raw message handling)
- Room support for future multi-user features
- Fallback to long-polling if WebSocket unavailable
- Built-in heartbeat/ping-pong for connection health

## Event Types & Payloads

### Extension → Backend Events

#### `session:start`
Start a new focus session.

```typescript
interface SessionStartPayload {
  sessionId: string;
  startTime: number; // Unix timestamp
  userAgent?: string;
  extensionVersion?: string;
}

// Response
interface SessionStartResponse {
  success: boolean;
  sessionId: string;
  message?: string;
}
```

#### `session:end`
End the current focus session.

```typescript
interface SessionEndPayload {
  sessionId: string;
  endTime: number;
}

// Response
interface SessionEndResponse {
  success: boolean;
  focusScore: number;
  message?: string;
}
```

#### `activity:log`
Log a single activity event.

```typescript
interface ActivityLogPayload {
  sessionId: string;
  eventType: 'tab_switch' | 'tab_activated' | 'url_change' | 'typing' | 'idle_start' | 'idle_end' | 'window_focus' | 'window_blur';
  timestamp: number;
  metadata: {
    url?: string;
    typingVelocity?: number;
    idleDuration?: number;
    tabId?: number;
    previousTabId?: number;
    timeSpent?: number;
    [key: string]: unknown;
  };
}

// Response
interface ActivityLogResponse {
  success: boolean;
  message?: string;
}
```

#### `activity:batch`
Log multiple activity events at once (for batching).

```typescript
interface ActivityBatchPayload {
  activities: ActivityLogPayload[];
}

// Response
interface ActivityBatchResponse {
  success: boolean;
  count: number;
  message?: string;
}
```

#### `heartbeat`
Keep-alive ping from extension.

```typescript
interface HeartbeatPayload {
  sessionId?: string;
  timestamp: number;
}

// Response
interface HeartbeatResponse {
  success: boolean;
  serverTime: number;
}
```

### Backend → Extension Events

#### `intervention:send`
Send AI-generated intervention to extension.

```typescript
interface InterventionPayload {
  interventionId: string;
  sessionId: string;
  message: string;
  type: 'alert' | 'suggestion' | 'encouragement' | 'question';
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  dismissible: boolean;
}
```

#### `session:force-end`
Force-end session (e.g., backend restart, error).

```typescript
interface ForceEndPayload {
  sessionId: string;
  reason: string;
  timestamp: number;
}
```

### Frontend ↔ Backend Events

#### `session:subscribe` (Frontend → Backend)
Subscribe to session updates.

```typescript
interface SessionSubscribePayload {
  sessionId: string;
}

// Response
interface SessionSubscribeResponse {
  success: boolean;
  currentState: {
    sessionId: string;
    startTime: number;
    isActive: boolean;
    focusScore: number;
  };
}
```

#### `session:update` (Backend → Frontend)
Real-time session state update.

```typescript
interface SessionUpdatePayload {
  sessionId: string;
  focusScore: number;
  activityCount: number;
  lastActivityTime: number;
  status: 'active' | 'idle' | 'focus';
}
```

#### `activity:new` (Backend → Frontend)
New activity logged (for live view).

```typescript
interface ActivityNewPayload {
  sessionId: string;
  activity: {
    eventType: string;
    timestamp: number;
    metadata: Record<string, unknown>;
  };
}
```

#### `focus:update` (Backend → Frontend)
Updated focus score calculation.

```typescript
interface FocusUpdatePayload {
  sessionId: string;
  focusScore: number;
  components: {
    typingConsistency: number;
    contextSwitching: number;
    idleTime: number;
    siteFocus: number;
  };
  timestamp: number;
}
```

#### `intervention:send` (Backend → Frontend)
Display intervention in frontend.

```typescript
interface InterventionPayload {
  interventionId: string;
  sessionId: string;
  message: string;
  type: 'alert' | 'suggestion' | 'encouragement' | 'question';
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  dismissible: boolean;
}
```

#### `session:completed` (Backend → Frontend)
Session ended with final analysis.

```typescript
interface SessionCompletedPayload {
  sessionId: string;
  focusScore: number;
  duration: number;
  insightsGenerated: boolean;
  reportUrl: string;
}
```

### Bidirectional Events

#### `connection:status`
Connection health status.

```typescript
interface ConnectionStatusPayload {
  clientId: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
  latency?: number;
  timestamp: number;
}
```

#### `error`
Error notification.

```typescript
interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
}
```

## Implementation

### Backend (Socket.io Server)

```typescript
// src/websocket/socketServer.ts
import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { SessionService } from '../services/SessionService';
import { ActivityService } from '../services/ActivityService';
import { PatternAnalyzer } from '../ai/patternAnalyzer';

export class WebSocketServer {
  private io: SocketServer;
  private extensionConnections = new Map<string, Socket>(); // sessionId -> socket
  private frontendConnections = new Map<string, Socket>(); // sessionId -> socket

  constructor(
    httpServer: HttpServer,
    private sessionService: SessionService,
    private activityService: ActivityService,
    private patternAnalyzer: PatternAnalyzer
  ) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: ['http://localhost:5173', 'chrome-extension://*'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 10000,
      pingInterval: 5000
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Determine client type from handshake
      const clientType = socket.handshake.query.clientType as string;

      if (clientType === 'extension') {
        this.handleExtensionConnection(socket);
      } else if (clientType === 'frontend') {
        this.handleFrontendConnection(socket);
      }

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.handleDisconnect(socket);
      });
    });
  }

  private handleExtensionConnection(socket: Socket): void {
    // Session start
    socket.on('session:start', async (payload: SessionStartPayload) => {
      try {
        const session = await this.sessionService.createSession({
          id: payload.sessionId,
          startTime: new Date(payload.startTime)
        });

        this.extensionConnections.set(payload.sessionId, socket);

        socket.emit('session:start', {
          success: true,
          sessionId: session.id,
          message: 'Session started successfully'
        });

        // Notify any listening frontend clients
        this.broadcastToFrontend(payload.sessionId, 'session:update', {
          sessionId: session.id,
          focusScore: 0,
          activityCount: 0,
          lastActivityTime: Date.now(),
          status: 'active'
        });
      } catch (error) {
        socket.emit('error', {
          code: 'SESSION_START_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Session end
    socket.on('session:end', async (payload: SessionEndPayload) => {
      try {
        // Calculate focus score (simplified here, should use pattern analyzer)
        const focusScore = await this.calculateFocusScore(payload.sessionId);

        const session = await this.sessionService.endSession(payload.sessionId, focusScore);

        this.extensionConnections.delete(payload.sessionId);

        socket.emit('session:end', {
          success: true,
          focusScore: session.focusScore || 0,
          message: 'Session ended successfully'
        });

        // Notify frontend
        this.broadcastToFrontend(payload.sessionId, 'session:completed', {
          sessionId: payload.sessionId,
          focusScore: focusScore,
          duration: session.endTime && session.startTime 
            ? session.endTime.getTime() - session.startTime.getTime() 
            : 0,
          insightsGenerated: false, // Will be true after AI analysis
          reportUrl: `/report/${payload.sessionId}`
        });
      } catch (error) {
        socket.emit('error', {
          code: 'SESSION_END_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Activity logging
    socket.on('activity:log', async (payload: ActivityLogPayload) => {
      try {
        await this.activityService.logActivity({
          sessionId: payload.sessionId,
          timestamp: new Date(payload.timestamp),
          eventType: payload.eventType,
          url: payload.metadata.url,
          typingVelocity: payload.metadata.typingVelocity,
          idleDuration: payload.metadata.idleDuration,
          metadata: payload.metadata
        });

        // Broadcast to frontend
        this.broadcastToFrontend(payload.sessionId, 'activity:new', {
          sessionId: payload.sessionId,
          activity: {
            eventType: payload.eventType,
            timestamp: payload.timestamp,
            metadata: payload.metadata
          }
        });

        // Analyze pattern in real-time
        const pattern = await this.patternAnalyzer.analyzeActivity(payload);
        if (pattern) {
          // Send intervention if pattern detected
          await this.sendIntervention(payload.sessionId, pattern);
        }

        socket.emit('activity:log', { success: true });
      } catch (error) {
        socket.emit('error', {
          code: 'ACTIVITY_LOG_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Batch activity logging
    socket.on('activity:batch', async (payload: ActivityBatchPayload) => {
      try {
        const activities = payload.activities.map(a => ({
          sessionId: a.sessionId,
          timestamp: new Date(a.timestamp),
          eventType: a.eventType,
          url: a.metadata.url,
          typingVelocity: a.metadata.typingVelocity,
          idleDuration: a.metadata.idleDuration,
          metadata: a.metadata
        }));

        await this.activityService.logActivitiesBatch(activities);

        socket.emit('activity:batch', {
          success: true,
          count: activities.length
        });
      } catch (error) {
        socket.emit('error', {
          code: 'BATCH_LOG_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Heartbeat
    socket.on('heartbeat', (payload: HeartbeatPayload) => {
      socket.emit('heartbeat', {
        success: true,
        serverTime: Date.now()
      });
    });
  }

  private handleFrontendConnection(socket: Socket): void {
    // Subscribe to session updates
    socket.on('session:subscribe', async (payload: SessionSubscribePayload) => {
      try {
        const session = await this.sessionService.getSession(payload.sessionId);

        this.frontendConnections.set(payload.sessionId, socket);

        socket.emit('session:subscribe', {
          success: true,
          currentState: {
            sessionId: session.id,
            startTime: session.startTime.getTime(),
            isActive: session.status === 'active',
            focusScore: session.focusScore || 0
          }
        });
      } catch (error) {
        socket.emit('error', {
          code: 'SUBSCRIBE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Unsubscribe from session
    socket.on('session:unsubscribe', (payload: { sessionId: string }) => {
      this.frontendConnections.delete(payload.sessionId);
    });
  }

  private handleDisconnect(socket: Socket): void {
    // Remove from connection maps
    for (const [sessionId, sock] of this.extensionConnections.entries()) {
      if (sock.id === socket.id) {
        this.extensionConnections.delete(sessionId);
      }
    }

    for (const [sessionId, sock] of this.frontendConnections.entries()) {
      if (sock.id === socket.id) {
        this.frontendConnections.delete(sessionId);
      }
    }
  }

  private broadcastToFrontend(sessionId: string, event: string, payload: any): void {
    const socket = this.frontendConnections.get(sessionId);
    if (socket) {
      socket.emit(event, payload);
    }
  }

  private broadcastToExtension(sessionId: string, event: string, payload: any): void {
    const socket = this.extensionConnections.get(sessionId);
    if (socket) {
      socket.emit(event, payload);
    }
  }

  async sendIntervention(sessionId: string, pattern: any): Promise<void> {
    const interventionPayload: InterventionPayload = {
      interventionId: `int_${Date.now()}`,
      sessionId,
      message: pattern.interventionMessage,
      type: pattern.type,
      priority: pattern.priority,
      timestamp: Date.now(),
      dismissible: true
    };

    // Send to both extension and frontend
    this.broadcastToExtension(sessionId, 'intervention:send', interventionPayload);
    this.broadcastToFrontend(sessionId, 'intervention:send', interventionPayload);
  }

  private async calculateFocusScore(sessionId: string): Promise<number> {
    // Simplified - should use PatternAnalyzer
    return 75; // Placeholder
  }
}
```

### Extension Client

```typescript
// extension/background/webSocketClient.ts
import { io, Socket } from 'socket.io-client';

export class ExtensionWebSocketClient {
  private socket: Socket | null = null;
  private currentSessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private url: string) {}

  async connect(): Promise<void> {
    this.socket = io(this.url, {
      query: { clientType: 'extension' },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.socket.on('connect', () => {
      console.log('Extension WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Rejoin session if reconnecting
      if (this.currentSessionId) {
        this.rejoinSession(this.currentSessionId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Extension WebSocket disconnected:', reason);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
      this.reconnectAttempts = attempt;
    });

    this.socket.on('intervention:send', (data: InterventionPayload) => {
      this.handleIntervention(data);
    });

    this.socket.on('session:force-end', (data: ForceEndPayload) => {
      this.handleForceEnd(data);
    });

    this.socket.on('error', (data: ErrorPayload) => {
      console.error('WebSocket error:', data);
    });
  }

  async startSession(sessionId: string, startTime: number): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('session:start', {
        sessionId,
        startTime,
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version
      }, (response: SessionStartResponse) => {
        if (response.success) {
          this.currentSessionId = sessionId;
          resolve();
        } else {
          reject(new Error(response.message || 'Failed to start session'));
        }
      });
    });
  }

  async endSession(sessionId: string): Promise<number> {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('session:end', {
        sessionId,
        endTime: Date.now()
      }, (response: SessionEndResponse) => {
        if (response.success) {
          this.currentSessionId = null;
          resolve(response.focusScore);
        } else {
          reject(new Error(response.message || 'Failed to end session'));
        }
      });
    });
  }

  async logActivity(activity: ActivityLogPayload): Promise<void> {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, activity not logged');
      return;
    }

    this.socket.emit('activity:log', activity);
  }

  async logActivitiesBatch(activities: ActivityLogPayload[]): Promise<void> {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, activities not logged');
      return;
    }

    this.socket.emit('activity:batch', { activities });
  }

  sendHeartbeat(): void {
    if (this.socket?.connected) {
      this.socket.emit('heartbeat', {
        sessionId: this.currentSessionId,
        timestamp: Date.now()
      });
    }
  }

  private async rejoinSession(sessionId: string): Promise<void> {
    // Re-establish session state after reconnection
    console.log(`Rejoining session ${sessionId}`);
    // Implementation depends on session recovery strategy
  }

  private handleIntervention(data: InterventionPayload): void {
    // Show browser notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Flowstate',
      message: data.message,
      priority: data.priority === 'high' ? 2 : data.priority === 'medium' ? 1 : 0
    });
  }

  private handleForceEnd(data: ForceEndPayload): void {
    console.log('Session force-ended:', data.reason);
    this.currentSessionId = null;
    chrome.storage.local.remove(['sessionId', 'startTime']);
  }
}
```

### Frontend Client

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketHookOptions {
  url: string;
  sessionId: string | null;
  onSessionUpdate?: (data: SessionUpdatePayload) => void;
  onActivityNew?: (data: ActivityNewPayload) => void;
  onFocusUpdate?: (data: FocusUpdatePayload) => void;
  onIntervention?: (data: InterventionPayload) => void;
  onSessionCompleted?: (data: SessionCompletedPayload) => void;
}

export function useWebSocket(options: WebSocketHookOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(options.url, {
      query: { clientType: 'frontend' },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      console.log('Frontend WebSocket connected');
      setIsConnected(true);

      // Subscribe to session if provided
      if (options.sessionId) {
        socket.emit('session:subscribe', { sessionId: options.sessionId });
      }
    });

    socket.on('disconnect', () => {
      console.log('Frontend WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('session:update', (data: SessionUpdatePayload) => {
      options.onSessionUpdate?.(data);
    });

    socket.on('activity:new', (data: ActivityNewPayload) => {
      options.onActivityNew?.(data);
    });

    socket.on('focus:update', (data: FocusUpdatePayload) => {
      options.onFocusUpdate?.(data);
    });

    socket.on('intervention:send', (data: InterventionPayload) => {
      options.onIntervention?.(data);
    });

    socket.on('session:completed', (data: SessionCompletedPayload) => {
      options.onSessionCompleted?.(data);
    });

    socketRef.current = socket;
  }, [options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribeToSession = useCallback((sessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('session:subscribe', { sessionId });
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    latency,
    subscribeToSession,
    disconnect
  };
}
```

## Connection Management

### Reconnection Strategy

**Exponential Backoff**:
- Initial delay: 1 second
- Max delay: 5 seconds
- Max attempts: 10

**State Recovery**:
- Extension: Re-establish session state from `chrome.storage.local`
- Frontend: Re-subscribe to session updates
- Backend: Queue messages during disconnection (short buffer)

### Heartbeat/Ping-Pong

Socket.io handles this automatically:
- Ping interval: 5 seconds
- Ping timeout: 10 seconds
- If timeout exceeded, connection marked as dead and reconnection triggered

## Message Queuing for Offline Scenarios

```typescript
// extension/background/activityQueue.ts
export class ActivityQueue {
  private queue: ActivityLogPayload[] = [];
  private maxQueueSize = 1000;

  enqueue(activity: ActivityLogPayload): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest activity
      this.queue.shift();
    }
    this.queue.push(activity);
  }

  async flush(wsClient: ExtensionWebSocketClient): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      await wsClient.logActivitiesBatch(batch);
    } catch (error) {
      // Put back in queue if failed
      this.queue = [...batch, ...this.queue];
      throw error;
    }
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}
```

## Performance Considerations

### Event Throttling

```typescript
// Throttle high-frequency events
import { throttle } from 'lodash';

const throttledLogActivity = throttle(
  (activity: ActivityLogPayload) => {
    wsClient.logActivity(activity);
  },
  100, // Max once per 100ms
  { leading: true, trailing: true }
);
```

### Connection Pooling

Socket.io maintains connection pool internally:
- Max connections per origin: Browser default
- Connection reuse via keep-alive
- Multiplexing multiple event streams over single connection

### Bandwidth Optimization

- Compress payloads (Socket.io supports compression)
- Batch activities where possible
- Only send diffs for session updates, not full state

## Security Considerations

### CORS Configuration

```typescript
cors: {
  origin: ['http://localhost:5173', 'chrome-extension://*'],
  methods: ['GET', 'POST'],
  credentials: true
}
```

### Authentication (Future Enhancement)

```typescript
// Authenticate connection with token
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (isValidToken(token)) {
    next();
  } else {
    next(new Error('Authentication error'));
  }
});
```

### Rate Limiting

```typescript
// Limit events per client
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 100, // Max 100 events per minute
  message: 'Too many requests'
});
```

## Testing Criteria

### Unit Tests
- [ ] Event payload validation
- [ ] Connection state management
- [ ] Queue operations (enqueue, flush, clear)
- [ ] Error handling

### Integration Tests
- [ ] Extension connects to backend
- [ ] Frontend connects to backend
- [ ] Activity events flow extension → backend → frontend
- [ ] Interventions flow backend → extension/frontend
- [ ] Reconnection works after disconnect
- [ ] Queued messages sent after reconnection

### Performance Tests
- [ ] Handle 100 activities/second without lag
- [ ] Reconnection completes in < 2 seconds
- [ ] Message latency < 100ms under normal load
- [ ] No memory leaks during long sessions

## Implementation Checklist

- [ ] Set up Socket.io server in backend
- [ ] Implement event handlers for all event types
- [ ] Create WebSocket client for extension
- [ ] Create WebSocket hook for frontend
- [ ] Implement reconnection logic
- [ ] Add activity queue for offline mode
- [ ] Implement heartbeat mechanism
- [ ] Add error handling for all events
- [ ] Test connection/disconnection scenarios
- [ ] Test event flow extension → backend → frontend
- [ ] Verify interventions display correctly

## Future Enhancements

- Authentication with JWT tokens
- Encrypted WebSocket connections (WSS in production)
- Redis pub/sub for horizontal scaling
- Message persistence for offline sync
- WebSocket compression
- Room-based broadcasts for team features

---

**Approval**: Ready for Implementation  
**Dependencies**: RFC-001 (Extension), RFC-002 (Backend API)

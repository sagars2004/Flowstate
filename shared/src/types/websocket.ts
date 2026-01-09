/**
 * Shared WebSocket event types and payloads
 */

// Session events
export interface SessionStartPayload {
  sessionId: string;
  startTime: number;
  userAgent?: string;
  extensionVersion?: string;
}

export interface SessionEndPayload {
  sessionId: string;
  endTime: number;
}

export interface SessionUpdatePayload {
  sessionId: string;
  focusScore: number;
  activityCount: number;
  lastActivityTime: number;
  status: 'active' | 'idle' | 'focus';
}

// Activity events
export interface ActivityLogPayload {
  sessionId: string;
  eventType: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// Intervention events
export interface InterventionPayload {
  interventionId: string;
  sessionId: string;
  message: string;
  type: 'alert' | 'suggestion' | 'encouragement' | 'question';
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  dismissible: boolean;
}

// Focus score update
export interface FocusUpdatePayload {
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

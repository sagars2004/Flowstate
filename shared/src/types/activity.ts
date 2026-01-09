/**
 * Shared activity types used across frontend, backend, and extension
 */

export type ActivityEventType = 
  | 'tab_switch'
  | 'tab_activated'
  | 'url_change'
  | 'typing'
  | 'idle_start'
  | 'idle_end'
  | 'window_focus'
  | 'window_blur';

export interface Activity {
  id: number;
  sessionId: string;
  timestamp: Date;
  eventType: ActivityEventType;
  url: string | null;
  typingVelocity: number | null;
  idleDuration: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateActivityData {
  sessionId: string;
  timestamp: Date;
  eventType: ActivityEventType;
  url?: string;
  typingVelocity?: number;
  idleDuration?: number;
  metadata?: Record<string, unknown>;
}

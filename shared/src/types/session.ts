/**
 * Shared session types used across frontend, backend, and extension
 */

export interface Session {
  id: string;
  startTime: Date;
  endTime: Date | null;
  focusScore: number | null;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionData {
  id: string;
  startTime: Date;
}

export interface UpdateSessionData {
  endTime?: Date;
  focusScore?: number;
  status?: 'active' | 'completed' | 'abandoned';
}

export interface SessionStatistics {
  totalActivities: number;
  totalTypingTime: number;
  totalIdleTime: number;
  tabSwitchCount: number;
}

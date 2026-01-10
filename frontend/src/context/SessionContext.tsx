import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Session } from '@flowstate/shared';
import { api } from '../services/api';
import { useWebSocketContext } from './WebSocketContext';

interface SessionContextValue {
  currentSession: Session | null;
  isSessionActive: boolean;
  startSession: (sessionId: string) => Promise<void>;
  endSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  completedSessionId: string | null; // ID of most recently completed session for navigation
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps): JSX.Element {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const { socket, isConnected } = useWebSocketContext();

  // Subscribe to session updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // Listen for session update events
    const handleSessionUpdate = (data: {
      sessionId: string;
      focusScore: number | null;
      activityCount: number;
      lastActivityTime: number;
      status: 'active' | 'completed' | 'abandoned';
    }): void => {
      console.log('Received session update via WebSocket:', data);

      // Update session state if it matches current session
      setCurrentSession((prev: Session | null) => {
        if (prev && prev.id === data.sessionId) {
          return {
            ...prev,
            focusScore: data.focusScore ?? prev.focusScore,
            status: data.status,
          };
        }
        return prev;
      });

      // If session was completed, mark it for navigation (components can react to this)
      // This handles both current session and any subscribed session that ends
      if (data.status === 'completed') {
        console.log('Session completed:', data.sessionId);
        setCompletedSessionId(data.sessionId);
        
        // If this was the current session, clear it
        setCurrentSession((prev: Session | null) => {
          if (prev && prev.id === data.sessionId) {
            return null;
          }
          return prev;
        });
      }
    };

    // Listen for session:update events
    socket.on('session:update', handleSessionUpdate);

    // Listen for focus score updates
    socket.on('focus:update', (data: { sessionId: string; focusScore: number }) => {
      if (currentSession && currentSession.id === data.sessionId) {
        setCurrentSession((prev: Session | null) => {
          if (!prev) return null;
          return {
            ...prev,
            focusScore: data.focusScore,
          };
        });
      }
    });

    return () => {
      socket.off('session:update', handleSessionUpdate);
      socket.off('focus:update');
    };
  }, [socket, isConnected, currentSession]);

  // Subscribe to session when it becomes active
  useEffect(() => {
    if (!socket || !isConnected || !currentSession) {
      return;
    }

    // Subscribe to this session's updates
    socket.emit('session:subscribe', currentSession.id);
    console.log(`Subscribed to session: ${currentSession.id}`);

    return () => {
      // Unsubscribe when session changes or component unmounts
      socket.emit('session:unsubscribe');
    };
  }, [socket, isConnected, currentSession?.id]);

  const startSession = useCallback(async (sessionId: string) => {
    try {
      const response = await api.post('/api/sessions/start', {
        sessionId,
        startTime: new Date().toISOString()
      });
      const session = response.data.data;
      setCurrentSession(session);
      
      // Subscribe to this session via WebSocket
      if (socket && isConnected) {
        socket.emit('session:subscribe', sessionId);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }, [socket, isConnected]);

  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      const response = await api.patch(`/api/sessions/${currentSession.id}/end`);
      const endedSession = response.data.data;
      
      // Update session state - backend will also send WebSocket update
      setCurrentSession(endedSession);
      
      // If session is completed, mark it for navigation
      if (endedSession.status === 'completed') {
        setCompletedSessionId(endedSession.id);
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }, [currentSession]);

  const refreshSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      const response = await api.get(`/api/sessions/${currentSession.id}`);
      setCurrentSession(response.data.data);
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  }, [currentSession]);

  const value: SessionContextValue = {
    currentSession,
    isSessionActive: currentSession !== null && currentSession.status === 'active',
    startSession,
    endSession,
    refreshSession,
    completedSessionId,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

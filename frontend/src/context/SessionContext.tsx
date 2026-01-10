import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Session } from '@flowstate/shared';
import { api } from '../services/api';

interface SessionContextValue {
  currentSession: Session | null;
  isSessionActive: boolean;
  startSession: (sessionId: string) => Promise<void>;
  endSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
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

  const startSession = useCallback(async (sessionId: string) => {
    try {
      const response = await api.post('/api/sessions/start', {
        sessionId,
        startTime: new Date().toISOString()
      });
      setCurrentSession(response.data.data);
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      await api.post(`/api/sessions/${currentSession.id}/end`, {
        focusScore: 75 // Placeholder, calculated by backend
      });
      setCurrentSession(null);
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
    refreshSession
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

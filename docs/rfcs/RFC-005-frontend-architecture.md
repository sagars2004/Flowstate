# RFC-005: Frontend Architecture

**Status**: Approved  
**Created**: January 8, 2026  
**Author**: Flowstate Team  
**Related Features**: Frontend UI & Visualizations

## Overview

This RFC defines the React 18 frontend architecture with TypeScript, Tailwind CSS, and Recharts for data visualization. The frontend provides three main interfaces: Dashboard (session overview), Live Session View (real-time monitoring), and Post-Session Report (detailed analytics).

## Purpose

Create an intuitive, responsive, real-time user interface that displays session data, activity streams, AI insights, and visualizations with minimal latency and excellent user experience.

## Technical Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast HMR, optimized builds)
- **Styling**: Tailwind CSS (utility-first CSS)
- **Charts**: Recharts (React-native charts library)
- **Routing**: React Router v6
- **State Management**: React Context API
- **Real-Time**: Socket.io-client
- **HTTP Client**: Axios (for REST API calls)
- **Icons**: Lucide React (modern icon library)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      App.tsx                             │
│  - Router setup                                         │
│  - Global providers                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐   ┌─────▼─────┐  ┌────▼────────┐
│Dashboard│   │LiveSession│  │SessionReport│
└────┬────┘   └─────┬─────┘  └─────┬───────┘
     │              │              │
┌────▼──────────────▼──────────────▼────────────┐
│            Context Providers                   │
│  - SessionContext (global session state)      │
│  - WebSocketContext (real-time connection)    │
│  - ThemeContext (dark/light mode)             │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│              Custom Hooks                      │
│  - useSession() - session management          │
│  - useWebSocket() - real-time updates         │
│  - useActivities() - activity data             │
│  - useInsights() - AI insights                 │
└────────────────────────────────────────────────┘
```

## Project Structure

```
frontend/src/
├── components/
│   ├── atoms/              # Basic building blocks
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── Spinner.tsx
│   ├── molecules/          # Composed components
│   │   ├── MetricsCard.tsx
│   │   ├── ActivityItem.tsx
│   │   ├── InterventionToast.tsx
│   │   └── FocusScoreGauge.tsx
│   └── organisms/          # Complex components
│       ├── SessionList.tsx
│       ├── FocusTimeline.tsx
│       ├── ActivityStream.tsx
│       └── InsightsPanel.tsx
├── pages/
│   ├── Dashboard.tsx       # Main landing page
│   ├── LiveSession.tsx     # Real-time monitoring
│   ├── SessionReport.tsx   # Post-session analytics
│   └── Landing.tsx         # Onboarding page
├── context/
│   ├── SessionContext.tsx  # Session state management
│   ├── WebSocketContext.tsx # WebSocket connection
│   └── ThemeContext.tsx    # Theme (dark/light)
├── hooks/
│   ├── useSession.ts       # Session operations
│   ├── useWebSocket.ts     # WebSocket hook
│   ├── useActivities.ts    # Activity data fetching
│   └── useInsights.ts      # Insights fetching
├── services/
│   ├── api.ts              # Axios API client
│   └── websocket.ts        # Socket.io client
├── utils/
│   ├── formatters.ts       # Date, number formatting
│   ├── calculations.ts     # Focus score, metrics
│   └── constants.ts        # App constants
├── types/
│   ├── session.ts          # Session types
│   ├── activity.ts         # Activity types
│   └── insights.ts         # Insights types
├── App.tsx                 # Root component
├── main.tsx                # Entry point
└── index.css               # Global styles
```

## Context Providers

### Session Context

```typescript
// src/context/SessionContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Session } from '../types/session';
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
    const response = await api.post('/api/sessions/start', {
      sessionId,
      startTime: new Date().toISOString()
    });
    setCurrentSession(response.data.data);
  }, []);

  const endSession = useCallback(async () => {
    if (!currentSession) return;

    await api.post(`/api/sessions/${currentSession.id}/end`, {
      focusScore: 75 // Placeholder, calculated by backend
    });

    setCurrentSession(null);
  }, [currentSession]);

  const refreshSession = useCallback(async () => {
    if (!currentSession) return;

    const response = await api.get(`/api/sessions/${currentSession.id}`);
    setCurrentSession(response.data.data);
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
```

### WebSocket Context

```typescript
// src/context/WebSocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  latency: number | null;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
  url: string;
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps): JSX.Element {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const socketInstance = io(url, {
      query: { clientType: 'frontend' }
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [url]);

  const value: WebSocketContextValue = {
    socket,
    isConnected,
    latency
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

## Custom Hooks

### useActivities Hook

```typescript
// src/hooks/useActivities.ts
import { useState, useEffect } from 'react';
import { Activity } from '../types/activity';
import { api } from '../services/api';
import { useWebSocketContext } from '../context/WebSocketContext';

export function useActivities(sessionId: string | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { socket } = useWebSocketContext();

  // Fetch initial activities
  useEffect(() => {
    if (!sessionId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/activity/session/${sessionId}`);
        setActivities(response.data.data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [sessionId]);

  // Listen for real-time activity updates
  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleNewActivity = (data: { sessionId: string; activity: Activity }) => {
      if (data.sessionId === sessionId) {
        setActivities(prev => [...prev, data.activity]);
      }
    };

    socket.on('activity:new', handleNewActivity);

    return () => {
      socket.off('activity:new', handleNewActivity);
    };
  }, [socket, sessionId]);

  return { activities, loading, error };
}
```

### useInterventions Hook

```typescript
// src/hooks/useInterventions.ts
import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';

export interface Intervention {
  interventionId: string;
  sessionId: string;
  message: string;
  type: 'alert' | 'suggestion' | 'encouragement' | 'question';
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  dismissible: boolean;
  dismissed?: boolean;
}

export function useInterventions(sessionId: string | null) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const { socket } = useWebSocketContext();

  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleIntervention = (data: Intervention) => {
      if (data.sessionId === sessionId) {
        setInterventions(prev => [...prev, { ...data, dismissed: false }]);
      }
    };

    socket.on('intervention:send', handleIntervention);

    return () => {
      socket.off('intervention:send', handleIntervention);
    };
  }, [socket, sessionId]);

  const dismissIntervention = useCallback((interventionId: string) => {
    setInterventions(prev =>
      prev.map(int =>
        int.interventionId === interventionId
          ? { ...int, dismissed: true }
          : int
      )
    );

    // Remove after animation (500ms)
    setTimeout(() => {
      setInterventions(prev =>
        prev.filter(int => int.interventionId !== interventionId)
      );
    }, 500);
  }, []);

  const activeInterventions = interventions.filter(int => !int.dismissed);

  return {
    interventions: activeInterventions,
    dismissIntervention
  };
}
```

## Page Components

### Dashboard Page

```typescript
// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { api } from '../services/api';
import { Session } from '../types/session';
import { MetricsCard } from '../components/molecules/MetricsCard';
import { SessionList } from '../components/organisms/SessionList';
import { Button } from '../components/atoms/Button';

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate();
  const { isSessionActive, currentSession } = useSession();
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [todayStats, setTodayStats] = useState({
    focusScore: 0,
    deepWorkTime: 0,
    sessionCount: 0
  });

  useEffect(() => {
    const fetchRecentSessions = async () => {
      try {
        const response = await api.get('/api/sessions', {
          params: {
            limit: 10,
            status: 'completed'
          }
        });
        setRecentSessions(response.data.data);

        // Calculate today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = response.data.data.filter((s: Session) => 
          new Date(s.startTime) >= today
        );

        const avgScore = todaySessions.length > 0
          ? todaySessions.reduce((sum: number, s: Session) => sum + (s.focusScore || 0), 0) / todaySessions.length
          : 0;

        setTodayStats({
          focusScore: Math.round(avgScore),
          deepWorkTime: todaySessions.length * 45, // Estimate
          sessionCount: todaySessions.length
        });
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      }
    };

    fetchRecentSessions();
  }, []);

  const handleStartSession = () => {
    if (isSessionActive && currentSession) {
      navigate(`/live/${currentSession.id}`);
    } else {
      // User should start session from extension
      alert('Please start a session from the Chrome extension');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your focus, understand your patterns
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricsCard
            title="Today's Focus Score"
            value={todayStats.focusScore}
            unit="/100"
            icon="Target"
            trend={todayStats.focusScore >= 70 ? 'up' : 'down'}
          />
          <MetricsCard
            title="Deep Work Time"
            value={todayStats.deepWorkTime}
            unit="min"
            icon="Clock"
          />
          <MetricsCard
            title="Sessions Completed"
            value={todayStats.sessionCount}
            unit="today"
            icon="CheckCircle"
          />
        </div>

        {/* Action Button */}
        {isSessionActive ? (
          <Button
            onClick={handleStartSession}
            variant="primary"
            size="lg"
            className="mb-8"
          >
            View Active Session
          </Button>
        ) : (
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-blue-900 dark:text-blue-100">
              Start a focus session from the Flowstate Chrome extension to begin tracking.
            </p>
          </div>
        )}

        {/* Recent Sessions */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Recent Sessions
          </h2>
          <SessionList sessions={recentSessions} />
        </div>
      </div>
    </div>
  );
}
```

### Live Session View

```typescript
// src/pages/LiveSession.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useActivities } from '../hooks/useActivities';
import { useInterventions } from '../hooks/useInterventions';
import { FocusScoreGauge } from '../components/molecules/FocusScoreGauge';
import { ActivityStream } from '../components/organisms/ActivityStream';
import { InterventionToast } from '../components/molecules/InterventionToast';

export default function LiveSession(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { socket, isConnected } = useWebSocketContext();
  const { activities } = useActivities(sessionId || null);
  const { interventions, dismissIntervention } = useInterventions(sessionId || null);

  const [focusScore, setFocusScore] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [startTime] = useState(Date.now());

  // Subscribe to session updates
  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.emit('session:subscribe', { sessionId });

    const handleSessionUpdate = (data: any) => {
      if (data.sessionId === sessionId) {
        setFocusScore(data.focusScore);
      }
    };

    const handleFocusUpdate = (data: any) => {
      if (data.sessionId === sessionId) {
        setFocusScore(data.focusScore);
      }
    };

    socket.on('session:update', handleSessionUpdate);
    socket.on('focus:update', handleFocusUpdate);

    return () => {
      socket.off('session:update', handleSessionUpdate);
      socket.off('focus:update', handleFocusUpdate);
      socket.emit('session:unsubscribe', { sessionId });
    };
  }, [socket, sessionId]);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Live Session
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Real-time focus monitoring
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer & Focus Score */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-center">
                <div className="text-6xl font-mono font-bold text-gray-900 dark:text-white mb-4">
                  {formatDuration(sessionDuration)}
                </div>
                <FocusScoreGauge score={focusScore} size="large" />
              </div>
            </div>

            {/* Activity Stream */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Activity Stream
              </h2>
              <ActivityStream activities={activities} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Current Status
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Focus State</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {focusScore >= 80 ? '🔥 Deep Focus' : focusScore >= 50 ? '⚡ Moderate' : '😕 Distracted'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Activities Logged</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {activities.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intervention Toasts */}
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {interventions.map(intervention => (
            <InterventionToast
              key={intervention.interventionId}
              intervention={intervention}
              onDismiss={() => dismissIntervention(intervention.interventionId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Visualization Components

### Focus Timeline (Recharts)

```typescript
// src/components/organisms/FocusTimeline.tsx
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from '../../types/activity';

interface FocusTimelineProps {
  activities: Activity[];
}

export function FocusTimeline({ activities }: FocusTimelineProps): JSX.Element {
  // Calculate focus score over time (5-minute windows)
  const timelineData = calculateTimelineData(activities);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={timelineData}>
          <defs>
            <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          />
          <YAxis domain={[0, 100]} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleTimeString()}
            formatter={(value: number) => [`${Math.round(value)}`, 'Focus Score']}
          />
          <Area 
            type="monotone" 
            dataKey="focusScore" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#focusGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function calculateTimelineData(activities: Activity[]) {
  // Group activities into 5-minute windows and calculate focus score
  // Implementation details...
  return [];
}
```

## Responsive Design

### Breakpoints (Tailwind)

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    }
  }
}
```

### Mobile-First Approach

```tsx
// Responsive grid example
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>

// Responsive padding
<div className="px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>

// Responsive text sizing
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Flowstate
</h1>
```

## Performance Optimization

### Code Splitting

```typescript
// src/App.tsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveSession = lazy(() => import('./pages/LiveSession'));
const SessionReport = lazy(() => import('./pages/SessionReport'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live/:sessionId" element={<LiveSession />} />
          <Route path="/report/:sessionId" element={<SessionReport />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Memoization

```typescript
import React, { memo } from 'react';

export const MetricsCard = memo<MetricsCardProps>(function MetricsCard({ title, value, unit }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-gray-600 text-sm">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mt-2">
        {value} <span className="text-lg text-gray-500">{unit}</span>
      </p>
    </div>
  );
});
```

## Testing Criteria

### Component Tests
- [ ] Each component renders without errors
- [ ] Props are properly typed and validated
- [ ] User interactions trigger expected callbacks
- [ ] Conditional rendering works correctly

### Integration Tests
- [ ] Navigation between pages works
- [ ] WebSocket updates trigger UI changes
- [ ] API calls update component state
- [ ] Context providers share state correctly

### E2E Tests
- [ ] User can navigate full app flow
- [ ] Live session updates in real-time
- [ ] Session report displays all visualizations
- [ ] Interventions appear and can be dismissed

## Implementation Checklist

- [ ] Set up Vite React project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Create SessionContext and WebSocketContext
- [ ] Implement custom hooks (useSession, useActivities, useInterventions)
- [ ] Build Dashboard page
- [ ] Build Live Session View
- [ ] Build Session Report page
- [ ] Create visualization components (Recharts)
- [ ] Implement intervention toast system
- [ ] Add dark mode support
- [ ] Make responsive for mobile
- [ ] Add loading states and error handling
- [ ] Optimize with React.memo and code splitting

## Accessibility Considerations

- Use semantic HTML (header, nav, main, section)
- Add ARIA labels for interactive elements
- Ensure keyboard navigation works
- Maintain color contrast ratios (WCAG AA)
- Provide text alternatives for charts

## Future Enhancements

- Progressive Web App (PWA) support
- Offline mode with local storage sync
- Export reports as PDF
- Customizable dashboard layout
- Voice narration of insights
- Keyboard shortcuts for power users

---

**Approval**: Ready for Implementation  
**Dependencies**: RFC-002 (Backend API), RFC-003 (WebSocket)

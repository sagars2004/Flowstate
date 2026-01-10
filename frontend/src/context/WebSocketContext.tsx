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
      query: { clientType: 'frontend' },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
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

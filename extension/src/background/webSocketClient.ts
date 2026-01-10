/**
 * WebSocket client for Chrome Extension
 * Handles connection to backend Socket.io server
 */

import { io, Socket } from 'socket.io-client';
import type {
  SessionStartPayload,
  SessionEndPayload,
  ActivityLogPayload,
  InterventionPayload,
  SessionUpdatePayload,
} from '@flowstate/shared';

// Backend URL - can be configured via chrome.storage or default to localhost
const DEFAULT_BACKEND_URL = 'http://localhost:3001';

export class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private isIntentionallyDisconnected = false;
  private messageQueue: Array<{ event: string; payload: unknown }> = [];

  constructor() {
    this.connect();
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.isIntentionallyDisconnected) {
      return;
    }

    try {
      // Get backend URL from storage or use default
      const storageData = await chrome.storage.local.get(['backendUrl']);
      const backendUrl = storageData.backendUrl || DEFAULT_BACKEND_URL;

      this.socket = io(backendUrl, {
        query: { clientType: 'extension' },
        reconnection: false, // Manual reconnection handling
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('connect', () => {
      console.log('WebSocket connected to backend');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.flushMessageQueue();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (!this.isIntentionallyDisconnected && reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    });

    // Listen for interventions from backend
    this.socket.on('intervention:send', (payload: InterventionPayload) => {
      this.handleIntervention(payload);
    });

    // Listen for session updates
    this.socket.on('session:update', (payload: SessionUpdatePayload) => {
      this.handleSessionUpdate(payload);
    });

    // Listen for errors
    this.socket.on('error', (error: { code: string; message: string; timestamp: number }) => {
      console.error('WebSocket error:', error);
      this.showNotification('Flowstate Error', error.message);
    });
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyDisconnected) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private flushMessageQueue(): void {
    if (!this.socket?.connected) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const { event, payload } = this.messageQueue.shift()!;
      this.socket.emit(event, payload);
    }
  }

  send(event: string, payload: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, payload);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push({ event, payload });
      if (this.messageQueue.length > 100) {
        // Limit queue size to prevent memory issues
        this.messageQueue.shift();
      }
    }
  }

  startSession(payload: SessionStartPayload): void {
    this.send('session:start', payload);
  }

  endSession(payload: SessionEndPayload): void {
    this.send('session:end', payload);
  }

  logActivity(payload: ActivityLogPayload): void {
    this.send('activity:log', payload);
  }

  private handleIntervention(payload: InterventionPayload): void {
    console.log('Received intervention:', payload);
    this.showNotification('Flowstate', payload.message);
  }

  private handleSessionUpdate(payload: SessionUpdatePayload): void {
    // Store session update in chrome.storage for popup to read
    chrome.storage.local.set({ lastSessionUpdate: payload });
  }

  private showNotification(title: string, message: string): void {
    // Get icon URL
    const iconUrl = chrome.runtime.getURL('icons/icon-48.png');

    const notificationOptions: chrome.notifications.NotificationOptions<true> = {
      type: 'basic',
      title,
      message,
      iconUrl,
    };

    chrome.notifications.create(notificationOptions, (notificationId) => {
      // Check for errors in notification creation
      if (chrome.runtime.lastError) {
        console.error('Error creating notification:', chrome.runtime.lastError.message);
        return;
      }

      // Auto-dismiss after 5 seconds if notification was created successfully
      if (notificationId && typeof notificationId === 'string') {
        setTimeout(() => {
          // Clear notification - callback is optional in Manifest V3
          chrome.notifications.clear(notificationId);
        }, 5000);
      }
    });
  }

  disconnect(): void {
    this.isIntentionallyDisconnected = true;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getConnectionState(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) {
      return 'disconnected';
    }
    if (this.socket.connected) {
      return 'connected';
    }
    return 'connecting';
  }
}

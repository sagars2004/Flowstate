/**
 * Socket.io WebSocket server handler
 * Manages real-time connections from extension and frontend
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import type {
  SessionStartPayload,
  SessionEndPayload,
  ActivityLogPayload,
  InterventionPayload,
  SessionUpdatePayload,
} from '@flowstate/shared';
import { SessionService } from '../services/SessionService.js';
import { ActivityService } from '../services/ActivityService.js';
import { PatternAnalysisService } from '../patterns/index.js';
import { AIService } from '../ai/index.js';

interface ClientConnection {
  socket: Socket;
  sessionId: string | null;
  clientType: 'extension' | 'frontend';
  connectedAt: number;
}

export class WebSocketHandler {
  private io: SocketServer;
  private extensionConnections = new Map<string, Socket>(); // sessionId -> socket
  private frontendConnections = new Map<string, Socket>(); // sessionId -> socket
  private clientMap = new Map<string, ClientConnection>(); // socketId -> connection info

  constructor(
    httpServer: HttpServer,
    private readonly sessionService: SessionService,
    private readonly activityService: ActivityService,
    private readonly patternAnalysisService: PatternAnalysisService,
    private readonly aiService: AIService | null
  ) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: [
          process.env.CORS_ORIGIN || 'http://localhost:5173',
          'chrome-extension://*',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 10000,
      pingInterval: 5000,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientType = (socket.handshake.query.clientType as string) || 'unknown';
      console.log(`Client connected: ${socket.id} (type: ${clientType})`);

      if (clientType === 'extension') {
        this.handleExtensionConnection(socket);
      } else if (clientType === 'frontend') {
        this.handleFrontendConnection(socket);
      } else {
        console.warn(`Unknown client type: ${clientType}`);
        socket.disconnect();
        return;
      }

      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id} (reason: ${reason})`);
        this.handleDisconnect(socket);
      });

      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  private handleExtensionConnection(socket: Socket): void {
    // Session start
    socket.on('session:start', async (payload: SessionStartPayload) => {
      try {
        const session = await this.sessionService.createSession({
          id: payload.sessionId,
          startTime: new Date(payload.startTime),
        });

        this.extensionConnections.set(payload.sessionId, socket);
        this.clientMap.set(socket.id, {
          socket,
          sessionId: payload.sessionId,
          clientType: 'extension',
          connectedAt: Date.now(),
        });

        socket.emit('session:start', {
          success: true,
          sessionId: session.id,
          message: 'Session started successfully',
        });

        // Notify any listening frontend clients
        this.broadcastToFrontend(payload.sessionId, 'session:update', {
          sessionId: session.id,
          focusScore: 0,
          activityCount: 0,
          lastActivityTime: Date.now(),
          status: 'active',
        });

        console.log(`Session started: ${payload.sessionId}`);
      } catch (error) {
        console.error('Error starting session:', error);
        socket.emit('error', {
          code: 'SESSION_START_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    });

    // Session end
    socket.on('session:end', async (payload: SessionEndPayload) => {
      try {
        await this.sessionService.endSession(payload.sessionId);

        // Trigger post-session analysis (async, don't block)
        void this.triggerPostSessionAnalysis(payload.sessionId);

        // Notify frontend clients
        this.broadcastToFrontend(payload.sessionId, 'session:update', {
          sessionId: payload.sessionId,
          focusScore: null,
          activityCount: 0,
          lastActivityTime: Date.now(),
          status: 'completed',
        });

        socket.emit('session:end', {
          success: true,
          sessionId: payload.sessionId,
          message: 'Session ended successfully',
        });

        // Cleanup connection
        this.extensionConnections.delete(payload.sessionId);
        this.clientMap.delete(socket.id);

        console.log(`Session ended: ${payload.sessionId}`);
      } catch (error) {
        console.error('Error ending session:', error);
        socket.emit('error', {
          code: 'SESSION_END_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    });

    // Activity log
    socket.on('activity:log', async (payload: ActivityLogPayload) => {
      try {
        // Log activity to database
        await this.activityService.logActivity({
          sessionId: payload.sessionId,
          timestamp: new Date(payload.timestamp),
          eventType: payload.eventType as any,
          metadata: payload.metadata,
        });

        // Analyze pattern and trigger intervention if needed (async)
        void this.analyzePatternAndIntervene(payload);

        // Update frontend with session update
        try {
          const session = await this.sessionService.getSession(payload.sessionId);
          // Calculate focus score in real-time
          const activities = await this.activityService.getActivitiesBySession(payload.sessionId);
          const endTime = session.endTime || new Date();
          const durationMs = endTime.getTime() - session.startTime.getTime();
          const analysis = await this.patternAnalysisService.analyzeSession(session, activities);
          const focusScore = analysis.focusScore.overall;

          this.broadcastToFrontend(payload.sessionId, 'session:update', {
            sessionId: payload.sessionId,
            focusScore,
            activityCount: activities.length,
            lastActivityTime: payload.timestamp,
            status: 'active',
          });

          // Broadcast focus score update
          this.broadcastToFrontend(payload.sessionId, 'focus:update', {
            sessionId: payload.sessionId,
            focusScore,
            components: {
              typingConsistency: 0, // TODO: Calculate from activities
              contextSwitching: 0,
              idleTime: 0,
              siteFocus: 0,
            },
            timestamp: Date.now(),
          });
        } catch (error) {
          // Session might not exist yet, ignore
          console.debug('Session not found for activity update:', payload.sessionId);
        }
      } catch (error) {
        console.error('Error logging activity:', error);
        socket.emit('error', {
          code: 'ACTIVITY_LOG_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    });
  }

  private handleFrontendConnection(socket: Socket): void {
    // Frontend can subscribe to a specific session
    socket.on('session:subscribe', (sessionId: string) => {
      const connection = this.clientMap.get(socket.id);
      if (connection) {
        connection.sessionId = sessionId;
        this.frontendConnections.set(sessionId, socket);
      } else {
        this.clientMap.set(socket.id, {
          socket,
          sessionId,
          clientType: 'frontend',
          connectedAt: Date.now(),
        });
        this.frontendConnections.set(sessionId, socket);
      }

      socket.emit('session:subscribed', { sessionId });
      console.log(`Frontend subscribed to session: ${sessionId}`);
    });

    // Frontend can unsubscribe
    socket.on('session:unsubscribe', () => {
      const connection = this.clientMap.get(socket.id);
      if (connection && connection.sessionId) {
        this.frontendConnections.delete(connection.sessionId);
        connection.sessionId = null;
      }
    });
  }

  private handleDisconnect(socket: Socket): void {
    const connection = this.clientMap.get(socket.id);
    if (!connection) {
      return;
    }

    if (connection.clientType === 'extension' && connection.sessionId) {
      this.extensionConnections.delete(connection.sessionId);
    } else if (connection.clientType === 'frontend' && connection.sessionId) {
      this.frontendConnections.delete(connection.sessionId);
    }

    this.clientMap.delete(socket.id);
  }

  private broadcastToFrontend<T>(sessionId: string, event: string, data: T): void {
    const frontendSocket = this.frontendConnections.get(sessionId);
    if (frontendSocket && frontendSocket.connected) {
      frontendSocket.emit(event, data);
    }
  }

  private async analyzePatternAndIntervene(payload: ActivityLogPayload): Promise<void> {
    if (!this.aiService) {
      return; // AI service not available
    }

    try {
      // Get recent activities for pattern analysis (last 50)
      const allActivities = await this.activityService.getActivitiesBySession(payload.sessionId);
      const recentActivities = allActivities.slice(-50);

      if (recentActivities.length === 0) {
        return; // Not enough activities yet
      }

      // Detect patterns
      const patterns = await this.patternAnalysisService.analyzeRealtime(recentActivities);

      // If pattern detected, generate intervention for the first/most relevant pattern
      if (patterns.length > 0) {
        // Use the first pattern (most recent/relevant)
        const pattern = patterns[0];
        const intervention = await this.aiService.generateIntervention(pattern);

        // Map pattern type to intervention type/priority
        const interventionType = this.mapPatternToInterventionType(pattern.type);
        const priority = this.mapPatternToPriority(pattern.type);

        const interventionPayload: InterventionPayload = {
          interventionId: `intervention_${Date.now()}`,
          sessionId: payload.sessionId,
          message: intervention.message,
          type: interventionType,
          priority,
          timestamp: Date.now(),
          dismissible: true,
        };

        // Send to extension
        const extensionSocket = this.extensionConnections.get(payload.sessionId);
        if (extensionSocket && extensionSocket.connected) {
          extensionSocket.emit('intervention:send', interventionPayload);
        }

        // Also send to frontend if subscribed
        this.broadcastToFrontend(payload.sessionId, 'intervention:send', interventionPayload);
      }
    } catch (error) {
      console.error('Error analyzing pattern and intervening:', error);
      // Don't throw - this is async and shouldn't block activity logging
    }
  }

  private mapPatternToInterventionType(patternType: string): 'alert' | 'suggestion' | 'encouragement' | 'question' {
    switch (patternType) {
      case 'context_switching':
      case 'social_media_spiral':
        return 'alert';
      case 'extended_idle':
        return 'suggestion';
      case 'fragmented_focus':
        return 'question';
      default:
        return 'suggestion';
    }
  }

  private mapPatternToPriority(patternType: string): 'low' | 'medium' | 'high' {
    switch (patternType) {
      case 'social_media_spiral':
      case 'context_switching':
        return 'high';
      case 'extended_idle':
        return 'medium';
      default:
        return 'low';
    }
  }

  private async triggerPostSessionAnalysis(sessionId: string): Promise<void> {
    // This will be handled by the insights service when session ends
    // WebSocket just needs to notify that session ended
    // The actual analysis is triggered via the session service
    console.log(`Post-session analysis will be triggered for: ${sessionId}`);
  }

  // Public method to send intervention manually (for testing)
  sendIntervention(sessionId: string, intervention: InterventionPayload): void {
    const extensionSocket = this.extensionConnections.get(sessionId);
    if (extensionSocket && extensionSocket.connected) {
      extensionSocket.emit('intervention:send', intervention);
    }
    this.broadcastToFrontend(sessionId, 'intervention:send', intervention);
  }

  // Get connection stats (for debugging)
  getConnectionStats(): {
    extensionConnections: number;
    frontendConnections: number;
    totalConnections: number;
  } {
    return {
      extensionConnections: this.extensionConnections.size,
      frontendConnections: this.frontendConnections.size,
      totalConnections: this.clientMap.size,
    };
  }
}

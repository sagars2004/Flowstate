import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import { db } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { SessionRepository } from './repositories/SessionRepository.js';
import { ActivityRepository } from './repositories/ActivityRepository.js';
import { InsightRepository } from './repositories/InsightRepository.js';
import { SessionService } from './services/SessionService.js';
import { ActivityService } from './services/ActivityService.js';
import { InsightsService } from './services/InsightsService.js';
import { createSessionRouter } from './routes/sessions.js';
import { createActivityRouter } from './routes/activities.js';
import { createInsightsRouter } from './routes/insights.js';
import { GroqClient, AIService } from './ai/index.js';
import { PatternAnalysisService } from './patterns/index.js';
import { WebSocketHandler } from './websocket/socketHandler.js';

// Load environment variables
config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const healthData: {
    status: string;
    timestamp: string;
    uptime: number;
    groq?: {
      enabled: boolean;
      rateLimit?: {
        availableTokens: number;
        queueSize: number;
        timeUntilNextRequest: number;
      };
    };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Add Groq rate limit stats if available
  if (groqClient) {
    healthData.groq = {
      enabled: true,
      rateLimit: groqClient.getRateLimitStats(),
    };
  } else {
    healthData.groq = {
      enabled: false,
    };
  }

  res.json(healthData);
});

// Initialize repositories and services
const sessionRepository = new SessionRepository(db);
const activityRepository = new ActivityRepository(db);
const insightRepository = new InsightRepository(db);
const sessionService = new SessionService(sessionRepository, activityRepository);
const activityService = new ActivityService(activityRepository);
const patternAnalysisService = new PatternAnalysisService();

// Initialize Groq AI
const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  console.warn('⚠️  GROQ_API_KEY not set. AI features will be disabled.');
}

const groqClient = groqApiKey
  ? new GroqClient({
      apiKey: groqApiKey,
      model8B: process.env.GROQ_MODEL_8B || 'llama-3.1-8b-instant',
      model70B: process.env.GROQ_MODEL_70B || 'llama-3.3-70b-versatile',
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.GROQ_TEMPERATURE || '0.7'),
    })
  : null;

const aiService = groqClient ? new AIService(groqClient) : null;
const insightsService = new InsightsService(
  insightRepository,
  activityRepository,
  aiService,
  patternAnalysisService
);

// API routes
app.use('/api/sessions', createSessionRouter(sessionService));
app.use('/api/activities', createActivityRouter(activityService));
app.use('/api/insights', createInsightsRouter(insightsService, sessionRepository));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    // Run database migrations
    await runMigrations();
    console.log('✓ Database migrations complete');

    // Create HTTP server from Express app
    const httpServer = createServer(app);

    // Initialize WebSocket handler
    const wsHandler = new WebSocketHandler(
      httpServer,
      sessionService,
      activityService,
      patternAnalysisService,
      aiService
    );

    // Start HTTP server (which includes WebSocket support)
    httpServer.listen(PORT, () => {
      console.log(`🚀 Flowstate backend running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🤖 Groq AI: ${aiService ? 'Enabled' : 'Disabled (set GROQ_API_KEY)'}`);
      console.log(`🌐 WebSocket: Enabled on port ${PORT}`);
      console.log(`📝 API routes:`);
      console.log(`   - POST   /api/sessions`);
      console.log(`   - GET    /api/sessions`);
      console.log(`   - GET    /api/sessions/:id`);
      console.log(`   - GET    /api/sessions/:id/statistics`);
      console.log(`   - GET    /api/sessions/:id/analysis`);
      console.log(`   - PATCH  /api/sessions/:id/end`);
      console.log(`   - DELETE /api/sessions/:id`);
      console.log(`   - POST   /api/activities`);
      console.log(`   - POST   /api/activities/batch`);
      console.log(`   - GET    /api/activities?sessionId=<uuid>`);
      console.log(`   - POST   /api/insights/:sessionId`);
      console.log(`   - GET    /api/insights/:sessionId`);
      console.log(`   - GET    /api/insights/:sessionId/comparison`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

startServer();

export { app, aiService };

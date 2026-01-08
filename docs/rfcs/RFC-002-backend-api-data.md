# RFC-002: Backend API & Data Layer

**Status**: Approved  
**Created**: January 8, 2026  
**Author**: Flowstate Team  
**Related Features**: Backend API & Data Persistence

## Overview

This RFC defines the Express.js backend architecture with SQLite database for local-first data storage. The backend provides REST API endpoints for session management, activity logging, and data export, following a layered architecture pattern (routes → services → repositories).

## Purpose

Provide a robust, type-safe backend that handles session lifecycle, stores activity data locally, and coordinates with AI services while maintaining strict separation of concerns.

## Technical Approach

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Routes Layer                        │
│  - HTTP request handling                            │
│  - Request validation                               │
│  - Response formatting                              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                 Services Layer                       │
│  - Business logic                                   │
│  - Orchestration                                    │
│  - Cross-repository operations                      │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Repositories Layer                      │
│  - Database queries                                 │
│  - Data mapping                                     │
│  - CRUD operations                                  │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                SQLite Database                       │
│  - Local file storage                               │
│  - ACID transactions                                │
└─────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

```sql
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  focus_score REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'tab_switch', 'tab_activated', 'url_change',
    'typing', 'idle_start', 'idle_end',
    'window_focus', 'window_blur'
  )),
  url TEXT,
  typing_velocity REAL,
  idle_duration INTEGER,
  metadata TEXT, -- JSON blob for additional data
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Insights table
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  generated_at INTEGER NOT NULL,
  insights_json TEXT NOT NULL, -- JSON blob with insights array
  recommendations_json TEXT,   -- JSON blob with recommendations
  trend TEXT CHECK(trend IN ('improving', 'declining', 'stable')),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_activities_session_id ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activities_event_type ON activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_insights_session_id ON insights(session_id);
```

### Migration Strategy

```typescript
// src/db/migrations.ts
export interface Migration {
  version: number;
  up: string;
  down: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS sessions (...);
      CREATE TABLE IF NOT EXISTS activity_logs (...);
      CREATE TABLE IF NOT EXISTS insights (...);
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
      ...
    `,
    down: `
      DROP INDEX IF EXISTS idx_sessions_start_time;
      ...
      DROP TABLE IF EXISTS insights;
      DROP TABLE IF EXISTS activity_logs;
      DROP TABLE IF EXISTS sessions;
    `
  }
];

export async function runMigrations(db: Database): Promise<void> {
  // Create migrations table
  await db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Get current version
  const result = await db.get('SELECT MAX(version) as version FROM migrations');
  const currentVersion = result?.version || 0;

  // Apply pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Applying migration ${migration.version}...`);
      await db.exec(migration.up);
      await db.run('INSERT INTO migrations (version) VALUES (?)', [migration.version]);
    }
  }
}
```

## Repository Layer

### Base Repository

```typescript
// src/repositories/BaseRepository.ts
import { Database } from 'sqlite3';
import { promisify } from 'util';

export abstract class BaseRepository {
  protected db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  protected async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  protected async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T || null);
      });
    });
  }

  protected async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }
}
```

### Session Repository

```typescript
// src/repositories/SessionRepository.ts
import { BaseRepository } from './BaseRepository';

export interface SessionRow {
  id: string;
  start_time: number;
  end_time: number | null;
  focus_score: number | null;
  status: 'active' | 'completed' | 'abandoned';
  created_at: number;
  updated_at: number;
}

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

export class SessionRepository extends BaseRepository {
  async create(data: CreateSessionData): Promise<Session> {
    const sql = `
      INSERT INTO sessions (id, start_time, status)
      VALUES (?, ?, 'active')
    `;
    
    await this.run(sql, [data.id, data.startTime.getTime()]);
    
    const session = await this.findById(data.id);
    if (!session) {
      throw new Error('Failed to create session');
    }
    
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const sql = 'SELECT * FROM sessions WHERE id = ?';
    const row = await this.get<SessionRow>(sql, [id]);
    
    return row ? this.mapToSession(row) : null;
  }

  async findAll(options: {
    limit?: number;
    offset?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<Session[]> {
    let sql = 'SELECT * FROM sessions WHERE 1=1';
    const params: any[] = [];

    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    if (options.startDate) {
      sql += ' AND start_time >= ?';
      params.push(options.startDate.getTime());
    }

    if (options.endDate) {
      sql += ' AND start_time <= ?';
      params.push(options.endDate.getTime());
    }

    sql += ' ORDER BY start_time DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = await this.all<SessionRow>(sql, params);
    return rows.map(row => this.mapToSession(row));
  }

  async update(id: string, data: UpdateSessionData): Promise<Session> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.endTime !== undefined) {
      updates.push('end_time = ?');
      params.push(data.endTime.getTime());
    }

    if (data.focusScore !== undefined) {
      updates.push('focus_score = ?');
      params.push(data.focusScore);
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    updates.push('updated_at = ?');
    params.push(Date.now());

    params.push(id);

    const sql = `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`;
    await this.run(sql, params);

    const session = await this.findById(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    return session;
  }

  async delete(id: string): Promise<void> {
    const sql = 'DELETE FROM sessions WHERE id = ?';
    await this.run(sql, [id]);
  }

  async getStatistics(sessionId: string): Promise<{
    totalActivities: number;
    totalTypingTime: number;
    totalIdleTime: number;
    tabSwitchCount: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_activities,
        SUM(CASE WHEN event_type = 'typing' THEN 1 ELSE 0 END) as typing_events,
        SUM(CASE WHEN event_type = 'idle_end' THEN idle_duration ELSE 0 END) as total_idle_time,
        SUM(CASE WHEN event_type = 'tab_switch' THEN 1 ELSE 0 END) as tab_switch_count
      FROM activity_logs
      WHERE session_id = ?
    `;

    const result = await this.get<any>(sql, [sessionId]);

    return {
      totalActivities: result?.total_activities || 0,
      totalTypingTime: result?.typing_events * 10000 || 0, // Estimate based on batch interval
      totalIdleTime: result?.total_idle_time || 0,
      tabSwitchCount: result?.tab_switch_count || 0
    };
  }

  private mapToSession(row: SessionRow): Session {
    return {
      id: row.id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      focusScore: row.focus_score,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
```

### Activity Repository

```typescript
// src/repositories/ActivityRepository.ts
import { BaseRepository } from './BaseRepository';

export interface ActivityRow {
  id: number;
  session_id: string;
  timestamp: number;
  event_type: string;
  url: string | null;
  typing_velocity: number | null;
  idle_duration: number | null;
  metadata: string | null;
  created_at: number;
}

export interface Activity {
  id: number;
  sessionId: string;
  timestamp: Date;
  eventType: string;
  url: string | null;
  typingVelocity: number | null;
  idleDuration: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateActivityData {
  sessionId: string;
  timestamp: Date;
  eventType: string;
  url?: string;
  typingVelocity?: number;
  idleDuration?: number;
  metadata?: Record<string, unknown>;
}

export class ActivityRepository extends BaseRepository {
  async create(data: CreateActivityData): Promise<Activity> {
    const sql = `
      INSERT INTO activity_logs (
        session_id, timestamp, event_type, url, 
        typing_velocity, idle_duration, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.run(sql, [
      data.sessionId,
      data.timestamp.getTime(),
      data.eventType,
      data.url || null,
      data.typingVelocity || null,
      data.idleDuration || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ]);

    const activity = await this.findById(result.lastID);
    if (!activity) {
      throw new Error('Failed to create activity');
    }

    return activity;
  }

  async createBatch(activities: CreateActivityData[]): Promise<void> {
    if (activities.length === 0) return;

    const sql = `
      INSERT INTO activity_logs (
        session_id, timestamp, event_type, url,
        typing_velocity, idle_duration, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Use transaction for batch insert
    await new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        for (const data of activities) {
          this.db.run(sql, [
            data.sessionId,
            data.timestamp.getTime(),
            data.eventType,
            data.url || null,
            data.typingVelocity || null,
            data.idleDuration || null,
            data.metadata ? JSON.stringify(data.metadata) : null
          ]);
        }

        this.db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async findById(id: number): Promise<Activity | null> {
    const sql = 'SELECT * FROM activity_logs WHERE id = ?';
    const row = await this.get<ActivityRow>(sql, [id]);
    
    return row ? this.mapToActivity(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<Activity[]> {
    const sql = `
      SELECT * FROM activity_logs 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `;
    
    const rows = await this.all<ActivityRow>(sql, [sessionId]);
    return rows.map(row => this.mapToActivity(row));
  }

  async findBySessionIdAndType(sessionId: string, eventType: string): Promise<Activity[]> {
    const sql = `
      SELECT * FROM activity_logs 
      WHERE session_id = ? AND event_type = ?
      ORDER BY timestamp ASC
    `;
    
    const rows = await this.all<ActivityRow>(sql, [sessionId, eventType]);
    return rows.map(row => this.mapToActivity(row));
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const sql = 'DELETE FROM activity_logs WHERE session_id = ?';
    await this.run(sql, [sessionId]);
  }

  private mapToActivity(row: ActivityRow): Activity {
    return {
      id: row.id,
      sessionId: row.session_id,
      timestamp: new Date(row.timestamp),
      eventType: row.event_type,
      url: row.url,
      typingVelocity: row.typing_velocity,
      idleDuration: row.idle_duration,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.created_at)
    };
  }
}
```

## Service Layer

### Session Service

```typescript
// src/services/SessionService.ts
import { SessionRepository, CreateSessionData, UpdateSessionData } from '../repositories/SessionRepository';
import { ActivityRepository } from '../repositories/ActivityRepository';
import { NotFoundError } from '../middleware/errors';

export class SessionService {
  constructor(
    private sessionRepository: SessionRepository,
    private activityRepository: ActivityRepository
  ) {}

  async createSession(data: CreateSessionData) {
    return await this.sessionRepository.create(data);
  }

  async getSession(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }
    return session;
  }

  async getAllSessions(options: {
    limit?: number;
    offset?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    return await this.sessionRepository.findAll(options);
  }

  async endSession(sessionId: string, focusScore: number) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }

    return await this.sessionRepository.update(sessionId, {
      endTime: new Date(),
      focusScore,
      status: 'completed'
    });
  }

  async deleteSession(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }

    // Delete activities first (cascade should handle this, but explicit is better)
    await this.activityRepository.deleteBySessionId(sessionId);
    await this.sessionRepository.delete(sessionId);
  }

  async getSessionWithStatistics(sessionId: string) {
    const session = await this.getSession(sessionId);
    const statistics = await this.sessionRepository.getStatistics(sessionId);

    return {
      ...session,
      statistics
    };
  }
}
```

## REST API Endpoints

### Session Endpoints

```typescript
// src/routes/sessions.ts
import { Router, Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/SessionService';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

export function createSessionRoutes(sessionService: SessionService): Router {
  const router = Router();

  // POST /api/sessions/start - Create new session
  router.post(
    '/start',
    [
      body('sessionId').isString().notEmpty(),
      body('startTime').isISO8601()
    ],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { sessionId, startTime } = req.body;
        const session = await sessionService.createSession({
          id: sessionId,
          startTime: new Date(startTime)
        });

        res.status(201).json({
          success: true,
          data: session
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/sessions/:id/end - End session
  router.post(
    '/:id/end',
    [
      param('id').isString().notEmpty(),
      body('focusScore').isFloat({ min: 0, max: 100 })
    ],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { focusScore } = req.body;

        const session = await sessionService.endSession(id, focusScore);

        res.json({
          success: true,
          data: session
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/sessions/:id - Get session by ID
  router.get(
    '/:id',
    [param('id').isString().notEmpty()],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const session = await sessionService.getSessionWithStatistics(id);

        res.json({
          success: true,
          data: session
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/sessions - List sessions
  router.get(
    '/',
    [
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('offset').optional().isInt({ min: 0 }),
      query('status').optional().isIn(['active', 'completed', 'abandoned']),
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601()
    ],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const options = {
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
          status: req.query.status as string | undefined,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
        };

        const sessions = await sessionService.getAllSessions(options);

        res.json({
          success: true,
          data: sessions,
          meta: {
            count: sessions.length,
            limit: options.limit,
            offset: options.offset
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // DELETE /api/sessions/:id - Delete session
  router.delete(
    '/:id',
    [param('id').isString().notEmpty()],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        await sessionService.deleteSession(id);

        res.json({
          success: true,
          message: `Session ${id} deleted`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
```

### Activity Endpoints

```typescript
// src/routes/activities.ts
import { Router, Request, Response, NextFunction } from 'express';
import { ActivityService } from '../services/ActivityService';
import { validateRequest } from '../middleware/validation';
import { body, param } from 'express-validator';

export function createActivityRoutes(activityService: ActivityService): Router {
  const router = Router();

  // POST /api/activity - Log single activity
  router.post(
    '/',
    [
      body('sessionId').isString().notEmpty(),
      body('timestamp').isISO8601(),
      body('eventType').isString().notEmpty(),
      body('url').optional().isString(),
      body('typingVelocity').optional().isFloat(),
      body('idleDuration').optional().isInt(),
      body('metadata').optional().isObject()
    ],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const activity = await activityService.logActivity({
          sessionId: req.body.sessionId,
          timestamp: new Date(req.body.timestamp),
          eventType: req.body.eventType,
          url: req.body.url,
          typingVelocity: req.body.typingVelocity,
          idleDuration: req.body.idleDuration,
          metadata: req.body.metadata
        });

        res.status(201).json({
          success: true,
          data: activity
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/activity/batch - Log multiple activities
  router.post(
    '/batch',
    [
      body('activities').isArray({ min: 1 }),
      body('activities.*.sessionId').isString().notEmpty(),
      body('activities.*.timestamp').isISO8601(),
      body('activities.*.eventType').isString().notEmpty()
    ],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const activities = req.body.activities.map((a: any) => ({
          sessionId: a.sessionId,
          timestamp: new Date(a.timestamp),
          eventType: a.eventType,
          url: a.url,
          typingVelocity: a.typingVelocity,
          idleDuration: a.idleDuration,
          metadata: a.metadata
        }));

        await activityService.logActivitiesBatch(activities);

        res.status(201).json({
          success: true,
          message: `${activities.length} activities logged`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/activity/session/:sessionId - Get activities for session
  router.get(
    '/session/:sessionId',
    [param('sessionId').isString().notEmpty()],
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { sessionId } = req.params;
        const activities = await activityService.getActivitiesBySession(sessionId);

        res.json({
          success: true,
          data: activities,
          meta: {
            count: activities.length
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
```

## Error Handling

### Custom Error Classes

```typescript
// src/middleware/errors.ts
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}
```

### Global Error Handler

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
    return;
  }

  // Unknown error
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}
```

## Server Setup

```typescript
// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Database } from 'sqlite3';
import { runMigrations } from './db/migrations';
import { SessionRepository } from './repositories/SessionRepository';
import { ActivityRepository } from './repositories/ActivityRepository';
import { SessionService } from './services/SessionService';
import { ActivityService } from './services/ActivityService';
import { createSessionRoutes } from './routes/sessions';
import { createActivityRoutes } from './routes/activities';
import { errorHandler } from './middleware/errorHandler';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // Database setup
  const db = new Database(process.env.DATABASE_PATH || './data/flowstate.db');
  await runMigrations(db);

  // Repositories
  const sessionRepository = new SessionRepository(db);
  const activityRepository = new ActivityRepository(db);

  // Services
  const sessionService = new SessionService(sessionRepository, activityRepository);
  const activityService = new ActivityService(activityRepository);

  // Routes
  app.use('/api/sessions', createSessionRoutes(sessionService));
  app.use('/api/activity', createActivityRoutes(activityService));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`Flowstate backend running on port ${PORT}`);
  });
}

startServer().catch(console.error);
```

## Testing Criteria

### Unit Tests
- [ ] Repository CRUD operations work correctly
- [ ] Service layer orchestrates repositories properly
- [ ] Error handling throws correct error types
- [ ] Data mapping (row → model) is accurate

### Integration Tests
- [ ] POST /api/sessions/start creates session
- [ ] GET /api/sessions/:id returns correct session
- [ ] POST /api/sessions/:id/end updates session
- [ ] DELETE /api/sessions/:id deletes session and activities
- [ ] POST /api/activity logs activity correctly
- [ ] POST /api/activity/batch handles multiple activities
- [ ] GET /api/activity/session/:id returns activities

### Performance Tests
- [ ] Batch activity insert handles 1000+ activities
- [ ] Session list query with 10,000+ sessions performs well
- [ ] Database indices improve query performance

## Implementation Checklist

- [ ] Set up Express server with TypeScript
- [ ] Create SQLite database and schema
- [ ] Implement database migrations system
- [ ] Create BaseRepository with promise-based DB methods
- [ ] Implement SessionRepository with CRUD operations
- [ ] Implement ActivityRepository with CRUD operations
- [ ] Create SessionService for business logic
- [ ] Create ActivityService for business logic
- [ ] Implement session REST endpoints
- [ ] Implement activity REST endpoints
- [ ] Add request validation middleware
- [ ] Add error handling middleware
- [ ] Add CORS and security headers
- [ ] Add logging with Morgan
- [ ] Create health check endpoint
- [ ] Test all endpoints with Postman/curl

## Security Considerations

- SQLite database file permissions (0600)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- Rate limiting on API endpoints (future enhancement)
- CORS configuration for frontend only

## Future Enhancements

- Database connection pooling
- Query result caching (Redis)
- API rate limiting
- Audit logging
- Database backups and archival
- GraphQL API (alternative to REST)

---

**Approval**: Ready for Implementation  
**Dependencies**: None (can be implemented independently)

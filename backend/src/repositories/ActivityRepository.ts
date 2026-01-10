import { BaseRepository } from './BaseRepository.js';
import type { Activity, CreateActivityData } from '@flowstate/shared';

interface ActivityRow {
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
      data.metadata ? JSON.stringify(data.metadata) : null,
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

    // Use a transaction for batch insert
    await this.db.exec('BEGIN TRANSACTION');

    try {
      for (const data of activities) {
        await this.run(sql, [
          data.sessionId,
          data.timestamp.getTime(),
          data.eventType,
          data.url || null,
          data.typingVelocity || null,
          data.idleDuration || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]);
      }
      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }
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
    return rows.map((row) => this.mapToActivity(row));
  }

  async findBySessionIdAndType(sessionId: string, eventType: string): Promise<Activity[]> {
    const sql = `
      SELECT * FROM activity_logs 
      WHERE session_id = ? AND event_type = ?
      ORDER BY timestamp ASC
    `;

    const rows = await this.all<ActivityRow>(sql, [sessionId, eventType]);
    return rows.map((row) => this.mapToActivity(row));
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
      eventType: row.event_type as any,
      url: row.url,
      typingVelocity: row.typing_velocity,
      idleDuration: row.idle_duration,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.created_at),
    };
  }
}

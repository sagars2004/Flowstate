import { BaseRepository } from './BaseRepository.js';
import type { Session, CreateSessionData, UpdateSessionData } from '@flowstate/shared';

interface SessionRow {
  id: string;
  start_time: number;
  end_time: number | null;
  focus_score: number | null;
  status: 'active' | 'completed' | 'abandoned';
  created_at: number;
  updated_at: number;
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
    return rows.map((row) => this.mapToSession(row));
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
      totalTypingTime: (result?.typing_events || 0) * 10000, // Estimate based on batch interval
      totalIdleTime: result?.total_idle_time || 0,
      tabSwitchCount: result?.tab_switch_count || 0,
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
      updatedAt: new Date(row.updated_at),
    };
  }
}

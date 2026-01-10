import { BaseRepository } from './BaseRepository.js';
import type { Insight, CreateInsightData } from '@flowstate/shared';

interface InsightRow {
  id: number;
  session_id: string;
  generated_at: number;
  insights_json: string;
  recommendations_json: string;
  created_at: number;
}

export class InsightRepository extends BaseRepository {
  async create(data: CreateInsightData): Promise<Insight> {
    const sql = `
      INSERT INTO insights (
        session_id, generated_at, insights_json, recommendations_json
      )
      VALUES (?, ?, ?, ?)
    `;

    const result = await this.run(sql, [
      data.sessionId,
      Date.now(),
      data.insightsJson,
      data.recommendationsJson,
    ]);

    const insight = await this.findById(result.lastID);
    if (!insight) {
      throw new Error('Failed to create insight');
    }

    return insight;
  }

  async findById(id: number): Promise<Insight | null> {
    const sql = 'SELECT * FROM insights WHERE id = ?';
    const row = await this.get<InsightRow>(sql, [id]);

    return row ? this.mapToInsight(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<Insight[]> {
    const sql = `
      SELECT * FROM insights 
      WHERE session_id = ? 
      ORDER BY generated_at DESC
    `;

    const rows = await this.all<InsightRow>(sql, [sessionId]);
    return rows.map((row) => this.mapToInsight(row));
  }

  async findLatestBySessionId(sessionId: string): Promise<Insight | null> {
    const sql = `
      SELECT * FROM insights 
      WHERE session_id = ? 
      ORDER BY generated_at DESC 
      LIMIT 1
    `;

    const row = await this.get<InsightRow>(sql, [sessionId]);
    return row ? this.mapToInsight(row) : null;
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const sql = 'DELETE FROM insights WHERE session_id = ?';
    await this.run(sql, [sessionId]);
  }

  private mapToInsight(row: InsightRow): Insight {
    return {
      id: row.id,
      sessionId: row.session_id,
      generatedAt: new Date(row.generated_at),
      insightsJson: row.insights_json,
      recommendationsJson: row.recommendations_json,
      createdAt: new Date(row.created_at),
    };
  }
}

import { Database } from '../db/database.js';

export abstract class BaseRepository {
  protected db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  protected async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return await this.db.run(sql, params);
  }

  protected async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    return await this.db.get<T>(sql, params);
  }

  protected async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return await this.db.all<T>(sql, params);
  }
}

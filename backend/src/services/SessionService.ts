import { SessionRepository } from '../repositories/SessionRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { NotFoundError } from '../middleware/errors.js';
import type { Session, CreateSessionData, UpdateSessionData } from '@flowstate/shared';

export class SessionService {
  constructor(
    private sessionRepository: SessionRepository,
    private activityRepository: ActivityRepository
  ) {}

  async createSession(data: CreateSessionData): Promise<Session> {
    return await this.sessionRepository.create(data);
  }

  async getSession(sessionId: string): Promise<Session> {
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
  } = {}): Promise<Session[]> {
    return await this.sessionRepository.findAll(options);
  }

  async endSession(sessionId: string, focusScore: number): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }

    return await this.sessionRepository.update(sessionId, {
      endTime: new Date(),
      focusScore,
      status: 'completed',
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }

    // Delete activities first (cascade should handle this, but explicit is better)
    await this.activityRepository.deleteBySessionId(sessionId);
    await this.sessionRepository.delete(sessionId);
  }

  async getSessionWithStatistics(sessionId: string): Promise<Session & { statistics: any }> {
    const session = await this.getSession(sessionId);
    const statistics = await this.sessionRepository.getStatistics(sessionId);

    return {
      ...session,
      statistics,
    };
  }
}

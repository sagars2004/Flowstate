import { SessionRepository } from '../repositories/SessionRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { NotFoundError } from '../middleware/errors.js';
import { PatternAnalysisService } from '../patterns/PatternAnalysisService.js';
import type { Session, CreateSessionData, UpdateSessionData } from '@flowstate/shared';
import type { PatternAnalysisResult } from '../patterns/index.js';

export class SessionService {
  private patternAnalysisService: PatternAnalysisService;

  constructor(
    private sessionRepository: SessionRepository,
    private activityRepository: ActivityRepository
  ) {
    this.patternAnalysisService = new PatternAnalysisService();
  }

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

  async endSession(sessionId: string, focusScore?: number): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} not found`);
    }

    // Get activities for analysis if focus score not provided
    let calculatedFocusScore = focusScore;
    if (!focusScore) {
      const activities = await this.activityRepository.findBySessionId(sessionId);
      const analysis = await this.patternAnalysisService.analyzeSession(session, activities);
      calculatedFocusScore = analysis.focusScore.overall;
    }

    return await this.sessionRepository.update(sessionId, {
      endTime: new Date(),
      focusScore: calculatedFocusScore,
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

  /**
   * Get session with full pattern analysis
   */
  async getSessionWithAnalysis(sessionId: string): Promise<Session & { analysis: PatternAnalysisResult }> {
    const session = await this.getSession(sessionId);
    const activities = await this.activityRepository.findBySessionId(sessionId);
    const analysis = await this.patternAnalysisService.analyzeSession(session, activities);

    return {
      ...session,
      analysis,
    };
  }
}

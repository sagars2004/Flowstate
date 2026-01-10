import { Router, Request, Response, NextFunction } from 'express';
import { param } from 'express-validator';
import { InsightsService } from '../services/InsightsService.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { validateRequest } from '../middleware/validation.js';
import { NotFoundError } from '../middleware/errors.js';

export function createInsightsRouter(
  insightsService: InsightsService,
  sessionRepository: SessionRepository
): Router {
  const router = Router();

  // POST /api/insights/:sessionId - Generate insights for a session
  router.post(
    '/:sessionId',
    [param('sessionId').isUUID().withMessage('Invalid session ID'), validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await sessionRepository.findById(req.params.sessionId);
        if (!session) {
          throw new NotFoundError(`Session ${req.params.sessionId} not found`);
        }

        const insights = await insightsService.generateSessionInsights(session);

        res.status(201).json({
          success: true,
          data: insights,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/insights/:sessionId - Get insights for a session
  router.get(
    '/:sessionId',
    [param('sessionId').isUUID().withMessage('Invalid session ID'), validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await sessionRepository.findById(req.params.sessionId);
        if (!session) {
          throw new NotFoundError(`Session ${req.params.sessionId} not found`);
        }

        const insights = await insightsService.getOrGenerateInsights(session);

        res.json({
          success: true,
          data: insights,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/insights/:sessionId/comparison - Get comparative insights
  router.get(
    '/:sessionId/comparison',
    [param('sessionId').isUUID().withMessage('Invalid session ID'), validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await sessionRepository.findById(req.params.sessionId);
        if (!session) {
          throw new NotFoundError(`Session ${req.params.sessionId} not found`);
        }

        // Get last 10 completed sessions for comparison
        const historicalSessions = await sessionRepository.findAll({
          status: 'completed',
          limit: 10,
        });

        // Filter out current session
        const historicalFiltered = historicalSessions.filter((s) => s.id !== session.id);

        const comparison = await insightsService.generateComparativeInsight(session, historicalFiltered);

        res.json({
          success: true,
          data: {
            sessionId: session.id,
            comparison,
            historicalSessionCount: historicalFiltered.length,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

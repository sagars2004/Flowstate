import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { SessionService } from '../services/SessionService.js';
import { validateRequest } from '../middleware/validation.js';
import { v4 as uuidv4 } from 'uuid';

export function createSessionRouter(sessionService: SessionService): Router {
  const router = Router();

  // POST /api/sessions - Create a new session
  router.post(
    '/',
    [
      body('startTime').optional().isISO8601().withMessage('startTime must be a valid ISO 8601 date'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startTime = req.body.startTime ? new Date(req.body.startTime) : new Date();
        const sessionId = uuidv4();

        const session = await sessionService.createSession({
          id: sessionId,
          startTime,
        });

        res.status(201).json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/sessions - Get all sessions with optional filters
  router.get(
    '/',
    [
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('offset must be non-negative'),
      query('status').optional().isIn(['active', 'completed', 'abandoned']).withMessage('Invalid status'),
      query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO 8601 date'),
      query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO 8601 date'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const options = {
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
          status: req.query.status as string | undefined,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        };

        const sessions = await sessionService.getAllSessions(options);

        res.json({
          success: true,
          data: sessions,
          count: sessions.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/sessions/:id - Get a single session by ID
  router.get(
    '/:id',
    [param('id').isUUID().withMessage('Invalid session ID'), validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await sessionService.getSession(req.params.id);

        res.json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/sessions/:id/statistics - Get session with statistics
  router.get(
    '/:id/statistics',
    [param('id').isUUID().withMessage('Invalid session ID'), validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionWithStats = await sessionService.getSessionWithStatistics(req.params.id);

        res.json({
          success: true,
          data: sessionWithStats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/sessions/:id/end - End a session
  router.patch(
    '/:id/end',
    [
      param('id').isUUID().withMessage('Invalid session ID'),
      body('focusScore').isFloat({ min: 0, max: 100 }).withMessage('focusScore must be between 0 and 100'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await sessionService.endSession(req.params.id, req.body.focusScore);

        res.json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // DELETE /api/sessions/:id - Delete a session
  router.delete(
    '/:id',
    [param('id').isUUID().withMessage('Invalid session ID'), validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await sessionService.deleteSession(req.params.id);

        res.json({
          success: true,
          message: `Session ${req.params.id} deleted`,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

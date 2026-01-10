import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { ActivityService } from '../services/ActivityService.js';
import { validateRequest } from '../middleware/validation.js';

export function createActivityRouter(activityService: ActivityService): Router {
  const router = Router();

  // POST /api/activities - Log a single activity
  router.post(
    '/',
    [
      body('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
      body('timestamp').optional().isISO8601().withMessage('timestamp must be a valid ISO 8601 date'),
      body('eventType')
        .isIn(['tab_switch', 'typing', 'idle_start', 'idle_end', 'app_switch'])
        .withMessage('Invalid eventType'),
      body('url').optional().isString().withMessage('url must be a string'),
      body('typingVelocity').optional().isFloat({ min: 0 }).withMessage('typingVelocity must be non-negative'),
      body('idleDuration').optional().isInt({ min: 0 }).withMessage('idleDuration must be non-negative'),
      body('metadata').optional().isObject().withMessage('metadata must be an object'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const activityData = {
          sessionId: req.body.sessionId,
          timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
          eventType: req.body.eventType,
          url: req.body.url,
          typingVelocity: req.body.typingVelocity,
          idleDuration: req.body.idleDuration,
          metadata: req.body.metadata,
        };

        const activity = await activityService.logActivity(activityData);

        res.status(201).json({
          success: true,
          data: activity,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/activities/batch - Log multiple activities at once
  router.post(
    '/batch',
    [
      body('activities').isArray({ min: 1 }).withMessage('activities must be a non-empty array'),
      body('activities.*.sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
      body('activities.*.timestamp')
        .optional()
        .isISO8601()
        .withMessage('timestamp must be a valid ISO 8601 date'),
      body('activities.*.eventType')
        .isIn(['tab_switch', 'typing', 'idle_start', 'idle_end', 'app_switch'])
        .withMessage('Invalid eventType'),
      body('activities.*.url').optional().isString().withMessage('url must be a string'),
      body('activities.*.typingVelocity')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('typingVelocity must be non-negative'),
      body('activities.*.idleDuration')
        .optional()
        .isInt({ min: 0 })
        .withMessage('idleDuration must be non-negative'),
      body('activities.*.metadata').optional().isObject().withMessage('metadata must be an object'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const activities = req.body.activities.map((activity: any) => ({
          sessionId: activity.sessionId,
          timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date(),
          eventType: activity.eventType,
          url: activity.url,
          typingVelocity: activity.typingVelocity,
          idleDuration: activity.idleDuration,
          metadata: activity.metadata,
        }));

        await activityService.logActivitiesBatch(activities);

        res.status(201).json({
          success: true,
          message: `Successfully logged ${activities.length} activities`,
          count: activities.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/activities - Get activities by session ID and optional event type
  router.get(
    '/',
    [
      query('sessionId').isUUID().withMessage('sessionId must be a valid UUID'),
      query('eventType')
        .optional()
        .isIn(['tab_switch', 'typing', 'idle_start', 'idle_end', 'app_switch'])
        .withMessage('Invalid eventType'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = req.query.sessionId as string;
        const eventType = req.query.eventType as string | undefined;

        const activities = eventType
          ? await activityService.getActivitiesBySessionAndType(sessionId, eventType)
          : await activityService.getActivitiesBySession(sessionId);

        res.json({
          success: true,
          data: activities,
          count: activities.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

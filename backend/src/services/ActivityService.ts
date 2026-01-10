import { ActivityRepository } from '../repositories/ActivityRepository.js';
import type { Activity, CreateActivityData } from '@flowstate/shared';

export class ActivityService {
  constructor(private activityRepository: ActivityRepository) {}

  async logActivity(data: CreateActivityData): Promise<Activity> {
    return await this.activityRepository.create(data);
  }

  async logActivitiesBatch(activities: CreateActivityData[]): Promise<void> {
    await this.activityRepository.createBatch(activities);
  }

  async getActivitiesBySession(sessionId: string): Promise<Activity[]> {
    return await this.activityRepository.findBySessionId(sessionId);
  }

  async getActivitiesBySessionAndType(sessionId: string, eventType: string): Promise<Activity[]> {
    return await this.activityRepository.findBySessionIdAndType(sessionId, eventType);
  }
}

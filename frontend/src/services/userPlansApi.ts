import apiClient from './api';
import type { UserPlan, UserUsage, PlanLimitCheck } from '../types/shared';

export const userPlansApi = {
  // Get current user usage information
  async getUserUsage(): Promise<{ success: boolean; usage: UserUsage }> {
    const response = await apiClient.get('/user-plans/usage');
    return response.data;
  },

  // Check current user limits
  async checkLimits(estimatedAds: number = 20): Promise<{ success: boolean; limits: PlanLimitCheck }> {
    const response = await apiClient.get(`/user-plans/limits?estimatedAds=${estimatedAds}`);
    return response.data;
  },

  // Get available plans
  async getPlans(): Promise<{ success: boolean; plans: UserPlan[] }> {
    const response = await apiClient.get('/user-plans/plans');
    return response.data;
  },

  // Upgrade user plan (admin only for now)
  async upgradePlan(planType: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio'): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/user-plans/upgrade', { planType });
    return response.data;
  },

};

import { Injectable, inject } from '@angular/core';
import { SubscriptionPlan } from '../models/subscription-view.model';
import { SupabaseService } from './supabase-service';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionViewService {
  private supabaseService = inject(SupabaseService);

  // --- CACHE STATE ---
  private plansCache: SubscriptionPlan[] | null = null;
  
  // We use `undefined` to mean "not fetched yet", and `null` to mean "fetched, but user has zero subscriptions"
  private cachedLatestSub: { status: string; end_date: string | null } | null | undefined = undefined;

  private get supabase() {
    return this.supabaseService.client;
  }

  /**
   * Fetches all active plans, including their features and prices.
   */
  async getActiveSubscriptions(forceRefresh = false): Promise<SubscriptionPlan[]> {
    // Return cached plans if they exist and we aren't forcing a refresh
    if (!forceRefresh && this.plansCache) {
      return this.plansCache;
    }

    // Check localStorage cache
    if (!forceRefresh && typeof window !== 'undefined' && window.localStorage) {
      const local = localStorage.getItem('gym_active_plans');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          this.plansCache = parsed;
          // Trigger background fetch to keep it up to date
          this.fetchActiveSubscriptionsBackground();
          return parsed;
        } catch (e) {}
      }
    }

    return this.fetchActiveSubscriptionsBackground();
  }

  private async fetchActiveSubscriptionsBackground(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await this.supabase
        .from('plans')
        .select(`
          id, name, description, is_active,
          plan_features (id, name),
          plan_prices (id, name, price, duration_in_days)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching subscriptions:', error);
        throw error;
      }

      // Sort prices within each plan by duration ascending
      const formattedData = data.map(plan => {
        if (plan.plan_prices) {
          plan.plan_prices.sort((a: any, b: any) => a.duration_in_days - b.duration_in_days);
        }
        return plan as SubscriptionPlan;
      });

      this.plansCache = formattedData;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('gym_active_plans', JSON.stringify(formattedData));
      }
      return formattedData;
    } catch (e) {
      return this.plansCache || [];
    }
  }

  /**
   * Fetches the user's latest subscription status and end date.
   */
  async getLatestSubscriptionDetails(profileId: string, forceRefresh = false): Promise<{ status: string, end_date: string | null } | null> {
    // Return cached data if it exists (check strictly against undefined so we don't accidentally skip nulls)
    if (!forceRefresh && this.cachedLatestSub !== undefined) {
      return this.cachedLatestSub;
    }

    const localKey = `gym_latest_sub_${profileId}`;
    if (!forceRefresh && typeof window !== 'undefined' && window.localStorage) {
      const local = localStorage.getItem(localKey);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          this.cachedLatestSub = parsed;
          // Trigger background fetch to verify status
          this.fetchLatestSubscriptionDetailsBackground(profileId, localKey);
          return parsed;
        } catch (e) {}
      }
    }

    return this.fetchLatestSubscriptionDetailsBackground(profileId, localKey);
  }

  private async fetchLatestSubscriptionDetailsBackground(profileId: string, localKey: string): Promise<{ status: string, end_date: string | null } | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .select('status, end_date')
        .eq('profile_id', profileId)
        .order('requested_at', { ascending: false }) // Gets the absolute newest request
        .limit(1)
        .maybeSingle(); 

      if (error) {
        console.error('Error fetching latest subscription details:', error.message);
        throw error;
      }

      this.cachedLatestSub = data;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(localKey, JSON.stringify(data));
      }
      return this.cachedLatestSub;
    } catch (e) {
      return this.cachedLatestSub !== undefined ? this.cachedLatestSub : null;
    }
  }

  /**
   * Clears all cached subscription data.
   * Call this explicitly when a user successfully completes a purchase,
   * cancels a plan, or logs out, so the next view fetches fresh data.
   */
  clearSubscriptionCache() {
    this.plansCache = null;
    this.cachedLatestSub = undefined;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('gym_active_plans');
      const profileId = this.supabaseService.currentUser()?.id;
      if (profileId) {
        localStorage.removeItem(`gym_latest_sub_${profileId}`);
      }
    }
  }
}
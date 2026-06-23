import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../services/supabase-service';

export interface DashboardSnapshot {
  id: number;
  updated_at: string;
  last_month_earnings: number;
  current_month_earnings: number;
  yesterdays_attendance: number;
  expiring_7_days_count: number;
  expired_count: number;
  active_coupons: number;
  active_announcements: number;
  total_diet_plans: number;
  total_workout_plans: number;
  active_users_count: number; // ✅ NEW FIELD ADDED
  monthly_earnings_history: { month: string, earning: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class AdminDashboardService {
  private supabaseService = inject(SupabaseService);
  private readonly CACHE_KEY = 'gym_admin_daily_snapshot';
  private readonly SYNC_TIME_KEY = 'admin_last_sync_time';

  // ✅ 1. STATE SUSTAINER: This keeps data alive during Tab Switching
  dashboardState = signal<DashboardSnapshot | null>(null);

  async getDashboardData(forceRefresh = false): Promise<{ data: DashboardSnapshot | null, error: any }> {
    const today = new Date().toLocaleDateString('en-CA');
    const now = Date.now();

    // ✅ 2. TAB SWITCHING: Instantly return memory state (0ms delay, 0 API calls)
    if (!forceRefresh && this.dashboardState()) {
      const lastSync = parseInt(localStorage.getItem(this.SYNC_TIME_KEY) || '0', 10);
      // Only fetch if memory exists but it's a new day
      const memoryDate = new Date(this.dashboardState()!.updated_at).toLocaleDateString('en-CA');
      if (memoryDate === today) {
        return { data: this.dashboardState(), error: null };
      }
    }

    // ✅ 3. LOCAL STORAGE CACHE: Handles Hard Page Reloads
    if (!forceRefresh) {
      const cachedString = localStorage.getItem(this.CACHE_KEY);
      if (cachedString) {
        try {
          const cachedData = JSON.parse(cachedString);
          if (cachedData.fetchDate === today && cachedData.data) {
            this.dashboardState.set(cachedData.data); // Hydrate state
            return { data: cachedData.data, error: null };
          }
        } catch (e) {
          console.warn("Cache corrupted, fetching fresh...");
        }
      }
    }

    // ✅ 4. FRESH API FETCH (Runs on New Day or Forced Refresh)
    const { data, error } = await this.supabaseService.client
      .from('dashboard_snapshots')
      .select('*')
      .eq('id', 1)
      .single();
      
    if (data && !error) {
      this.dashboardState.set(data); // Save to Memory
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({ fetchDate: today, data: data })); // Save to Disk
      localStorage.setItem(this.SYNC_TIME_KEY, now.toString()); // Start the 1-hour cooldown timer
    }

    return { data, error };
  }
}
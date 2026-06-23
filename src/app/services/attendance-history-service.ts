import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ToastService } from './toast-service';
import { FormatedDateUtils } from '../shared/formated-date.utils';

@Injectable({
  providedIn: 'root',
})
export class AttendanceHistoryService {
  private supabaseService = inject(SupabaseService);
  private toastService = inject(ToastService);

  activeTab = signal<'daily' | 'member'>('daily');

  // --- Daily Roster State ---
  dailyDate = signal<string>(this.getTodayDateString());
  dailySearch = signal<string>('');
  dailyPage = signal<number>(1);
  dailyPageSize = signal<number>(10);
  dailyData = signal<any[]>([]);
  dailyTotal = signal<number>(0);
  dailyHasLoaded = signal<boolean>(false);
  isDailyLoading = signal<boolean>(false);

  // --- Member History State ---
  selectedMemberId = signal<string | null>(null);
  selectedMemberName = signal<string>('');
  
  // FIX: Default start date is now TODAY
  memberStartDate = signal<string>(this.getTodayDateString());
  memberEndDate = signal<string>(this.getTodayDateString());
  
  memberPage = signal<number>(1);
  memberPageSize = signal<number>(10);
  memberData = signal<any[]>([]);
  memberTotal = signal<number>(0);
  memberHasLoaded = signal<boolean>(false);
  isMemberLoading = signal<boolean>(false);

  getTodayDateString(): string {
    return FormatedDateUtils.getLocalCalendarString();
  }

  getMonthsAgoDateString(months: number): string {
    const d = new Date();
    d.setDate(1); // Set day to 1st to prevent index overflow on month-end days (e.g. 31st)
    d.setMonth(d.getMonth() - months);
    return FormatedDateUtils.getLocalCalendarString(d);
  }

  async fetchDailyAttendance() {
    this.isDailyLoading.set(true);
    try {
      const { data, error } = await this.supabaseService.client.rpc('get_daily_attendance', {
        p_target_date: this.dailyDate(),
        p_search_keyword: this.dailySearch(),
        p_page_number: this.dailyPage(),
        p_items_per_page: this.dailyPageSize()
      });

      if (error) throw error;
      this.dailyData.set(data?.data || []);
      this.dailyTotal.set(data?.total_count || 0);
      this.dailyHasLoaded.set(true);
    } catch (error: any) {
      console.error('Error fetching daily attendance:', error);
      this.toastService.danger('Failed to load daily attendance.');
    } finally {
      this.isDailyLoading.set(false);
    }
  }

  async fetchMemberHistory() {
    if (!this.selectedMemberId()) return;
    this.isMemberLoading.set(true);
    try {
      const { data, error } = await this.supabaseService.client.rpc('get_member_history', {
        p_profile_id: this.selectedMemberId(),
        p_start_date: this.memberStartDate(),
        p_end_date: this.memberEndDate(),
        p_page_number: this.memberPage(),
        p_items_per_page: this.memberPageSize()
      });

      if (error) throw error;
      this.memberData.set(data?.data || []);
      this.memberTotal.set(data?.total_count || 0);
      this.memberHasLoaded.set(true);
    } catch (error: any) {
      console.error('Error fetching member history:', error);
      this.toastService.danger('Failed to load member history.');
    } finally {
      this.isMemberLoading.set(false);
    }
  }

  async searchProfiles(query: string) {
    if (!query || query.length < 1) return [];
    
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, full_name')
      .eq('user_role', 'member')
      .ilike('full_name', `${query}%`) 
      .limit(5);
    
    if (error) {
      console.error('Error fetching profiles:', error); // Optional: good for debugging
      return [];
    }
    
    return data;
  }
}
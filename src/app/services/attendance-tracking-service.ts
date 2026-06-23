import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CreateAttendanceDto, AttendanceRecord } from '../models/attendance.dto';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AttendanceTrackingService {

  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  async loginTime(insertData: CreateAttendanceDto): Promise<string> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('attendance')
        .insert([insertData])
        .select('id') 
        .single();

      if (error) {
        if (
          error.message.includes('SESSION_REVOKED') || 
          error.code === 'PGRST301' || 
          error.message.toLowerCase().includes('jwt')
        ) {
          console.warn('Action blocked: Session was revoked by another device.');
          this.supabaseService.currentUser.set(null); 
          localStorage.removeItem("user");            
          this.router.navigate(['/auth/login']);
          throw new Error('session expired'); 
        }

        console.error('Supabase Error during login insertion:', error.message);
        throw new Error(`Login insertion failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('Login insertion succeeded but returned no data.');
      }

      localStorage.setItem("currentAttendanceId", data.id);
      return data.id; 

    } catch (err) {
      console.error('Unexpected error in loginTime:', err);
      throw err;
    }
  }

  async logoutTime(updateData: Partial<CreateAttendanceDto>, attendanceId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('attendance')
        .update(updateData)
        .eq('id', attendanceId); 

      if (error) {
        if (
          error.message.includes('SESSION_REVOKED') || 
          error.code === 'PGRST301' || 
          error.message.toLowerCase().includes('jwt')
        ) {
          console.warn('Action blocked: Session was revoked by another device.');
          this.supabaseService.currentUser.set(null); 
          localStorage.removeItem("user");            
          this.router.navigate(['/auth/login']);
          throw new Error('session expired');
        }

        console.error('Supabase Error during logout update:', error.message);
        throw new Error(`Logout update failed: ${error.message}`);
      }

      localStorage.removeItem("currentAttendanceId");

    } catch (err) {
      console.error('Unexpected error in logoutTime:', err);
      throw err;
    }
  }

  async getActiveSession(profileId: string): Promise<string | null> {
    // 🔴 THE FIX: Calculate exactly 10 hours ago in UTC
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabaseService.client
      .from('attendance')
      .select('id') 
      .eq('profile_id', profileId)
      .is('check_out_time', null)
      .gte('check_in_time', tenHoursAgo) // 🔴 ONLY fetch sessions less than 10 hours old
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle(); 

    if (error) {
      console.error('Error fetching active session:', error.message);
      return null;
    }

    return data?.id || null;
  }

  async fetchCoinBalance(profileId: string): Promise<number> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('members')
        .select('coin_balance') 
        .eq('profile_id', profileId)
        .single();

      if (error) throw error;
      return data?.coin_balance || 0;
    } catch (err) {
      console.error('Failed to load coin balance', err);
      return 0; 
    }
  }

  async getAttendanceHistory(profileId: string, startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('attendance')
        .select('id, attendance_date, check_in_time, check_out_time')
        .eq('profile_id', profileId)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate) 
        .order('check_in_time', { ascending: false });

      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    } catch (err) {
      console.error('Error fetching attendance history:', err);
      return [];
    }
  }
}
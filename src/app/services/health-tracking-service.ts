import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase-service'; 
import { MeasurementLog, MemberData } from '../models/health-tracker.model';

@Injectable({
  providedIn: 'root',
})
export class HealthTrackingService {
  private supabaseService = inject(SupabaseService);

  async getMemberStats(profileId: string): Promise<MemberData | null> {
    const { data, error } = await this.supabaseService.client
      .from('members')
      .select('id, height_cm, weight_kg, blood_group, fitness_goal, medical_conditions, injuries_history, chest_cm, waist_cm')
      .eq('profile_id', profileId)
      .single();

    if (error) {
      console.error('Error fetching member stats:', error);
      return null;
    }
    return data;
  }

  async getMeasurementHistory(profileId: string): Promise<MeasurementLog[]> {
    const { data, error } = await this.supabaseService.client
      .from('member_measurements')
      .select('id, weight_kg, height_cm, chest_cm, waist_cm, recorded_at')
      .eq('profile_id', profileId)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }
    return data || [];
  }

  // ✅ FIXED: Returns the fully constructed record (with true ID) instead of just a boolean
  async addMeasurement(profileId: string, weight?: number, height?: number, chest?: number, waist?: number): Promise<{ success: boolean; data?: MeasurementLog; message?: string }> {
    const payload: any = { profile_id: profileId };
    if (weight) payload.weight_kg = weight;
    if (height) payload.height_cm = height;
    if (chest) payload.chest_cm = chest;
    if (waist) payload.waist_cm = waist;

    // By adding .select().single(), Supabase returns the EXACT row it just inserted into the DB
    const { data, error } = await this.supabaseService.client
      .from('member_measurements')
      .insert([payload])
      .select('id, weight_kg, height_cm, chest_cm, waist_cm, recorded_at')
      .single();

    if (error) {
      if (error.message.includes('once every 10 days')) {
        return { success: false, message: 'Updates are limited to once every 10 days.' };
      }
      return { success: false, message: error.message };
    }

    return { success: true, data: data as MeasurementLog };
  }
}
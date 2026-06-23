import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { TrainerPermissions } from '../models/trainer.model';

@Injectable({
  providedIn: 'root',
})
export class TrainerService {
  private supabaseService = inject(SupabaseService);

  // Single Source of truth for Tab Switching Cache (In-Memory Signal)
  listState = signal<{
    data: { id: string; full_name: string }[];
    total: number;
    page: number;
    search: string;
  } | null>(null);

  /**
   * Main Optimized Fetch function.
   * Only requests 'id' and 'full_name', enforces 'trainer' role, and handles pagination/search.
   */
  async getPaginatedTrainers(page: number, limit: number, search: string) {
    try {
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      // 1. Setup exact count query and only select required fields
      let query = this.supabaseService.client
        .from('profiles')
        .select('id, full_name', { count: 'exact' })
        .eq('user_role', 'trainer')
        .order('created_at', { ascending: false })
        .range(start, end);

      // 2. Append search if exists (starts with matching)
      if (search) {
        query = query.ilike('full_name', `${search}%`);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('Supabase Error:', error.message);
        throw new Error(`Failed: ${error.message}`);
      }

      return { 
        data: data || [], 
        total: count || 0 
      };
    } catch (err) {
      console.error('Unexpected error fetching trainers:', err);
      throw err;
    }
  }

  async deleteTrainer(trainerId: string) {
    try {
      // NOTE: Because of your ON DELETE SET NULL constraint in the DB, 
      // deleting this profile automatically unassigns them from all members.
      const { data, error } = await this.supabaseService.client
        .from('profiles')
        .delete()
        .eq('id', trainerId)
        .select()
        .single();

      if (error) throw error;
      
      // Data Mutated -> Wipe Cache so the component forces a reload on visit
      this.listState.set(null);
      return data;
    } catch (err) {
      throw err;
    }
  }

  // YOUR EXISTING FUNCTION UNTOUCHED
  async searchTrainers(query: string) {
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, full_name')
      .eq('user_role', 'trainer')
      .ilike('full_name', `${query}%`) // Matches from the start of the string
      .limit(5); // Maximum 5 results for speed

    if (error) {
      console.error('Error fetching trainers:', error);
      throw error;
    }

    return data || [];
  }



  private accessCache = new Map<string, { name: string; permissions: TrainerPermissions }>();

  async getTrainerAccessData(trainerId: string) {
    // Return instantly from memory if we already fetched it
    if (this.accessCache.has(trainerId)) {
      return this.accessCache.get(trainerId)!;
    }

    try {
      const { data: profile } = await this.supabaseService.client
        .from('profiles')
        .select('full_name')
        .eq('id', trainerId)
        .maybeSingle(); // Prevents errors if missing

      const name = profile?.full_name || 'Unnamed Trainer';

      // maybeSingle prevents the PGRST116 0-rows error in your screenshot
      const { data: perms, error } = await this.supabaseService.client
        .from('trainer_permissions')
        .select('*')
        .eq('trainer_id', trainerId)
        .maybeSingle();

      if (error) throw error;

      // Default safe permissions if the trainer has no row in the DB yet
      const defaultPerms: TrainerPermissions = {
        can_view_qr_desk: false, can_manage_users: false, can_manage_diet: false,
        can_manage_workout: false, can_manage_gym_plans: false, can_manage_subscriptions: false,
        can_view_attendance: false, can_manage_exercises: false, can_manage_settings: false,
        can_manage_announcements: false
      };

      const finalPerms = perms || defaultPerms;
      const result = { name, permissions: finalPerms };

      // Save to Cache
      this.accessCache.set(trainerId, result);

      return result;
    } catch (err) {
      console.error('Error fetching access data:', err);
      throw err;
    }
  }

  async updateTrainerPermissions(trainerId: string, permissions: TrainerPermissions) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('trainer_permissions')
        .upsert({ 
          trainer_id: trainerId, 
          ...permissions,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update Memory Cache so UI reflects changes instantly
      const cached = this.accessCache.get(trainerId);
      if (cached) {
        this.accessCache.set(trainerId, { ...cached, permissions });
      }

      return data;
    } catch (err) {
      console.error('Error saving permissions:', err);
      throw err;
    }
  }
}
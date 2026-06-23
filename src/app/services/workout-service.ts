import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { StorageService } from './storage-service'; // <-- NEW: Inject StorageService
import { WorkoutMetaDataDto, WorkoutPlanDetails, WorkoutPlanInsert } from '../models/workout.model';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private supabaseService = inject(SupabaseService);
  private storageService = inject(StorageService); // <-- NEW

  isCreating = signal<boolean>(false);

  // --- State Signals ---
  workouts = signal<WorkoutMetaDataDto[]>([]);
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchTerm = signal<string>('');
  searchInput = signal<string>('');
  hasLoaded = signal<boolean>(false);

  // --- Multi-Plan Edit Cache ---
  cachedEditPlans = signal<Map<string, WorkoutPlanDetails>>(new Map());

  async createWorkoutPlan(payload: WorkoutPlanInsert): Promise<{ data: WorkoutPlanInsert | null, error: any }> {
    this.isCreating.set(true);
    try {
      const { data, error } = await this.supabaseService.client
        .from('workout_plans')
        .insert(payload);

      if (error) throw error;
      
      this.hasLoaded.set(false); 
      return { data, error: null };
    } catch (error) {
      console.error('Error creating workout plan:', error);
      return { data: null, error };
    } finally {
      this.isCreating.set(false);
    }
  }

  async updateWorkoutPlan(id: string, payload: Partial<WorkoutPlanInsert>): Promise<{ error: any }> {
    this.isCreating.set(true);
    try {
      const { error } = await this.supabaseService.client
        .from('workout_plans')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      this.hasLoaded.set(false); // Invalidate list cache
      
      // 1. Clear Edit Page Cache
      this.cachedEditPlans.update(map => {
        const newMap = new Map(map);
        newMap.delete(id);
        return newMap;
      });

      // 2. Clear View Page Cache (StorageService / IndexedDB)
      // This forces the view page to fetch fresh data on the next load
      try {
        await this.storageService.removeItem(`workout_cache_${id}`);
      } catch (e) {
        console.warn('Could not clear view cache for workout:', id);
      }
      
      return { error: null };
    } catch (error) {
      console.error('Error updating workout plan:', error);
      return { error };
    } finally {
      this.isCreating.set(false);
    }
  }

  async getPaginatedWorkouts(page: number, pageSize: number, searchQuery: string = ''): Promise<{ data: WorkoutMetaDataDto[] | null, count: number, error: any }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabaseService.client
      .from('workout_plans')
      .select('id, heading, difficulty_level, target_audience, goal_type', { count: 'exact' });

    if (searchQuery.trim() !== '') {
      query = query.ilike('heading', `${searchQuery.trim()}%`);
    }

    const { data, count, error } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    return { data: data as WorkoutMetaDataDto[], count: count || 0, error };
  }

  async getWorkoutPlanById(id: string): Promise<{ data: WorkoutPlanDetails | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('workout_plans')
        .select('heading, goal_type, difficulty_level, target_audience, description, schedule_data')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data && typeof data.schedule_data === 'string') {
        try {
          data.schedule_data = JSON.parse(data.schedule_data);
        } catch (e) {
          console.error('Failed to parse schedule_data JSON:', e);
          data.schedule_data = [];
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching workout plan details:', error);
      return { data: null, error };
    }
  }

  async deleteWorkoutPlan(id: string): Promise<{ error: any }> {
    const { error } = await this.supabaseService.client
      .from('workout_plans')
      .delete()
      .eq('id', id);

    this.hasLoaded.set(false);
    
    // Clear caches on delete as well to prevent ghost data
    this.cachedEditPlans.update(map => {
      const newMap = new Map(map);
      newMap.delete(id);
      return newMap;
    });
    try { await this.storageService.removeItem(`workout_cache_${id}`); } catch (e) {}

    return { error };
  }

  async searchWorkouts(query: string): Promise<{ id: string; heading: string }[]> {
    if (!query) return [];
    const { data, error } = await this.supabaseService.client
      .from('workout_plans')
      .select('id, heading')
      .ilike('heading', `%${query}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  }
}
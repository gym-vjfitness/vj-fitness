import { Injectable, inject, signal } from '@angular/core';
import { Exercise, CreateExerciseDto, ExerciseSearchResult } from '../models/exercise.model'; 
import { SupabaseService } from './supabase-service'; 
import { StorageService } from './storage-service'; 

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private supabase = inject(SupabaseService).client;
  private storageService = inject(StorageService);

  // --- State Signals (Preserves state across tab switches) ---
  exercises = signal<Partial<Exercise>[]>([]);
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchTerm = signal<string>('');
  searchInput = signal<string>('');
  selectedMuscleGroup = signal<string>(''); // For the filter
  hasLoaded = signal<boolean>(false);

  // --- Optimized Autocomplete Search (Untouched logic) ---
  async searchExercisesForAutocomplete(searchQuery: string, limit: number = 15) {
    let query = this.supabase
      .from('exercises')
      .select('id, name, target_muscle_group')
      .limit(limit);

    if (searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return data as ExerciseSearchResult[];
  }

  // 1. Get All with Pagination, Search, Filter & STRICT SELECTION
  async getExercises(page: number = 1, pageSize: number = 10, searchQuery: string = '', muscleGroup: string = '') {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = this.supabase
      .from('exercises')
      .select('id, name', { count: 'exact' }); // Strictly selects only id and name

    if (searchQuery.trim()) {
      query = query.ilike('name', `${searchQuery}%`);
    }

    if (muscleGroup.trim() && muscleGroup !== 'All Muscles') {
      query = query.eq('target_muscle_group', muscleGroup);
    }

    // Fetches newest data first
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) throw error;
    return { data: data as Partial<Exercise>[], count: count || 0 };
  }

  // 2. Get Single Exercise
  async getExerciseById(id: string) {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Exercise;
  }

  // 3. Create
  async createExercise(exercise: CreateExerciseDto) {
    const { data, error } = await this.supabase
      .from('exercises')
      .insert([exercise])
      .select()
      .single();

    if (error) throw error;

    // Force table to fetch latest data on next visit
    this.hasLoaded.set(false); 
    return data as Exercise;
  }

  // 4. Update
  async updateExercise(id: string, exercise: Partial<CreateExerciseDto>) {
    const { data, error } = await this.supabase
      .from('exercises')
      .update({ 
        ...exercise, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Force table to fetch latest data & wipe old local storage cache
    this.hasLoaded.set(false);
    try { await this.storageService.removeItem(`exercise_details_${id}`); } catch (e) {}

    return data as Exercise;
  }

  // 5. Delete Single
  async deleteExercise(id: string) {
    const { error } = await this.supabase
      .from('exercises')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Force table to fetch latest data & wipe local storage cache
    this.hasLoaded.set(false);
    try { await this.storageService.removeItem(`exercise_details_${id}`); } catch (e) {}
  }

  // 6. Delete Bulk
  async deleteBulkExercises(ids: string[]) {
    const { error } = await this.supabase
      .from('exercises')
      .delete()
      .in('id', ids);

    if (error) throw error;
    this.hasLoaded.set(false);
  }

  async getExercisesByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    
    const { data, error } = await this.supabase
      .from('exercises')
      .select('id, name, description, video_url, target_muscle_group, equipment_required')
      .in('id', ids);

    if (error) throw error;
    return data as Exercise[];
  }
}
import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CreateDietPlanDto, DietPlan } from '../models/diet-plan.dto';

@Injectable({
  providedIn: 'root',
})
export class DietService {
  private supabaseService = inject(SupabaseService);
  public adminDietCache = new Map<string, { data: DietPlan, timestamp: number }>();

  // Single Source of truth for Tab Switching Cache (In-Memory Signal instead of LocalStorage)
  listState = signal<{
    data: { id: string; title: string }[];
    total: number;
    page: number;
    search: string;
  } | null>(null);

  /**
   * Main Optimized Fetch function.
   * Only requests 'id' and 'title', uses strict pagination, handles search, and orders by newest.
   */
  async getPaginatedPlans(page: number, limit: number, search: string) {
    try {
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      // 1. Setup exact count query and only select required fields
      let query = this.supabaseService.client
        .from('diet_plans')
        .select('id, title', { count: 'exact' })
        .order('created_at', { ascending: false }) // Ensures newest at the top
        .range(start, end);

      // 2. Append search if exists
      if (search) {
        query = query.ilike('title', `${search}%`);
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
      console.error('Unexpected error fetching diets:', err);
      throw err;
    }
  }

  async createDietPlan(insertData: CreateDietPlanDto) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('diet_plans')
        .insert([insertData])
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

  async updateDietPlan(dietId: string, updateData: CreateDietPlanDto) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('diet_plans')
        .update(updateData)
        .eq('id', dietId)
        .select()
        .single();

      if (error) throw error;
      
      // Data Mutated -> Wipe Cache
      this.listState.set(null);
      return data;
    } catch (err) {
      throw err;
    }
  }

  async deleteDietPlan(dietId: string) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('diet_plans')
        .delete()
        .eq('id', dietId)
        .select()
        .single();

      if (error) throw error;
      
      // Data Mutated -> Wipe Cache
      this.listState.set(null);
      return data;
    } catch (err) {
      throw err;
    }
  }

  async getDietPlanDetailsById(planId: string) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('diet_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  }


  async searchDiets(query: string): Promise<{ id: string; title: string }[]> {
    if (!query) return [];
    
    const { data, error } = await this.supabaseService.client
      .from('diet_plans')
      .select('id, title')
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false }) // Keeping it ordered by newest
      .limit(10); // Limit results for the dropdown

    if (error) {
      console.error('Supabase Error during Diet searching:', error.message);
      throw error;
    }
    
    return data || [];
  }
}
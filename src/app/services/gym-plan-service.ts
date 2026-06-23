import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { StorageService } from './storage-service';
import { GymPlanDTO, PlanFeatureDTO, PlanPriceDTO } from '../models/gym-plan.model';

@Injectable({
  providedIn: 'root',
})
export class GymPlanService {
  private supabaseService = inject(SupabaseService);
  private storageService = inject(StorageService);

  // --- State Signals (Preserves search & pagination across tabs) ---
  plans = signal<GymPlanDTO[]>([]);
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchTerm = signal<string>('');
  searchInput = signal<string>('');
  
  // This tells the management page if it needs to fetch data or use cache
  hasLoaded = signal<boolean>(false);

  // Get the raw client for queries
  private get supabase() {
    return this.supabaseService.client;
  }

  async createPlanWithPrices(planData: GymPlanDTO, pricesData: PlanPriceDTO[]) {
    const { data: plan, error: planError } = await this.supabase
      .from('plans')
      .insert([{ name: planData.name, description: planData.description }])
      .select()
      .single();

    if (planError) throw planError;

    const pricesToInsert = pricesData.map(price => ({ ...price, plan_id: plan.id }));
    const { error: priceError } = await this.supabase.from('plan_prices').insert(pricesToInsert);
    if (priceError) throw priceError;

    // INVALIDATE PAGINATION CACHE
    this.hasLoaded.set(false);

    return plan;
  }

  async getAdminPlans() {
    const { data, error } = await this.supabase
      .from('plans')
      .select(`*, plan_prices (*)`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createPlanFull(planData: GymPlanDTO, pricesData: PlanPriceDTO[], featuresData: PlanFeatureDTO[]) {
    const { data: plan, error: planError } = await this.supabase
      .from('plans')
      .insert([{ name: planData.name, description: planData.description }])
      .select().single();
    if (planError) throw planError;

    const pricesToInsert = pricesData.map(price => ({ ...price, plan_id: plan.id }));
    const { error: priceError } = await this.supabase.from('plan_prices').insert(pricesToInsert);
    if (priceError) throw priceError;

    if (featuresData && featuresData.length > 0) {
      const featuresToInsert = featuresData.map(feature => ({ ...feature, plan_id: plan.id }));
      const { error: featureError } = await this.supabase.from('plan_features').insert(featuresToInsert);
      if (featureError) throw featureError;
    }

    // CRITICAL FIX: Tell the management page that its data is now old!
    this.hasLoaded.set(false);

    return plan;
  }

  async getPaginatedPlans(searchTerm: string, page: number, pageSize: number = 10) {
    let query = this.supabase
      .from('plans')
      .select('id, name, description, is_active', { count: 'exact' });

    if (searchTerm && searchTerm.trim() !== '') {
      query = query.ilike('name', `%${searchTerm.trim()}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .range(from, to)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: data as GymPlanDTO[], total: count || 0 };
  }

  async getPlanById(id: string) {
    const { data, error } = await this.supabase
      .from('plans')
      .select(`*, plan_prices (*), plan_features (*)`)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as GymPlanDTO;
  }

  async updatePlanFull(planId: string, planData: GymPlanDTO, pricesData: PlanPriceDTO[], featuresData: PlanFeatureDTO[]) {
    const { error: planError } = await this.supabase
      .from('plans')
      .update({ name: planData.name, description: planData.description })
      .eq('id', planId);
    if (planError) throw planError;

    await this.supabase.from('plan_prices').delete().eq('plan_id', planId);
    const pricesToInsert = pricesData.map(price => ({ ...price, plan_id: planId }));
    const { error: priceError } = await this.supabase.from('plan_prices').insert(pricesToInsert);
    if (priceError) throw priceError;

    await this.supabase.from('plan_features').delete().eq('plan_id', planId);
    if (featuresData && featuresData.length > 0) {
      const featuresToInsert = featuresData.map(feature => ({ ...feature, plan_id: planId }));
      const { error: featureError } = await this.supabase.from('plan_features').insert(featuresToInsert);
      if (featureError) throw featureError;
    }

    // INVALIDATE LOCAL DETAILS CACHE
    try { await this.storageService.removeItem(`plan_details_${planId}`); } catch (e) {}
    
    // CRITICAL FIX: INVALIDATE PAGINATION CACHE
    this.hasLoaded.set(false);

    return true;
  }

  async togglePlanStatus(planId: string, isActive: boolean): Promise<boolean> {
    const { error } = await this.supabase
      .from('plans')
      .update({ is_active: isActive })
      .eq('id', planId);

    if (error) throw error;

    // INVALIDATE CACHES
    try { await this.storageService.removeItem(`plan_details_${planId}`); } catch (e) {}
    
    // CRITICAL FIX: Tell the pagination list to refresh its data
    this.hasLoaded.set(false);

    return true;
  }

  async deletePlan(planId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;

    // INVALIDATE CACHES
    try { await this.storageService.removeItem(`plan_details_${planId}`); } catch (e) {}
    
    // CRITICAL FIX: Tell the pagination list to refresh its data
    this.hasLoaded.set(false);

    return true;
  }
}
import { Injectable, inject, signal } from '@angular/core';
import { CouponDTO, CouponPreviewResponse } from '../models/coupon.model';
import { SupabaseService } from './supabase-service';



@Injectable({
  providedIn: 'root',
})
export class CouponService {
  private supabaseService = inject(SupabaseService);

  // --- STRICT CACHING ENGINE ---
  // Caches the lightweight list (id, code, is_active)
  private listCache = signal<Partial<CouponDTO>[] | null>(null);
  // Caches full details of individual coupons to prevent redundant API calls on Edit
  private detailsCache = new Map<string, CouponDTO>();

  // 1. Fetch List (STRICT: Only fetches id, code, is_active)
  async getCoupons(forceRefresh = false): Promise<Partial<CouponDTO>[]> {
    if (!forceRefresh && this.listCache() !== null) {
      return this.listCache()!; // Zero API call
    }

    const { data, error } = await this.supabaseService.client
      .from('coupons')
      .select('id, code, is_active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    this.listCache.set(data);
    return data;
  }

  // 2. Fetch Single (Checks Cache FIRST!)
  async getCouponById(id: string, forceRefresh = false): Promise<CouponDTO> {
    if (!forceRefresh && this.detailsCache.has(id)) {
      return this.detailsCache.get(id)!; // Zero API call
    }

    const { data, error } = await this.supabaseService.client
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    this.detailsCache.set(id, data);
    return data;
  }

  // 3. Create
  async createCoupon(payload: CouponDTO) {
    const { data, error } = await this.supabaseService.client
      .from('coupons')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    this.clearAllCaches();
    return data;
  }

  // 4. Update
  async updateCoupon(id: string, payload: Partial<CouponDTO>) {
    const { data, error } = await this.supabaseService.client
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    this.clearAllCaches();
    return data;
  }

  // 5. Toggle Status
  async toggleCouponStatus(id: string, isActive: boolean) {
    const { error } = await this.supabaseService.client
      .from('coupons')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
    this.clearAllCaches();
  }

  // 6. Delete
  async deleteCoupon(id: string) {
    const { error } = await this.supabaseService.client
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;
    this.clearAllCaches();
  }

  private clearAllCaches() {
    this.listCache.set(null);
    this.detailsCache.clear();
  }

  async previewCoupon(code: string, basePrice: number): Promise<CouponPreviewResponse> {
    const { data, error } = await this.supabaseService.client
      .rpc('preview_coupon_details', { p_code: code, p_base_price: basePrice });
    if (error) throw error;
    return data as CouponPreviewResponse;
  }
}
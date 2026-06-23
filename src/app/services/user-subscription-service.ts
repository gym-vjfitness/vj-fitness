import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { SubscriptionMetaInfo, UserSubscription, SubscriptionPayment } from '../models/user-subscription.model';
import { seletedSubscriptionPlan } from '../models/subscription-view.model';
import { UserProfile } from '../models/user.model';
import { FormatedDateUtils } from '../shared/formated-date.utils';

@Injectable({
  providedIn: 'root',
})
export class UserSubscriptionService {
  private supabaseService = inject(SupabaseService);

  private subscriptionDetailsCache = new Map<string, { subscription: any, payments: SubscriptionPayment[] }>();
  private userSubscriptionsCache = new Map<string, any[]>();
  private paymentsCache = new Map<string, SubscriptionPayment[]>();
  private metaCache: { key: string, result: { data: any[], count: number } } | null = null;

  public savedFilterState: any = null;

  private getLocalYYYYMMDD(dateValue: any): string {
    return FormatedDateUtils.getLocalCalendarString(dateValue);
  }

  private getISTTimestamp(dateValue: any, isEndOfDay: boolean = false): string | null {
    return FormatedDateUtils.getISTTimestampBoundary(dateValue, isEndOfDay);
  }

  async getFullSubscriptionData(id: string, forceRefresh = false) {
    if (!forceRefresh && this.subscriptionDetailsCache.has(id)) {
      return this.subscriptionDetailsCache.get(id)!;
    }
    const sub = await this.getSubscriptionDetail(id);
    const payments = await this.getSubscriptionPayments(id);
    const data = { subscription: sub, payments };
    this.subscriptionDetailsCache.set(id, data);
    return data;
  }

  clearCache(subscriptionId?: string, profileId?: string) {
    if (subscriptionId) {
      this.subscriptionDetailsCache.delete(subscriptionId);
      this.paymentsCache.delete(subscriptionId);
    } else {
      this.subscriptionDetailsCache.clear();
      this.paymentsCache.clear();
    }
    if (profileId) {
      this.userSubscriptionsCache.delete(profileId);
    } else {
      this.userSubscriptionsCache.clear();
    }
    this.metaCache = null;
    this.pendingState = {
      page: 1,
      searchTerm: '',
      data: [] as any[],
      count: 0,
      lastFetched: 0
    };
  }

  async getSubscriptionsMeta(page: number, pageSize: number = 10, searchTerm: string = '', status: string = '', startDate: string = '', endDate: string = '', expiresIn7Days: boolean = false) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const cacheKey = JSON.stringify({ page, pageSize, searchTerm, status, startDate, endDate, expiresIn7Days });
    if (this.metaCache?.key === cacheKey) return this.metaCache.result;

    // 1. ADDED 'is_active' to the inner join so we can filter by the user's current global status
    let query = this.supabaseService.client
      .from('user_subscriptions')
      .select(`id, purchased_price, profiles!inner(full_name, is_active)`, { count: 'exact' });

    if (searchTerm) {
      query = query.ilike('profiles.full_name', `${searchTerm}%`);
    }
    
    if (status) {
      query = query.eq('status', status);

      // 2. THE FIX: If the admin is filtering by an inactive status, strictly exclude 
      // users who currently have an active subscription profile.
      if (['EXPIRED', 'CANCELLED', 'REJECTED', 'PAUSED'].includes(status)) {
        query = query.eq('profiles.is_active', false);
      }
    }

    if (expiresIn7Days) {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const nowIso = this.getISTTimestamp(now, false);
      const nextWeekIso = this.getISTTimestamp(nextWeek, true);

      query = query.gte('end_date', nowIso).lte('end_date', nextWeekIso);
    } else if (startDate && endDate) {
      query = query.gte('requested_at', startDate).lte('requested_at', endDate);
    }

    const { data, count, error } = await query.order('requested_at', { ascending: false }).range(from, to);
    if (error) throw error;

    const result = { data: data as any[], count: count || 0 };
    this.metaCache = { key: cacheKey, result };
    return result;
  }

  async checkoutSubscription(profileId: string, planId: string, priceId: string, firstUtr: string, paymentMode: 'FULL' | 'SPLIT', coinsUsed: number, features: string[], couponCode: string | null = null, couponDiscount: number = 0) {
    const { data, error } = await this.supabaseService.client.rpc('process_checkout', {
      p_profile_id: profileId, p_plan_id: planId, p_price_id: priceId, p_utr_number: firstUtr,
      p_payment_mode: paymentMode, p_coins_used: coinsUsed, p_features: features, p_coupon_code: couponCode, p_coupon_discount: couponDiscount
    });
    if (error) throw error;
    this.clearCache(undefined, profileId);
    return data;
  }

  async getSubscriptionPayments(subscriptionId: string, forceRefresh = false) {
    if (!forceRefresh && this.paymentsCache.has(subscriptionId)) {
      return this.paymentsCache.get(subscriptionId)!;
    }
    const { data, error } = await this.supabaseService.client.from('subscription_payments').select('*').eq('subscription_id', subscriptionId).order('installment_number', { ascending: true });
    if (error) throw error;
    this.paymentsCache.set(subscriptionId, data as SubscriptionPayment[]);
    return data as SubscriptionPayment[];
  }

  async verifyPayment(paymentId: string, subscriptionId: string, isFirstInstallment: boolean, durationDays: number, manualStartDateStr?: string) {
    const now = new Date().toISOString();
    const { error: payError } = await this.supabaseService.client
      .from('subscription_payments')
      .update({ status: 'PAID', verified_at: now })
      .eq('id', paymentId)
      .eq('subscription_id', subscriptionId);

    if (payError) throw payError;

    if (isFirstInstallment) {
      const startDate = manualStartDateStr ? new Date(manualStartDateStr) : new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + durationDays);

      // Extract profile_id here so we can update the profile status globally
      const { data: subData, error: subError } = await this.supabaseService.client.from('user_subscriptions').update({
        status: 'ACTIVE',
        start_date: this.getISTTimestamp(startDate, false),
        end_date: this.getISTTimestamp(endDate, true)
      }).eq('id', subscriptionId).select('profile_id').single();

      if (subError) throw subError;

      // Sync profile is_active status to true
      if (subData?.profile_id) {
        await this.supabaseService.client.from('profiles').update({ is_active: true }).eq('id', subData.profile_id);
      }
    }
    this.clearCache(subscriptionId);
  }

  async rejectPayment(paymentId: string, installmentNumber: number, subscriptionId: string) {
    const { error: payError } = await this.supabaseService.client
      .from('subscription_payments')
      .update({ status: 'REJECTED' })
      .eq('id', paymentId)
      .eq('installment_number', installmentNumber)
      .eq('subscription_id', subscriptionId);

    if (payError) throw payError;

    if (installmentNumber === 1) {
      const { data: subData, error: subError } = await this.supabaseService.client
        .from('user_subscriptions')
        .update({ status: 'REJECTED' })
        .eq('id', subscriptionId)
        .select('profile_id')
        .single();

      if (subError) throw subError;

      // Sync profile is_active status to false
      if (subData?.profile_id) {
        await this.supabaseService.client.from('profiles').update({ is_active: false }).eq('id', subData.profile_id);
      }
    }

    this.clearCache(subscriptionId);
  }

  async deleteSubscription(subscriptionId: string) {
    const { error } = await this.supabaseService.client
      .from('user_subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (error) throw error;
    this.clearCache(subscriptionId);
  }

  async getUserSubscriptions(profileId: string, forceRefresh = false) {
    if (!forceRefresh && this.userSubscriptionsCache.has(profileId)) {
      return this.userSubscriptionsCache.get(profileId)!;
    }
    const { data, error } = await this.supabaseService.client.from('user_subscriptions').select(`id, purchased_plan_name, purchased_price, purchased_duration_days, status, start_date, end_date, transaction_id`).eq('profile_id', profileId).order('requested_at', { ascending: false }).limit(1);
    if (error) throw error;
    this.userSubscriptionsCache.set(profileId, data);
    return data;
  }

  async getSubscriptionDetail(id: string) {
    // Added profile_id to the select statement so it's readily available
    const { data, error } = await this.supabaseService.client.from('user_subscriptions').select(`id, profile_id, purchased_plan_name, purchased_price, purchased_duration_days, status, start_date, end_date, paused_at, pause_reason, transaction_id, coins_used, coupon_code, coupon_discount, profiles (full_name, email, phone)`).eq('id', id).single();
    if (error) throw error; return data;
  }

  async updateSubscription(id: string, updates: Partial<UserSubscription>) {
    // Return the updated row data to get access to the profile_id
    const { data, error } = await this.supabaseService.client
      .from('user_subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Automatically sync the profile's is_active status if the subscription status was modified
    if (updates.status) {
      const isActive = updates.status === 'ACTIVE';
      await this.supabaseService.client
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', data.profile_id);
    }

    this.clearCache(id);
    return data;
  }

  async submitInstallmentUtr(paymentId: string, utrNumber: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService.client.from('subscription_payments').update({ utr_number: utrNumber, status: 'PENDING_VERIFICATION', submitted_at: now }).eq('id', paymentId).select('subscription_id').single();
    if (error) throw error;
    this.clearCache(data.subscription_id);
    return data;
  }

  async reSubmitRejectedUtr(subscriptionId: string, newUtr: string, profileId: string) {
    const { error } = await this.supabaseService.client.rpc('resubmit_rejected_payment', {
      p_sub_id: subscriptionId,
      p_utr: newUtr
    });

    if (error) throw error;
    this.clearCache(subscriptionId, profileId);
  }

  async reSubmitRejectedSecondInstallment(paymentId: string, newUtr: string, subscriptionId: string, profileId: string) {
    const now = new Date().toISOString();
    const { error } = await this.supabaseService.client
      .from('subscription_payments')
      .update({
        utr_number: newUtr,
        status: 'PENDING_VERIFICATION',
        submitted_at: now
      })
      .eq('id', paymentId)
      .eq('installment_number', 2)
      .eq('subscription_id', subscriptionId);

    if (error) throw error;
    this.clearCache(subscriptionId, profileId);
  }

  private generateAdminUtr(method: 'CASH' | 'CARD' | 'UPI_DIRECT' | 'NET_BANKING'): string {
    const prefixMap = { 'CASH': 'CSHX', 'CARD': 'CRDX', 'UPI_DIRECT': 'UPIX', 'NET_BANKING': 'NETX' };
    const prefix = prefixMap[method] || 'ADM-';
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}${randomDigits}`;
  }

  async adminOfflineCheckout(profileId: string, plan: seletedSubscriptionPlan, paymentMethod: 'CASH' | 'CARD' | 'UPI_DIRECT' | 'NET_BANKING', paymentMode: 'FULL' | 'SPLIT', discountAmount: number = 0, adminNote: string | null = null) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.plan_price.duration_in_days);

    const utrGen = this.generateAdminUtr(paymentMethod);
    const originalPrice = plan.plan_price.price;
    const finalDiscountedPrice = Math.max(0, originalPrice - discountAmount);

    const newSubscription = {
      profile_id: profileId,
      original_plan_id: plan.id,
      original_price_id: plan.plan_price.id,
      purchased_plan_name: plan.name,
      purchased_price: originalPrice,
      purchased_duration_days: plan.plan_price.duration_in_days,
      purchased_features: [...plan.plan_features],
      status: 'ACTIVE',
      start_date: this.getISTTimestamp(now, false),
      end_date: this.getISTTimestamp(endDate, true),
      transaction_id: utrGen,
      coupon_discount: discountAmount,
      coupon_code: adminNote || (discountAmount > 0 ? 'ADMIN_MANUAL' : null)
    };

    const { data: subData, error: subError } = await this.supabaseService.client.from('user_subscriptions').insert(newSubscription).select('id, purchased_price, purchased_plan_name, start_date, end_date').single();
    if (subError) throw subError;

    // Sync profile to active since we just created an ACTIVE subscription manually
    await this.supabaseService.client.from('profiles').update({ is_active: true }).eq('id', profileId);

    const paymentsToInsert = [];
    if (paymentMode === 'FULL') {
      paymentsToInsert.push({ subscription_id: subData.id, amount: finalDiscountedPrice, installment_number: 1, due_date: this.getLocalYYYYMMDD(now), utr_number: utrGen, status: 'PAID', submitted_at: new Date().toISOString(), verified_at: new Date().toISOString() });
    } else {
      const baseInstallment2 = Math.floor(originalPrice / 2.0);
      const baseInstallment1 = originalPrice - baseInstallment2;

      paymentsToInsert.push({ subscription_id: subData.id, amount: Math.max(0, baseInstallment1 - discountAmount), installment_number: 1, due_date: this.getLocalYYYYMMDD(now), utr_number: utrGen, status: 'PAID', submitted_at: new Date().toISOString(), verified_at: new Date().toISOString() });

      const nextMonth = new Date(now);
      nextMonth.setDate(nextMonth.getDate() + 30);
      paymentsToInsert.push({ subscription_id: subData.id, amount: Math.max(0, baseInstallment2 - Math.max(0, discountAmount - baseInstallment1)), installment_number: 2, due_date: this.getLocalYYYYMMDD(nextMonth), utr_number: null, status: 'PENDING', submitted_at: null, verified_at: null });
    }

    const { data: payData, error: payError } = await this.supabaseService.client.from('subscription_payments').insert(paymentsToInsert).select().order('installment_number', { ascending: true });
    if (payError) throw payError;

    this.clearCache(undefined, profileId);
    return { subscription: subData, firstPayment: payData.find(p => p.installment_number === 1) };
  }

  async adminCollectSecondInstallment(paymentId: string, paymentMethod: 'CASH' | 'CARD' | 'UPI_DIRECT' | 'NET_BANKING') {
    const utrGen = this.generateAdminUtr(paymentMethod);
    const now = new Date().toISOString();

    const { data, error } = await this.supabaseService.client.from('subscription_payments').update({ status: 'PAID', utr_number: utrGen, submitted_at: now, verified_at: now }).eq('id', paymentId).select('subscription_id').single();
    if (error) throw error;

    this.clearCache(data.subscription_id);
    return data;
  }

  async updateProfile(id: string, updates: Partial<UserProfile>) {
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }



  // ==========================================
  // PAGINATED PENDING INSTALLMENTS
  // ==========================================
  
  public pendingState = {
    page: 1,
    searchTerm: '',
    data: [] as any[],
    count: 0,
    lastFetched: 0
  };

  async getPaginatedPendingInstallments(page: number, pageSize: number = 10, searchTerm: string = '', forceRefresh: boolean = false) {
    const isSameQuery = page === this.pendingState.page && searchTerm === this.pendingState.searchTerm;
    const isCacheValid = (Date.now() - this.pendingState.lastFetched) < 60000; // 1 min cache

    if (!forceRefresh && isSameQuery && isCacheValid && this.pendingState.data.length > 0) {
      return this.pendingState;
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Bandwidth Optimized: Dropped payment id, installment number, status, and profile id
    let query = this.supabaseService.client
      .from('subscription_payments')
      .select(`
        amount,
        due_date,
        user_subscriptions!inner (
          id,
          profiles!inner (
            full_name,
            phone
          )
        )
      `, { count: 'exact' })
      .eq('installment_number', 2)
      .eq('status', 'PENDING');

    if (searchTerm) {
      // Server-side strict starting matching
      query = query.ilike('user_subscriptions.profiles.full_name', `${searchTerm}%`);
    }

    const { data, count, error } = await query.order('due_date', { ascending: true }).range(from, to);
    
    if (error) throw error;

    const mappedData = data.map((d: any) => ({
      amount: d.amount,
      dueDate: d.due_date,
      subscriptionId: d.user_subscriptions.id,
      fullName: d.user_subscriptions.profiles.full_name,
      phone: d.user_subscriptions.profiles.phone
    }));

    this.pendingState = {
      page,
      searchTerm,
      data: mappedData,
      count: count || 0,
      lastFetched: Date.now()
    };

    return this.pendingState;
  }

}
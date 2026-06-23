import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import {
  TrainerAttendanceRow,
  TrainerAttendanceSnapshot,
  TrainerAttendanceStatus,
  TrainerMini,
  TrainerPaymentMode,
  TrainerPaymentRow,
  TrainerPaymentSnapshot,
} from '../models/trainer-ops.model';

interface AttendanceSubmitPayload {
  attendance_date: string;
  start_time: string;
  end_time: string;
}

interface PaymentCreatePayload {
  trainer_profile_id: string;
  salary_month: string;
  amount: number;
  payment_date: string;
  payment_mode: TrainerPaymentMode;
}

@Injectable({
  providedIn: 'root',
})
export class TrainerOpsService {
  private supabaseService = inject(SupabaseService);

  // --- TAB STATE ---
  adminActiveTab = signal<'attendance' | 'payments'>('attendance');
  trainerActiveTab = signal<'submit' | 'attendance' | 'payments'>('submit');

  // --- ADMIN STATE ---
  adminAttendance = signal<TrainerAttendanceRow[]>([]);
  adminAttendanceTotal = signal<number>(0);
  adminAttendancePage = signal<number>(1);
  adminAttendancePageSize = signal<number>(10);
  adminAttendanceStatus = signal<TrainerAttendanceStatus | 'all'>('pending');
  adminAttendanceTrainerId = signal<string | null>(null);
  adminAttendanceTrainerName = signal<string>('');
  adminAttendanceLoaded = signal<boolean>(false); // RESTORED
  adminAttendanceLoading = signal<boolean>(false);
  adminAttendanceSnapshot = signal<TrainerAttendanceSnapshot | null>(null);

  adminPayments = signal<TrainerPaymentRow[]>([]);
  adminPaymentsTotal = signal<number>(0);
  adminPaymentsPage = signal<number>(1);
  adminPaymentsPageSize = signal<number>(10);
  adminPaymentsTrainerId = signal<string | null>(null);
  adminPaymentsTrainerName = signal<string>('');
  adminPaymentsLoaded = signal<boolean>(false); // RESTORED
  adminPaymentsLoading = signal<boolean>(false);
  adminPaymentSnapshot = signal<TrainerPaymentSnapshot | null>(null);

  // --- PERSISTENT PAYMENT UI STATE ---
  selectedPaymentTrainer = signal<TrainerMini | null>(null);
  paymentAmount = signal<number | null>(null);
  paymentSalaryMonth = signal<string>(this.currentMonthIst);
  paymentMode = signal<TrainerPaymentMode>('upi');

  // --- TRAINER STATE ---
  trainerAttendance = signal<TrainerAttendanceRow[]>([]);
  trainerAttendanceTotal = signal<number>(0);
  trainerAttendancePage = signal<number>(1);
  trainerAttendancePageSize = signal<number>(8);
  trainerAttendanceLoaded = signal<boolean>(false);
  trainerAttendanceLoading = signal<boolean>(false);
  trainerAttendanceSnapshot = signal<TrainerAttendanceSnapshot | null>(null);

  trainerPayments = signal<TrainerPaymentRow[]>([]);
  trainerPaymentsTotal = signal<number>(0);
  trainerPaymentsPage = signal<number>(1);
  trainerPaymentsPageSize = signal<number>(8);
  trainerPaymentsLoaded = signal<boolean>(false);
  trainerPaymentsLoading = signal<boolean>(false);
  trainerPaymentSnapshot = signal<TrainerPaymentSnapshot | null>(null);

  // ==========================================
  // CACHING ENGINE
  // ==========================================
  private adminAttCache = new Map<string, { rows: TrainerAttendanceRow[], count: number }>();
  private adminAttSnapCache = new Map<string, TrainerAttendanceSnapshot>();
  private adminPayCache = new Map<string, { rows: TrainerPaymentRow[], count: number }>();
  private adminPaySnapCache = new Map<string, TrainerPaymentSnapshot>();

  clearAdminCache() {
    this.adminAttCache.clear();
    this.adminAttSnapCache.clear();
    this.adminPayCache.clear();
    this.adminPaySnapCache.clear();
  }

  // ==========================================
  // TIME UTILITIES (IST)
  // ==========================================
  get todayString(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  getIstDate(): Date {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5)); 
  }

  get todayStringIst(): string {
    const d = this.getIstDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get currentMonthIst(): string {
    const d = this.getIstDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  get lastFourMonths(): string[] {
    const months = [];
    for(let i = 0; i < 4; i++) {
       const d = this.getIstDate();
       d.setDate(1); // Set day to 1st to prevent index overflow on month-end days (e.g. 31st)
       d.setMonth(d.getMonth() - i);
       months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  async searchTrainers(term: string): Promise<TrainerMini[]> {
    const keyword = term.trim();
    if (!keyword) return [];
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, full_name')
      .eq('user_role', 'trainer')
      .eq('is_active', true)
      .ilike('full_name', `${keyword}%`)
      .limit(6);
    if (error) throw error;
    return data || [];
  }

  // ==========================================
  // ADMIN METHODS (Fully Cached)
  // ==========================================
  async fetchAdminAttendance(force = false) {
    const cacheKey = `${this.adminAttendanceTrainerId() || 'all'}_${this.adminAttendanceStatus()}_${this.adminAttendancePage()}`;
    
    if (!force && this.adminAttCache.has(cacheKey)) {
      const cached = this.adminAttCache.get(cacheKey)!;
      this.adminAttendance.set(cached.rows);
      this.adminAttendanceTotal.set(cached.count);
      await this.fetchAdminAttendanceSnapshot(); 
      return;
    }

    this.adminAttendanceLoading.set(true);
    try {
      const from = (this.adminAttendancePage() - 1) * this.adminAttendancePageSize();
      const to = from + this.adminAttendancePageSize() - 1;

      let query = this.supabaseService.client
        .from('trainer_attendance')
        .select('id, attendance_date, start_time, end_time, status, profiles!trainer_attendance_trainer_profile_id_fkey(full_name)', { count: 'exact' })
        .order('attendance_date', { ascending: false })
        .range(from, to);

      if (this.adminAttendanceStatus() !== 'all') query = query.eq('status', this.adminAttendanceStatus());
      if (this.adminAttendanceTrainerId()) query = query.eq('trainer_profile_id', this.adminAttendanceTrainerId());

      const { data, count, error } = await query;
      if (error) throw error;

      const rows = (data || []) as unknown as TrainerAttendanceRow[];
      this.adminAttendance.set(rows);
      this.adminAttendanceTotal.set(count || 0);
      
      this.adminAttCache.set(cacheKey, { rows, count: count || 0 });
      await this.fetchAdminAttendanceSnapshot(force);
    } finally {
      this.adminAttendanceLoading.set(false);
    }
  }

  async fetchAdminAttendanceSnapshot(force = false) {
    const key = this.adminAttendanceTrainerId() || 'all';
    if (!force && this.adminAttSnapCache.has(key)) {
      this.adminAttendanceSnapshot.set(this.adminAttSnapCache.get(key)!);
      return;
    }

    const { data, error } = await this.supabaseService.client.rpc('get_trainer_attendance_snapshot', {
      p_trainer_profile_id: this.adminAttendanceTrainerId(),
    });
    if (error) throw error;
    
    const snap = this.normalizeAttendanceSnapshot(data);
    this.adminAttendanceSnapshot.set(snap);
    this.adminAttSnapCache.set(key, snap);
  }

  async updateAttendanceStatus(id: string, status: 'approved' | 'rejected') {
    const payload = { status };
    const { error } = await this.supabaseService.client.from('trainer_attendance').update(payload).eq('id', id);
    if (error) throw error;
    
    this.clearAdminCache();
    await this.fetchAdminAttendance(true);
  }

  async fetchAdminPayments(force = false) {
    if (!this.adminPaymentsTrainerId()) return;

    const cacheKey = `${this.adminPaymentsTrainerId()}_${this.adminPaymentsPage()}`;
    if (!force && this.adminPayCache.has(cacheKey)) {
      const cached = this.adminPayCache.get(cacheKey)!;
      this.adminPayments.set(cached.rows);
      this.adminPaymentsTotal.set(cached.count);
      await this.fetchAdminPaymentSnapshot();
      return;
    }

    this.adminPaymentsLoading.set(true);
    try {
      const from = (this.adminPaymentsPage() - 1) * this.adminPaymentsPageSize();
      const to = from + this.adminPaymentsPageSize() - 1;

      let query = this.supabaseService.client
        .from('trainer_payments')
        .select('id, salary_month, amount, payment_date, payment_mode, profiles!trainer_payments_trainer_profile_id_fkey(full_name)', { count: 'exact' })
        .order('payment_date', { ascending: false })
        .range(from, to);

      if (this.adminPaymentsTrainerId()) query = query.eq('trainer_profile_id', this.adminPaymentsTrainerId());

      const { data, count, error } = await query;
      if (error) throw error;

      const rows = (data || []) as unknown as TrainerPaymentRow[];
      this.adminPayments.set(rows);
      this.adminPaymentsTotal.set(count || 0);
      
      this.adminPayCache.set(cacheKey, { rows, count: count || 0 });
      await this.fetchAdminPaymentSnapshot(force);
    } finally {
      this.adminPaymentsLoading.set(false);
    }
  }

  async fetchAdminPaymentSnapshot(force = false) {
    if (!this.adminPaymentsTrainerId()) return;
    const key = this.adminPaymentsTrainerId()!;
    
    if (!force && this.adminPaySnapCache.has(key)) {
      this.adminPaymentSnapshot.set(this.adminPaySnapCache.get(key)!);
      return;
    }

    const { data, error } = await this.supabaseService.client.rpc('get_trainer_payment_snapshot', {
      p_trainer_profile_id: this.adminPaymentsTrainerId(),
    });
    if (error) throw error;

    const snap = this.normalizePaymentSnapshot(data);
    this.adminPaymentSnapshot.set(snap);
    this.adminPaySnapCache.set(key, snap);
  }

  async createPayment(payload: PaymentCreatePayload) {
    const { error } = await this.supabaseService.client.from('trainer_payments').insert(payload);
    if (error) throw error;
    
    this.clearAdminCache(); 
    await this.fetchAdminPayments(true);
  }

  resetAdminPaymentTrainer() {
    this.adminPaymentsTrainerId.set(null);
    this.adminPaymentsTrainerName.set('');
    this.adminPaymentsPage.set(1);
    this.adminPayments.set([]);
    this.adminPaymentsTotal.set(0);
    this.adminPaymentSnapshot.set(null);
    
    this.selectedPaymentTrainer.set(null);
    this.paymentAmount.set(null);
    this.paymentSalaryMonth.set(this.currentMonthIst);
  }

  resetAdminAttendanceTrainer() {
    this.adminAttendanceTrainerId.set(null);
    this.adminAttendanceTrainerName.set('');
    this.adminAttendancePage.set(1);
  }

  // ==========================================
  // TRAINER METHODS
  // ==========================================
  async submitTrainerAttendance(payload: AttendanceSubmitPayload) {
    const trainerId = this.supabaseService.currentUser()?.id;
    if (!trainerId) throw new Error('Trainer session not found.');

    const { data: existing, error: existingError } = await this.supabaseService.client
      .from('trainer_attendance')
      .select('id, status')
      .eq('trainer_profile_id', trainerId)
      .eq('attendance_date', payload.attendance_date)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing && existing.status === 'approved') {
      throw new Error('This shift is already approved and cannot be modified.');
    }

    const row = {
      trainer_profile_id: trainerId,
      ...payload,
      status: 'pending' as TrainerAttendanceStatus
    };

    const result = existing
      ? await this.supabaseService.client.from('trainer_attendance').update(row).eq('id', existing.id)
      : await this.supabaseService.client.from('trainer_attendance').insert(row);

    if (result.error) throw result.error;

    this.trainerAttendanceLoaded.set(false);
    this.clearAdminCache();
    await this.fetchTrainerAttendance(true);
  }

  async fetchTrainerAttendance(force = false) {
    if (!force && this.trainerAttendanceLoaded()) return;

    const trainerId = this.supabaseService.currentUser()?.id;
    if (!trainerId) return;

    this.trainerAttendanceLoading.set(true);
    try {
      const from = (this.trainerAttendancePage() - 1) * this.trainerAttendancePageSize();
      const to = from + this.trainerAttendancePageSize() - 1;

      const { data, count, error } = await this.supabaseService.client
        .from('trainer_attendance')
        .select('id, attendance_date, start_time, end_time, status', { count: 'exact' })
        .eq('trainer_profile_id', trainerId)
        .order('attendance_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      this.trainerAttendance.set((data || []) as TrainerAttendanceRow[]);
      this.trainerAttendanceTotal.set(count || 0);
      this.trainerAttendanceLoaded.set(true);
      await this.fetchTrainerAttendanceSnapshot();
    } finally {
      this.trainerAttendanceLoading.set(false);
    }
  }

  async fetchTrainerAttendanceSnapshot() {
    const trainerId = this.supabaseService.currentUser()?.id;
    if (!trainerId) return;

    const { data, error } = await this.supabaseService.client.rpc('get_trainer_attendance_snapshot', {
      p_trainer_profile_id: trainerId,
    });
    if (error) throw error;
    this.trainerAttendanceSnapshot.set(this.normalizeAttendanceSnapshot(data));
  }

  async fetchTrainerPayments(force = false) {
    if (!force && this.trainerPaymentsLoaded()) return;

    const trainerId = this.supabaseService.currentUser()?.id;
    if (!trainerId) return;

    this.trainerPaymentsLoading.set(true);
    try {
      const from = (this.trainerPaymentsPage() - 1) * this.trainerPaymentsPageSize();
      const to = from + this.trainerPaymentsPageSize() - 1;

      const { data, count, error } = await this.supabaseService.client
        .from('trainer_payments')
        .select('id, amount, payment_date, salary_month, payment_mode', { count: 'exact' })
        .eq('trainer_profile_id', trainerId)
        .order('payment_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      this.trainerPayments.set((data || []) as TrainerPaymentRow[]);
      this.trainerPaymentsTotal.set(count || 0);
      this.trainerPaymentsLoaded.set(true);
      await this.fetchTrainerPaymentSnapshot();
    } finally {
      this.trainerPaymentsLoading.set(false);
    }
  }

  async fetchTrainerPaymentSnapshot() {
    const trainerId = this.supabaseService.currentUser()?.id;
    if (!trainerId) return;

    const { data, error } = await this.supabaseService.client.rpc('get_trainer_payment_snapshot', {
      p_trainer_profile_id: trainerId,
    });
    if (error) throw error;
    this.trainerPaymentSnapshot.set(this.normalizePaymentSnapshot(data));
  }

  // ==========================================
  // NORMALIZERS
  // ==========================================
  private normalizePaymentSnapshot(data: any): TrainerPaymentSnapshot {
    return {
      total_paid: Number(data?.total_paid || 0),
      current_month_paid: Number(data?.current_month_paid || 0),
      completed_count: Number(data?.completed_count || 0),
      last_payment_date: data?.last_payment_date || null,
      last_five_months: Array.isArray(data?.last_five_months)
        ? data.last_five_months.map((item: any) => ({ month: item.month, total: Number(item.total || 0) }))
        : [],
    };
  }

  private normalizeAttendanceSnapshot(data: any): TrainerAttendanceSnapshot {
    return {
      pending_count: Number(data?.pending_count || 0),
      approved_count: Number(data?.approved_count || 0),
      rejected_count: Number(data?.rejected_count || 0),
      current_month_days: Number(data?.current_month_days || 0),
      current_month_hours: Number(data?.current_month_hours || 0),
    };
  }
}
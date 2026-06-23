import { inject, Injectable, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase-service';

export interface DeadlineState {
  expiry_date: string | null;
  due_date: string | null;
  due_amount: number;
}

export interface WarningCard {
  title: string;
  message: string;
  type: 'expiry' | 'due';
  isOverdue: boolean;
  daysLeft: number; 
  amount?: number;  
}

@Injectable({
  providedIn: 'root',
})
export class UserDeadlineService {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);

  showDialog = signal<boolean>(false);
  isLockedOut = signal<boolean>(false);
  warnings = signal<WarningCard[]>([]);

  constructor() {
    effect(() => {
      const user = this.supabaseService.currentUser();
      if (user && user.user_role === 'member') {
        this.checkDeadlineStatus();
      } else if (user && (user.user_role === 'admin' || user.user_role === 'trainer')) {
        this.showDialog.set(false);
        this.isLockedOut.set(false);
      }
    });
  }

  async checkDeadlineStatus() {
    const cachedData = localStorage.getItem('user_deadline_state');
    if (cachedData) {
      this.evaluateMath();
    } else {
      await this.fetchAndCache();
    }
  }

  private async fetchAndCache() {
    const { data, error } = await this.supabaseService.client.rpc('get_minimal_sub_state');
    if (error) return;

    if (data) {
      localStorage.setItem('user_deadline_state', JSON.stringify(data));
      this.evaluateMath();
    }
  }

  // --- NEW METHOD: API call to mark user inactive ---
  async deactivateUserProfile(): Promise<boolean> {
    try {
      const user = this.supabaseService.currentUser();
      
      // Ensure we have a valid user ID before attempting the update
      if (!user || !user.id) {
        console.error('Cannot deactivate: No active user ID found.');
        return false;
      }

      // Make API call to profiles table to set is_active to false
      const { error } = await this.supabaseService.client
        .from('profiles')
        .update({ is_active: false })
        .eq('id', user.id);

      if (error) {
        console.error('Supabase error deactivating user profile:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Unexpected error deactivating user profile:', err);
      return false;
    }
  }

 // --- THE FLAWLESS UTC-TO-IST TIMEZONE CONVERTER ---
  private getDaysDifference(dbUTCString: string): number {
    // 1. Parse the full UTC string into a native Date object (The exact moment in time)
    // Example DB input: "2026-05-14T19:30:00Z" (Which is technically May 15th, 1:00 AM in India)
    const targetDate = new Date(dbUTCString);
    const todayDate = new Date();

    // 2. Format BOTH dates strictly into Indian Standard Time (IST) calendar dates (YYYY-MM-DD)
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Now targetISTOnly correctly becomes "2026-05-15" instead of May 14th
    const targetISTOnly = formatter.format(targetDate); 
    const todayISTOnly = formatter.format(todayDate);

    // 3. Compare them as pure, timezone-agnostic Midnight dates to get the exact day difference
    const targetMidnight = new Date(`${targetISTOnly}T00:00:00Z`);
    const todayMidnight = new Date(`${todayISTOnly}T00:00:00Z`);

    const diffTime = targetMidnight.getTime() - todayMidnight.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  private evaluateMath() {
    const cachedData = localStorage.getItem('user_deadline_state');
    if (!cachedData) return;

    const state: DeadlineState = JSON.parse(cachedData);
    
    // Check Snooze Status via strict IST
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayISTString = formatter.format(new Date());
    const snoozedDate = localStorage.getItem('deadline_snoozed_date');
    const isSnoozedToday = snoozedDate === todayISTString;

    this.isLockedOut.set(false);
    this.showDialog.set(false);
    
    let currentWarnings: WarningCard[] = [];
    let triggerLockout = false;

    // --- A. EXPIRY LOGIC ---
    if (state.expiry_date) {
      const diffDays = this.getDaysDifference(state.expiry_date);

      if (diffDays < 0) {
        triggerLockout = true;
      } else if (diffDays <= 5) {
        currentWarnings.push({
          title: 'Access Expiring',
          message: 'Your membership is coming to an end. Renew now to maintain uninterrupted access.',
          type: 'expiry',
          isOverdue: false,
          daysLeft: diffDays
        });
      }
    }

    // --- B. DUE DATE LOGIC ---
    if (state.due_date && !triggerLockout) {
      const diffDays = this.getDaysDifference(state.due_date);

      if (diffDays < 0) {
        currentWarnings.push({
          title: 'Overdue Balance',
          message: 'Your payment is past due. Please settle your account immediately to avoid suspension.',
          type: 'due',
          isOverdue: true,
          daysLeft: Math.abs(diffDays),
          amount: state.due_amount
        });
      } else if (diffDays <= 5) {
        currentWarnings.push({
          title: 'Upcoming Payment',
          message: 'An installment on your account is scheduled for collection soon.',
          type: 'due',
          isOverdue: false,
          daysLeft: diffDays,
          amount: state.due_amount
        });
      }
    }

    // --- APPLY STATE ---
    if (triggerLockout) {
      this.isLockedOut.set(true);
      this.warnings.set([{
        title: 'Access Revoked',
        message: 'Your subscription has expired. Please complete your payment to restore your digital and physical access.',
        type: 'expiry',
        isOverdue: true,
        daysLeft: 0
      }]);
      this.showDialog.set(true);
      // this.router.navigate(['/member/plans'], { replaceUrl: true });
    } else if (currentWarnings.length > 0) {
      this.warnings.set(currentWarnings);
      if (!isSnoozedToday) {
        this.showDialog.set(true);
      }
    }
  }

  closeDialog() {
    if (!this.isLockedOut()) {
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
      localStorage.setItem('deadline_snoozed_date', formatter.format(new Date()));
      this.showDialog.set(false);
    }
  }

  clearState() {
    localStorage.removeItem('user_deadline_state');
    localStorage.removeItem('deadline_snoozed_date');
    this.showDialog.set(false);
    this.isLockedOut.set(false);
  }
}
import { Injectable, inject, signal, effect, NgZone } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { Announcement } from '../models/notification.model';

interface DailyCache {
  date: string;
  data: Announcement[];
}

interface LedgerEntry {
  count: number;
  lastClosedAt: number; // Timestamp in milliseconds
}

interface DailyLedger {
  date: string;
  closures: Record<string, LedgerEntry>;
}

@Injectable({
  providedIn: 'root',
})
export class MemberAnnouncementService {
  private supabaseService = inject(SupabaseService);
  private ngZone = inject(NgZone);

  // State Signals for the UI
  activeAnnouncements = signal<Announcement[]>([]);
  isDialogVisible = signal<boolean>(false);

  private hourlyInterval: any;
  private isInitialized = false;

 constructor() {
    effect(() => {
      const user = this.supabaseService.currentUser();
      
      // THE FIX: Check if the user exists AND their role is strictly 'member'
      if (user && user.user_role === 'member') {
        
        // Member logged in: Start engine safely
        this.ngZone.run(() => {
          this.initializeEngine();
        });
        
      } else {
        
        // Admin logged in OR User logged out: Reset state & stay hidden
        this.isDialogVisible.set(false);
        this.activeAnnouncements.set([]);
        this.isInitialized = false;
        if (this.hourlyInterval) clearInterval(this.hourlyInterval);
        
      }
    });
  }

  private async initializeEngine() {
    if (this.isInitialized) return; 
    this.isInitialized = true;

    setTimeout(async () => {
      await this.checkAndLoadData();

      // Background monitor checking if midnight has passed
      this.hourlyInterval = setInterval(() => {
        this.checkAndLoadData();
      }, 1000 * 60 * 60); 

    }, 600); 
  }

  private async checkAndLoadData() {
    const todayStr = this.getTodayString();
    let cache = this.getDailyCache();

    // NEW DAY LOGIC: If date string changes, ignore cache and fetch fresh
    if (!cache || cache.date !== todayStr) {
      await this.fetchFromSupabase(todayStr);
    } else {
      this.processQueue(cache.data, todayStr);
    }
  }

  private async fetchFromSupabase(todayStr: string) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('announcements')
        .select('id, title, content, type, priority, category')
        .lte('start_date', todayStr)
        .gte('expiry_date', todayStr)
        .order('created_at', { ascending: false });;

      if (error) throw error;

      const announcements = data as Announcement[];
      
      localStorage.setItem('daily_announcement_cache', JSON.stringify({
        date: todayStr,
        data: announcements
      }));

      this.processQueue(announcements, todayStr);
    } catch (error) {
      console.error('Failed to fetch daily announcements:', error);
    }
  }

  private processQueue(allActiveAnnouncements: Announcement[], todayStr: string) {
    const ledger = this.getDailyLedger(todayStr);
    const now = new Date().getTime();
    
    // --- 1. FILTER BY PRIORITY LIMITS ---
    const validAnnouncements = allActiveAnnouncements.filter(ad => {
      const entry = ledger.closures[ad.id!] || { count: 0, lastClosedAt: 0 };
      
      // Strict Priority Limits
      if (ad.priority === 'low' && entry.count >= 1) return false;
      if (ad.priority === 'high' && entry.count >= 2) return false;
      
      // 3-HOUR COOLDOWN FOR HIGH PRIORITY
      if (ad.priority === 'high' && entry.count === 1) {
        const timeSinceLastClose = now - entry.lastClosedAt;
        const threeHoursInMs = 3 * 60 * 60 * 1000; // 3 Hours
        if (timeSinceLastClose < threeHoursInMs) return false; // Still in cooldown
      }
      
      return true;
    });

    // --- 2. SORT QUEUE (High Priority First) ---
    validAnnouncements.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    });

    this.ngZone.run(() => {
      if (validAnnouncements.length > 0) {
        this.activeAnnouncements.set(validAnnouncements);
        this.isDialogVisible.set(true);
      } else {
        this.isDialogVisible.set(false);
      }
    });
  }

  public acknowledgeAnnouncement(id: string) {
    const todayStr = this.getTodayString();
    const ledger = this.getDailyLedger(todayStr);

    if (!ledger.closures[id]) {
      ledger.closures[id] = { count: 0, lastClosedAt: 0 };
    }
    
    ledger.closures[id].count += 1;
    ledger.closures[id].lastClosedAt = new Date().getTime();

    localStorage.setItem('daily_announcement_ledger', JSON.stringify(ledger));
  }

  public closeMasterDialog() {
    this.isDialogVisible.set(false);
  }

  private getTodayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private getDailyCache(): DailyCache | null {
    const str = localStorage.getItem('daily_announcement_cache');
    return str ? JSON.parse(str) : null;
  }

  private getDailyLedger(todayStr: string): DailyLedger {
    const str = localStorage.getItem('daily_announcement_ledger');
    if (str) {
      const ledger: DailyLedger = JSON.parse(str);
      // Validates that the ledger is for TODAY. If not, it creates a fresh one.
      if (ledger.date === todayStr) return ledger; 
    }
    return { date: todayStr, closures: {} };
  }
}
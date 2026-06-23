import { Component, inject, OnInit, signal, PLATFORM_ID, computed, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { StorageService } from '../../../services/storage-service'; 
import { MOTIVATIONAL_QUOTES } from '../../../shared/motivational-quotes';
import { RouterLink } from "@angular/router";
import { BIRTHDAY_MESSAGES } from '../../../shared/birthday-msg';




@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-dashboard.html'
})
export class UserDashboard implements OnInit {
  private storage = inject(StorageService);
  private platformId = inject(PLATFORM_ID);

  isLoading = signal<boolean>(true);

  // Core Data
  user = signal<any>(null);
  deadlineState = signal<any>(null);
  activeSubscription = signal<any>(null);
  latestVitals = signal<any>(null);
  attendanceToday = signal<any>(null);
  
  // Plan States
  workoutAssigned = signal<boolean>(false);
  todayWorkout = signal<any>(null);
  workoutExpanded = signal<boolean>(false);

  dietAssigned = signal<boolean>(false);
  todayDiet = signal<any>(null);
  dietExpanded = signal<boolean>(false);

  // Safe SSR Signals
  todayName = signal<string>('Monday');
  dailyQuote = signal<string>('Strive for progress, not perfection.');
  
  // Birthday logic
  isBirthday = signal<boolean>(false);
  birthdayMessage = signal<string>('');

  // Computed Vitals
  bmi = computed(() => {
    const vitals = this.latestVitals();
    if (!vitals?.weight_kg || !vitals?.height_cm) return null;
    const heightM = vitals.height_cm / 100;
    return (vitals.weight_kg / (heightM * heightM)).toFixed(1);
  });

  // Computed Subscription Progress
  subsProgress = computed(() => {
    const sub = this.activeSubscription();
    if (!sub?.start_date || !sub?.end_date) return 0;
    
    const start = new Date(sub.start_date).getTime();
    const end = new Date(sub.end_date).getTime();
    const now = new Date().getTime();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    return Math.round(((now - start) / (end - start)) * 100);
  });

  // Fallback Deadline Days
  daysToExpiry = computed(() => {
    const deadline = this.deadlineState();
    return this.getDaysRemaining(deadline?.expiry_date);
  });

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.todayName.set(new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()));
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      this.dailyQuote.set(MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length]);
      
      await this.loadData();
    }
  }

  async loadData() {
    try {
      this.isLoading.set(true);

      // 1. Fetch User Safely (Checks IDB, falls back to LS)
      let storedUser: any = await this.storage.getItem<any>('user').catch(() => null);
      if (!storedUser) {
        const lsUser = localStorage.getItem('user');
        if (lsUser) try { storedUser = JSON.parse(lsUser); } catch (e) {}
      }

      // 2. Fetch Deadline Safely (Checks IDB, falls back to LS)
      let storedDeadline: any = await this.storage.getItem<any>('user_deadline_state').catch(() => null);
      if (!storedDeadline) {
        const lsDeadline = localStorage.getItem('user_deadline_state');
        if (lsDeadline) try { storedDeadline = JSON.parse(lsDeadline); } catch (e) {}
      }

      if (storedUser) {
        this.user.set(storedUser);
        const userId = storedUser.id;
        const planId = storedUser.exercise_plan_id;

        // Apply Deadline state if found
        if (storedDeadline) {
          this.deadlineState.set(storedDeadline);
        }

        // Birthday Check
        if (storedUser.date_of_birth) {
          const today = new Date();
          const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const dobMMDD = storedUser.date_of_birth.substring(5, 10);
          
          if (todayMMDD === dobMMDD) {
            this.isBirthday.set(true);
            const birthYear = parseInt(storedUser.date_of_birth.substring(0, 4)) || 1990;
            this.birthdayMessage.set(BIRTHDAY_MESSAGES[birthYear % BIRTHDAY_MESSAGES.length]);
          }
        }

        // Fetch Remaining Caches Concurrently from IndexedDB
        const [subsCache, workoutCache, dietCache, attendance, history] = await Promise.all([
          this.storage.getItem<any[]>('user_subs_cache').catch(() => null),
          planId ? this.storage.getItem<any>(`workout_cache_${planId}`).catch(() => null) : Promise.resolve(null),
          this.storage.getItem<any>('user_diet_cache').catch(() => null),
          userId ? this.storage.getItem<any>(`attendance_30d_${userId}`).catch(() => null) : Promise.resolve(null),
          userId ? this.storage.getItem<any[]>(`member_history_${userId}`).catch(() => null) : Promise.resolve([])
        ]);

        if (subsCache && Array.isArray(subsCache) && subsCache.length > 0) {
          const active = subsCache.find(s => s.status === 'ACTIVE') || subsCache[0];
          this.activeSubscription.set(active);
        } else {
          this.activeSubscription.set(null);
        }

        if (history && history.length > 0) {
          this.latestVitals.set(history[history.length - 1]);
        }

        if (workoutCache && workoutCache.enrichedDays) {
          this.workoutAssigned.set(true);
          this.todayWorkout.set(workoutCache.enrichedDays.find((d: any) => d.dayName === this.todayName()));
        } else {
          this.workoutAssigned.set(false);
        }
        
        if (dietCache && dietCache.data && dietCache.data.weekly_schedule) {
          this.dietAssigned.set(true);
          this.todayDiet.set(dietCache.data.weekly_schedule.find((d: any) => d.dayName === this.todayName()));
        } else {
          this.dietAssigned.set(false);
        }
        
        if (attendance && Array.isArray(attendance)) {
          const today = new Date();
          const localTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          this.attendanceToday.set(attendance.find(a => a.attendance_date === localTodayStr) || null);
        }
      }
    } catch (error) {
      console.error('Critical failure loading dashboard data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  toggleWorkout() {
    this.workoutExpanded.set(!this.workoutExpanded());
  }

  toggleDiet() {
    this.dietExpanded.set(!this.dietExpanded());
  }
  
  // Flawless timezone-safe calendar day calculation (Midnight to Midnight)
  getDaysRemaining(endDateUtc: string | null): number {
    if (!endDateUtc) return 0;
    
    // new Date() correctly interprets the +00:00 ISO string and maps it to IST (+5:30)
    const targetDate = new Date(endDateUtc); 
    const today = new Date();
    
    // Zero out hours to calculate strict calendar days regardless of exact hour of purchase
    targetDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffMs = targetDate.getTime() - today.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 3600 * 24)));
  }
}
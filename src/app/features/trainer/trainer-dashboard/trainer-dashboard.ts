import { Component, inject, OnInit, signal, PLATFORM_ID, computed, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from "@angular/router";
import { toSignal } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { StorageService } from '../../../services/storage-service';
import { TrainerService } from '../../../services/trainer-service';
import { TrainerPermissions } from '../../../models/trainer.model';

interface DashboardModule {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  iconPath: string;
  colorClass: string;
  bgClass: string;
}

interface ModuleCategory {
  title: string;
  modules: DashboardModule[];
}

@Component({
  selector: 'app-trainer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trainer-dashboard.html'
})
export class TrainerDashboard implements OnInit {
  private storage = inject(StorageService);
  private trainerService = inject(TrainerService);
  private platformId = inject(PLATFORM_ID);

  isLoading = signal<boolean>(true);
  trainer = signal<any>(null);
  permissions = signal<TrainerPermissions | null>(null);

  // High-performance Live Clock
  currentTime = toSignal(
    timer(0, 30000).pipe(
      map(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    ),
    { initialValue: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }
  );

  currentDate = signal<string>(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));

  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  });

  // Categorized Modules for Premium Bento Layout
  moduleCategories = computed<ModuleCategory[]>(() => {
    const p = this.permissions();
    if (!p) return [];

    const categories: ModuleCategory[] = [];

    // Category 1: Frontline Operations
    const ops: DashboardModule[] = [];
    if (p.can_view_qr_desk) ops.push({ id: 'qr', title: 'QR Desk', subtitle: 'Access Control', route: '/trainer/admin-qr-desk', iconPath: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10 border-emerald-500/20' });
    if (p.can_view_attendance) ops.push({ id: 'attendance', title: 'Attendance', subtitle: 'Check-in Logs', route: '/trainer/attendance-history', iconPath: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12M16 3v4M8 3v4M4 11h16', colorClass: 'text-teal-500', bgClass: 'bg-teal-500/10 border-teal-500/20' });
    if (ops.length > 0) categories.push({ title: 'Operations', modules: ops });

    // Category 2: Programming & Plans
    const programming: DashboardModule[] = [];
    if (p.can_manage_workout) programming.push({ id: 'workout', title: 'Workouts', subtitle: 'Routine Builder', route: '/trainer/workout', iconPath: 'M13 10V3L4 14h7v7l9-11h-7z', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10 border-amber-500/20' });
    if (p.can_manage_diet) programming.push({ id: 'diet', title: 'Nutrition', subtitle: 'Dietary Plans', route: '/trainer/diet', iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', colorClass: 'text-rose-500', bgClass: 'bg-rose-500/10 border-rose-500/20' });
    if (p.can_manage_gym_plans) programming.push({ id: 'gym-plan', title: 'Gym Plans', subtitle: 'Master Blueprints', route: '/trainer/gym-plan', iconPath: 'M13 16H8M14 8H8M16 12H8M4 3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10 border-blue-500/20' });
    if (p.can_manage_exercises) programming.push({ id: 'exercises', title: 'Exercises', subtitle: 'Movement Library', route: '/trainer/exercise-library', iconPath: 'M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0M3 14l4 1l.5 -.5M12 18v-3l-3 -2.923l.75 -5.077M6 10v-2l4 -1l2.5 2.5l2.5 .5', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10 border-orange-500/20' });
    if (programming.length > 0) categories.push({ title: 'Programming', modules: programming });

    // Category 3: Client & System Management
    const management: DashboardModule[] = [];
    if (p.can_manage_users) management.push({ id: 'members', title: 'Clients', subtitle: 'Member Roster', route: '/trainer/members', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10 border-indigo-500/20' });
    if (p.can_manage_subscriptions) management.push({ id: 'subs', title: 'Subscriptions', subtitle: 'Billing & Plans', route: '/trainer/subscription', iconPath: 'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M6 21v-2a4 4 0 0 1 4 -4h3M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5M19 21v1m0 -8v1', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10 border-purple-500/20' });
    if (p.can_manage_announcements) management.push({ id: 'notices', title: 'Notices', subtitle: 'Global Alerts', route: '/trainer/notification', iconPath: 'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14', colorClass: 'text-pink-500', bgClass: 'bg-pink-500/10 border-pink-500/20' });
    if (p.can_manage_settings) management.push({ id: 'settings', title: 'Settings', subtitle: 'System Config', route: '/trainer/setting', iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', colorClass: 'text-slate-400', bgClass: 'bg-slate-500/10 border-slate-500/20' });
    if (management.length > 0) categories.push({ title: 'Management', modules: management });

    return categories;
  });

  totalActiveModules = computed(() => {
    return this.moduleCategories().reduce((acc, cat) => acc + cat.modules.length, 0);
  });

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.loadTrainerSession();
    }
  }

  private async loadTrainerSession() {
    try {
      this.isLoading.set(true);

      let storedUser: any = await this.storage.getItem<any>('user').catch(() => null);
      if (!storedUser) {
        const lsUser = localStorage.getItem('user');
        if (lsUser) try { storedUser = JSON.parse(lsUser); } catch (e) {}
      }

      if (storedUser) {
        this.trainer.set(storedUser);
        
        const cacheKey = `trainer_perms_${storedUser.id}`;
        const cachedPerms = localStorage.getItem(cacheKey);

        if (cachedPerms) {
          // INSTANT LOAD: Use cache, NO API CALL
          this.permissions.set(JSON.parse(cachedPerms));
        } else {
          // FIRST TIME ONLY: Fetch from DB and save to cache
          const accessData = await this.trainerService.getTrainerAccessData(storedUser.id);
          this.permissions.set(accessData.permissions);
          
          // Save for the Guard to use instantly
          localStorage.setItem(cacheKey, JSON.stringify(accessData.permissions));
        }
      }
    } catch (error) {
      console.error('Failed to load trainer dashboard:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
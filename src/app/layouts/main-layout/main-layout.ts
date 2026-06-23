import { Component, signal, computed, inject, OnInit, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase-service';
import { TrainerService } from '../../services/trainer-service'; 
import { StorageService } from '../../services/storage-service';
import { AnnouncementDialog } from "../../shared/ui/announcement-dialog/announcement-dialog";
import { DialogService } from '../../services/dialog-service';
import { UserDeadlineDialog } from "../../shared/ui/user-deadline-dialog/user-deadline-dialog";
import { TrainerPermissions } from '../../models/trainer.model';

interface NavItem { id: string; label: string; route: string; icon: SafeHtml; }

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AnnouncementDialog, UserDeadlineDialog],
  templateUrl: './main-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './main-layout.scss',
})
export class MainLayout implements OnInit {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private supabaseService = inject(SupabaseService);
  private trainerService = inject(TrainerService); 
  private dialogService = inject(DialogService);

  // --- SYNCHRONOUS LOCAL STORAGE HELPER ---
  // This prevents the PWA "Access Denied" race condition
  private getLocalUser() {
    const userStr = localStorage.getItem('user');
    if (userStr && userStr !== 'null' && userStr !== 'undefined') {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  userRole = signal<string>(this.getLocalUser()?.user_role || 'member');
  activeId = signal<string>('dashboard');
  isMoreMenuOpen = signal<boolean>(false);
  trainerPermissions = signal<TrainerPermissions | null>(null); 

  private icon = (svg: string) => this.sanitizer.bypassSecurityTrustHtml(svg);

  private adminNav: NavItem[] = [
    { id: 'dashboard', label: 'Home', route: '/admin/dashboard', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`) },
    { id: 'qr_desk', label: 'QR Desk', route: '/admin/admin-qr-desk', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>`) },
    { id: 'members', label: 'Users', route: '/admin/members', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`) },
    { id: 'diet', label: 'Diet Plan', route: '/admin/diet', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`) },
    { id: 'workout', label: 'Workout Plan', route: '/admin/workout', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg>`) },
    { id: 'gym-plan', label: 'Gym Plans', route: '/admin/gym-plan', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2"/></svg>`) },
    { id: 'subscription', label: 'subscription', route: '/admin/subscription', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h3"/><path d="M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5"/><path d="M19 21v1m0 -8v1"/></svg>`) },
    { id: 'attendance', label: 'Attendance', route: '/admin/attendance-history', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M7 14h.013"/><path d="M10.01 14h.005"/><path d="M13.01 14h.005"/><path d="M16.015 14h.005"/><path d="M13.015 17h.005"/><path d="M7.01 17h.005"/><path d="M10.01 17h.005"/></svg>`) },
    { id: 'exercises', label: 'Exercises', route: '/admin/exercise-library', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M3 14l4 1l.5 -.5"/><path d="M12 18v-3l-3 -2.923l.75 -5.077"/><path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5"/><path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1"/><path d="M18 21l1 -11l2 -1"/></svg>`) },
    { id: 'trainers', label: 'Trainers', route: '/admin/trainers', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"/><path d="M15 14a5 5 0 0 0-7.584 2"/><path d="M9.964 6.825C8.019 7.977 9.5 13 8 15"/></svg>`) },
    { id: 'trainer-ops', label: 'Staff Ops', route: '/admin/trainer-ops', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M5 4h14a2 2 0 0 1 2 2v6.5"/><path d="M5 4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7.5"/><path d="M16 19h6"/><path d="M19 16v6"/><path d="M15 14.5h8v9h-8z"/></svg>`) },
    { id: 'setting', label: 'setting', route: '/admin/setting', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path></svg>`) },
    { id: 'announcement', label: 'Announcement', route: '/admin/notification', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/></svg>`) },
  ];

  private baseTrainerNav: NavItem[] = [
    { id: 'dashboard', label: 'Home', route: '/trainer/dashboard', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`) },
    { id: 'worklog', label: 'Worklog', route: '/trainer/worklog', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"/><path d="m9 16 2 2 4-5"/></svg>`) },
    { id: 'qr_desk', label: 'QR Desk', route: '/trainer/admin-qr-desk', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>`) },
    { id: 'members', label: 'Users', route: '/trainer/members', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`) },
    { id: 'diet', label: 'Diet Plan', route: '/trainer/diet', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`) },
    { id: 'workout', label: 'Workout Plan', route: '/trainer/workout', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg>`) },
    { id: 'gym-plan', label: 'Gym Plans', route: '/trainer/gym-plan', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2"/></svg>`) },
    { id: 'subscription', label: 'subscription', route: '/trainer/subscription', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h3"/><path d="M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5"/><path d="M19 21v1m0 -8v1"/></svg>`) },
    { id: 'attendance', label: 'Attendance', route: '/trainer/attendance-history', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M7 14h.013"/><path d="M10.01 14h.005"/><path d="M13.01 14h.005"/><path d="M16.015 14h.005"/><path d="M13.015 17h.005"/><path d="M7.01 17h.005"/><path d="M10.01 17h.005"/></svg>`) },
    { id: 'exercises', label: 'Exercises', route: '/trainer/exercise-library', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M3 14l4 1l.5 -.5"/><path d="M12 18v-3l-3 -2.923l.75 -5.077"/><path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5"/><path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1"/><path d="M18 21l1 -11l2 -1"/></svg>`) },
    { id: 'setting', label: 'setting', route: '/trainer/setting', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path></svg>`) },
    { id: 'announcement', label: 'Announcement', route: '/trainer/notification', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/></svg>`) },
    { id: 'profile', label: 'Profile', route: '/trainer/profile', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path></svg>`) },
  ];

  // ==========================================
  // DYNAMIC TRAINER MENU FILTERING
  // ==========================================
  private filteredTrainerNav = computed<NavItem[]>(() => {
    const perms = this.trainerPermissions();
    if (!perms) {
      // While loading, only show Dashboard and Profile so UI doesn't break
      return this.baseTrainerNav.filter(item => item.id === 'dashboard' || item.id === 'worklog' || item.id === 'profile');
    }

    return this.baseTrainerNav.filter(item => {
      if (item.id === 'dashboard' || item.id === 'worklog' || item.id === 'profile') return true;

      if (item.id === 'qr_desk') return perms.can_view_qr_desk;
      if (item.id === 'members') return perms.can_manage_users;
      if (item.id === 'diet') return perms.can_manage_diet;
      if (item.id === 'workout') return perms.can_manage_workout;
      if (item.id === 'gym-plan') return perms.can_manage_gym_plans;
      if (item.id === 'subscription') return perms.can_manage_subscriptions;
      if (item.id === 'attendance') return perms.can_view_attendance;
      if (item.id === 'exercises') return perms.can_manage_exercises;
      if (item.id === 'setting') return perms.can_manage_settings;
      if (item.id === 'announcement') return perms.can_manage_announcements;

      return false; 
    });
  });

  private memberNav = computed<NavItem[]>(() => {
    // Utilize getLocalUser first so cold-starts don't break UI lookups
    const user = this.getLocalUser() || this.supabaseService.currentUser();
    const workoutId = user?.exercise_plan_id || 'unassigned';
    const dietId = user?.diet_plan_id || 'unassigned';

    return [
      { id: 'dashboard', label: 'Home', route: '/member/dashboard', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`) },
      { id: 'attendance', label: 'Scan', route: '/member/attendance', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4 M16 2v4 M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8 M3 10h18 m-5 10 2 2 4-4"/></svg>`) },
      { id: 'diet', label: 'Diet', route: `/member/diet-details/${dietId}`, icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg>`) },
      { id: 'work-out', label: 'Workout', route: `/member/workout-details/${workoutId}`, icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.6 12.8a2 2 0 1 0 2.8-2.8l-1.8-1.8a2 2 0 0 0 2.8-2.8 2 2 0 0 0-2.8 2.8l-1.8-1.8a2 2 0 1 0-2.8 2.8z m-15.1 8.7 1.4-1.4 m16.2-16.2 1.4-1.4 M5.3 21.5a2 2 0 1 0 2.8-2.8l1.8 1.8a2 2 0 1 0 2.8-2.8l-6.4-6.4a2 2 0 1 0-2.8 2.8l1.8 1.8a2 2 0 0 0-2.8 2.8z m4.3-7.1 4.8-4.8"/></svg>`) },
      { id: 'health', label: 'Health', route: '/member/health-tracker', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12h4l3 8l4 -16l3 8h4"/></svg>`) },
      { id: 'ai_chat', label: 'Elite Coach', route: '/member/ai-chat', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 12h4.5"/><path d="M8 8h6"/><path d="M8 16h2"/><path d="M3 7v-2a2 2 0 0 1 2 -2h2"/><path d="M3 17v2a2 2 0 0 0 2 2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M14 21v-4a2 2 0 1 1 4 0v4"/><path d="M14 19h4"/><path d="M21 15v6"/></svg>`) },
      { id: 'profile', label: 'Profile', route: '/member/profile', icon: this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path></svg>`) },
      { id: 'plans', label: 'Plans', route: '/member/plans', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 16H8"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/></svg>`) },
      { id: 'setting', label: 'Setting', route: '/member/setting', icon: this.icon(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13.256 20.473c-.855 .907 -2.583 .643 -2.931 -.79a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.07 .26 1.488 1.29 1.254 2.15"/><path d="M19 16l-2 3h4l-2 3"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>`) },
    ];
  });

  moreIcon = this.icon(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 16 6 12 10 8 6 12 2"></polygon><polygon points="12 14 16 18 12 22 8 18 12 14"></polygon><polygon points="2 12 6 16 10 12 6 8 2 12"></polygon><polygon points="14 12 18 16 22 12 18 8 14 12"></polygon></svg>`);

  currentNav = computed(() => {
    const role = this.userRole();
    if (role === 'admin') return this.adminNav;
    if (role === 'trainer') return this.filteredTrainerNav();
    return this.memberNav();
  });

  // --- UPDATED LAYOUT SIGNALS ---
  // Guarantees the "More" button always has its dedicated spot on the right side
  primaryLeft = computed(() => this.currentNav().slice(0, 2));
  
  primaryRight = computed(() => this.currentNav().slice(2, 3));
  
  secondaryNav = computed(() => this.currentNav().slice(3));

  async ngOnInit() {
    // 1. Pull data safely via local storage immediately
    const localUser = this.getLocalUser();
    const currentRole = localUser?.user_role || 'member';
    const currentUserId = localUser?.id || this.supabaseService.currentUser()?.id;

    // 2. Fetch Trainer Permissions
    if (currentRole === 'trainer' && currentUserId) {
      try {
        const accessData = await this.trainerService.getTrainerAccessData(currentUserId);
        this.trainerPermissions.set(accessData.permissions);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(`trainer_perms_${currentUserId}`, JSON.stringify(accessData.permissions));
        }
      } catch (error) {
        console.error("Could not fetch trainer permissions", error);
      }
    }

    // 3. Route Sync logic
    if (this.router.url === '/') {
      this.router.navigate([`/${currentRole}/dashboard`], { replaceUrl: true });
    }
    
    this.syncRoute(this.router.url);
    
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: NavigationEnd) => this.syncRoute(event.urlAfterRedirects));
  }

  private syncRoute(url: string) {
    const matchedItem = this.currentNav().find(item => url.includes(item.route));
    this.activeId.set(matchedItem ? matchedItem.id : 'dashboard');
  }

  setActive(item: NavItem) {
    this.router.navigate([item.route]);
    this.isMoreMenuOpen.set(false);
  }

  toggleMore() { this.isMoreMenuOpen.set(!this.isMoreMenuOpen()); }
  closeMore() { this.isMoreMenuOpen.set(false); }

  async logout() {
    const confirmed = await this.dialogService.open({
      title: `Loging Out`,
      message: `Are you sure you want to logout?`,
      mode: 'warning',
      confirmText: 'logout',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;
    this.supabaseService.logout();
  }
}

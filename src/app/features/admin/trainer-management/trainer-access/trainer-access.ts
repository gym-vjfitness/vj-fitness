import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TrainerPermissions } from '../../../../models/trainer.model';
import { TrainerService } from '../../../../services/trainer-service';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';

interface PermissionField {
  key: keyof TrainerPermissions;
  label: string;
  description: string;
  icon: SafeHtml;
}

@Component({
  selector: 'app-trainer-access',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trainer-access.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './trainer-access.scss',
})
export class TrainerAccess implements OnInit {
  private route = inject(ActivatedRoute);
  private trainerService = inject(TrainerService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private location = inject(Location);
  private sanitizer = inject(DomSanitizer);

  trainerId = signal<string | null>(null);
  trainerName = signal<string>('Loading...');
  
  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);
  hasUnsavedChanges = signal<boolean>(false);

  permissions = signal<TrainerPermissions | null>(null);

  private icon = (svg: string) => this.sanitizer.bypassSecurityTrustHtml(svg);

  // Compact, clear descriptions
  permissionFields: PermissionField[] = [
    { key: 'can_view_qr_desk', label: 'QR Desk', description: 'Scan user check-ins.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>`) },
    { key: 'can_manage_users', label: 'Manage Members', description: 'View assigned member profiles.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`) },
    { key: 'can_manage_diet', label: 'Diet Plans', description: 'Create and assign diets.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`) },
    { key: 'can_manage_workout', label: 'Workout Plans', description: 'Design exercise routines.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg>`) },
    { key: 'can_view_attendance', label: 'Attendance', description: 'View check-in history.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M7 14h.013"/><path d="M10.01 14h.005"/><path d="M13.01 14h.005"/></svg>`) },
    { key: 'can_manage_exercises', label: 'Exercise Library', description: 'Manage master exercises.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M3 14l4 1l.5 -.5"/><path d="M12 18v-3l-3 -2.923l.75 -5.077"/><path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5"/><path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1"/><path d="M18 21l1 -11l2 -1"/></svg>`) },
    { key: 'can_manage_gym_plans', label: 'Memberships', description: 'Manage gym pricing.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2"/></svg>`) },
    { key: 'can_manage_subscriptions', label: 'Subscriptions', description: 'Approve manual payments.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h3"/><path d="M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5"/><path d="M19 21v1m0 -8v1"/></svg>`) },
    { key: 'can_manage_announcements', label: 'Announcements', description: 'Send gym-wide alerts.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/></svg>`) },
    { key: 'can_manage_settings', label: 'Gym Settings', description: 'Manage coupons & UPI.', icon: this.icon(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`) },
  ];

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.toastService.danger('Invalid Trainer ID.');
      this.goBack();
      return;
    }
    this.trainerId.set(id);
    await this.loadData(id);
  }

  async loadData(id: string) {
    this.isLoading.set(true);
    try {
      const data = await this.trainerService.getTrainerAccessData(id);
      this.trainerName.set(data.name);
      this.permissions.set({ ...data.permissions }); // Deep copy to protect cache
      this.hasUnsavedChanges.set(false);
    } catch (error) {
      this.toastService.danger('Failed to load access details.');
      this.goBack();
    } finally {
      this.isLoading.set(false);
    }
  }

  togglePermission(key: keyof TrainerPermissions) {
    const current = this.permissions();
    if (current) {
      this.permissions.set({ ...current, [key]: !current[key] });
      this.hasUnsavedChanges.set(true);
    }
  }

  async saveAccess() {
    const id = this.trainerId();
    const perms = this.permissions();
    if (!id || !perms || !this.hasUnsavedChanges()) return;

    const confirmed = await this.dialogService.open({
      title: 'Update Access',
      message: `Save changes for ${this.trainerName()}?`,
      mode: 'warning',
      confirmText: 'Save',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      this.isSaving.set(true);
      try {
        await this.trainerService.updateTrainerPermissions(id, perms);
        this.toastService.success('Access updated successfully!');
        this.hasUnsavedChanges.set(false);
        this.goBack(); 
      } catch (error) {
        this.toastService.danger('Failed to save permissions.');
      } finally {
        this.isSaving.set(false);
      }
    }
  }

  goBack() {
    this.location.back();
  }
}
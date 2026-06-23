import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserSubscriptionService } from '../../../services/user-subscription-service';
import { StorageService } from '../../../services/storage-service';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service'; // Assumed path for DialogService
import { UserProfile } from '../../../models/user.model';
import { SubscriptionDetail } from '../../../models/user-subscription.model';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterModule, FormsModule],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private subscriptionService = inject(UserSubscriptionService);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private supabaseService = inject(SupabaseService);
  isCooldownActive = signal<boolean>(false);

  userProfile = signal<UserProfile | null>(null);
  subscriptions = signal<SubscriptionDetail[]>([]);
  isLoading = signal<boolean>(true);
  isSyncing = signal<boolean>(false);
  isSubmittingUtr = signal<string | null>(null);

  // Edit Profile Signals
  isEditing = signal<boolean>(false);
  isSavingProfile = signal<boolean>(false);

  // Flat signals for form 
  editFullName = signal<string>('');
  editPhone = signal<string>('');
  editDob = signal<string>('');
  editAddress = signal<string>('');

  // Premium Step-by-Step Date Picker Signals
  showDatePicker = signal<boolean>(false);
  pickerStep = signal<'YEAR' | 'MONTH' | 'DATE'>('YEAR');
  pickerYear = signal<number | null>(null);
  pickerMonth = signal<number | null>(null);
  pickerDate = signal<number | null>(null);
  tempDate = signal<string>('');

  calendarDays = signal<number[]>([]);
  monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  years: number[] = [];

  constructor() {
    // Dynamic year generation: from current year down to 1960
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 1960; i--) {
      this.years.push(i);
    }
  }

  async ngOnInit() {
    this.checkCooldown();
    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
      this.forceLogout();
      return;
    }
    this.userProfile.set(JSON.parse(userRaw));

    const cached = await this.storageService.getItem<SubscriptionDetail[]>('user_subs_cache');

    if (cached && cached.length > 0) {
      const processedCache = this.processSubscriptions(cached);
      this.subscriptions.set(processedCache);
      this.isLoading.set(false);

      const stillActive = processedCache.filter(sub => sub.status === 'ACTIVE');
      if (stillActive.length !== cached.length) {
        if (stillActive.length > 0) {
          await this.storageService.setItem('user_subs_cache', stillActive);
        } else {
          await this.storageService.removeItem('user_subs_cache');
        }
      }
    } else {
      await this.loadSubscriptionsFromAPI();
    }
  }

  async refreshData() {
    // 1. Block if syncing or on cooldown
    if (this.isSyncing() || this.isCooldownActive()) return;
    
    this.isSyncing.set(true);
    
    try {
      await this.supabaseService.refreshUserProfile(); 
      await this.loadSubscriptionsFromAPI();
      
      // 2. SUCCESS: Set expiration to 30 minutes from now
      const expiryTime = Date.now() + (30 * 60 * 1000); 
      localStorage.setItem('sync_cooldown', expiryTime.toString());
      
      // 3. Trigger the UI lock
      this.checkCooldown(); 

    } catch (error) {
      console.error('API Error:', error);
    } finally {
      this.isSyncing.set(false);
    }
  }

  private processSubscriptions(subs: SubscriptionDetail[]): SubscriptionDetail[] {
    const today = new Date().setHours(0, 0, 0, 0);

    return subs.map(sub => {
      if (sub.status === 'ACTIVE' && sub.end_date) {
        const expiryDay = new Date(sub.end_date).setHours(0, 0, 0, 0);
        if (today > expiryDay && this.getProgress(sub.start_date, sub.end_date) === 100) {
          return { ...sub, status: 'EXPIRED' };
        }
      }
      return sub;
    });
  }

  private async loadSubscriptionsFromAPI() {
    const user = this.userProfile();
    if (!user) return;

    this.isLoading.set(true);
    try {
      const data = await this.subscriptionService.getUserSubscriptions(user.id, true);
      const subs = data as SubscriptionDetail[];

      const processedSubs = this.processSubscriptions(subs);
      this.subscriptions.set(processedSubs);

      const activeOnly = processedSubs.filter(sub => sub.status === 'ACTIVE');
      if (activeOnly.length > 0) {
        await this.storageService.setItem('user_subs_cache', activeOnly);
      } else {
        await this.storageService.removeItem('user_subs_cache');
      }
    } catch (error) {
      console.error('API Error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  sanitizeAlphanumeric(event: Event, inputEl: HTMLInputElement) {
    const start = inputEl.selectionStart;
    const originalValue = inputEl.value;
    const sanitized = originalValue.replace(/[^a-zA-Z0-9]/g, '');

    if (originalValue !== sanitized) {
      inputEl.value = sanitized;
      const diff = originalValue.length - sanitized.length;
      const newPos = start ? Math.max(0, start - diff) : 0;
      inputEl.setSelectionRange(newPos, newPos);
    }
  }

  async submitNewUtr(subscriptionId: string, inputElement: HTMLInputElement) {
    const newUtr = inputElement.value.trim();
    const user = this.userProfile();
    if (!newUtr || !user) return;

    this.isSubmittingUtr.set(subscriptionId);
    try {
      await this.subscriptionService.reSubmitRejectedUtr(subscriptionId, newUtr, user.id);
      await new Promise(resolve => setTimeout(resolve, 4000));
      await this.loadSubscriptionsFromAPI();
      this.toastService.success("Transaction details updated!");
    } catch (error) {
      this.toastService.error("Transaction details not updated!");
    } finally {
      this.isSubmittingUtr.set(null);
      inputElement.value = '';
    }
  }

  getDaysRemaining(endDate: string | null): number {
    if (!endDate) return 0;
    const end = new Date(endDate).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    const diff = Math.round((end - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  getProgress(start: string | null, end: string | null): number {
    if (!start || !end) return 0;
    const s = new Date(start).setHours(0, 0, 0, 0);
    const e = new Date(end).setHours(23, 59, 59, 999);
    const n = new Date().getTime();

    if (n < s) return 0;

    const today = new Date().setHours(0, 0, 0, 0);
    const expiryDay = new Date(end).setHours(0, 0, 0, 0);
    if (today >= expiryDay) return 100;

    return Math.round(((n - s) / (e - s)) * 100);
  }

  async forceLogout() {
    localStorage.removeItem('user');
    await this.storageService.clearAll();
    this.router.navigate(['/auth/login']);
  }

  // --- Validation Logic ---

  isValidName(): boolean {
    const name = this.editFullName().trim();
    return /^[a-zA-Z\s]{3,50}$/.test(name);
  }

  isValidPhone(): boolean {
    const phone = this.editPhone().trim();
    return /^[6-9]\d{9}$/.test(phone);
  }

  isValidDob(): boolean {
    return !!this.editDob();
  }

  isValidAddress(): boolean {
    const address = this.editAddress().trim();
    return address.length >= 5;
  }

  // --- Profile Edit Logic ---

  isRecentlyUpdated(): boolean {
    const user = this.userProfile();
    if (!user || !user.updated_at) return false;

    const updatedTime = new Date(user.updated_at).getTime();
    const now = new Date().getTime();
    const diffTime = Math.abs(now - updatedTime);
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    return diffTime <= sevenDaysInMs;
  }

  toggleEdit() {
    const user = this.userProfile();
    if (!user) return;

    this.editFullName.set(user.full_name || '');
    this.editPhone.set(user.phone || '');
    this.editDob.set(user.date_of_birth || '');
    this.editAddress.set(user.address || '');
    this.isEditing.set(true);
  }

  async saveProfile() {
    if (!this.isValidName()) {
      this.toastService.error("Please enter a valid full name (letters only).");
      return;
    }
    if (!this.isValidPhone()) {
      this.toastService.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!this.isValidDob()) {
      this.toastService.error("Please select your Date of Birth.");
      return;
    }
    if (!this.isValidAddress()) {
      this.toastService.error("Please provide a more detailed address.");
      return;
    }

    const user = this.userProfile();
    if (!user) return;

    const currentName = this.editFullName().trim();
    const currentPhone = this.editPhone().trim();
    const currentDob = this.editDob();
    const currentAddress = this.editAddress().trim();

    if (
      currentName === (user.full_name || '') &&
      currentPhone === (user.phone || '') &&
      currentDob === (user.date_of_birth || '') &&
      currentAddress === (user.address || '')
    ) {
      this.isEditing.set(false);
      return;
    }

    // --- Confirmation Dialog Integration ---
    const confirmed = await this.dialogService.open({
      title: 'Update Profile',
      message: `Are you sure you want to save these profile changes?`,
      mode: 'warning',
      confirmText: 'Save',
      cancelText: 'Cancel'
    });

    if (!confirmed) {
      
      this.isEditing.set(false);
      return;
    
    }

    this.isSavingProfile.set(true);
    try {
      const now = new Date();

      const updates = {
        full_name: currentName,
        phone: currentPhone,
        date_of_birth: currentDob,
        address: currentAddress,
        updated_at: now.toISOString()
      };

      const updatedData = await this.subscriptionService.updateProfile(user.id, updates);

      const updatedUser = { ...user, ...updatedData };
      this.userProfile.set(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      this.toastService.success("Profile updated successfully!");
      this.isEditing.set(false);
    } catch (error) {
      this.toastService.error("Failed to update profile.");
      console.error(error);
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  // --- Premium Custom Calendar Logic ---

  openDatePicker() {
    const currentDob = this.editDob();
    if (currentDob) {
      const d = new Date(currentDob);
      this.pickerYear.set(d.getFullYear());
      this.pickerMonth.set(d.getMonth());
      this.pickerDate.set(d.getDate());
      this.pickerStep.set('DATE');
      this.generateCalendar();
    } else {
      this.pickerYear.set(null);
      this.pickerMonth.set(null);
      this.pickerDate.set(null);
      this.pickerStep.set('YEAR');
    }
    this.showDatePicker.set(true);
  }

  selectYear(y: number) {
    this.pickerYear.set(y);
    this.pickerStep.set('MONTH');
  }

  selectMonth(m: number) {
    this.pickerMonth.set(m);
    this.generateCalendar();
    this.pickerStep.set('DATE');
  }

  selectDay(day: number) {
    if (day === 0) return;
    this.pickerDate.set(day);

    const y = this.pickerYear();
    const m = String((this.pickerMonth() ?? 0) + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    this.tempDate.set(`${y}-${m}-${d}`);
  }

  generateCalendar() {
    const year = this.pickerYear() ?? new Date().getFullYear();
    const month = this.pickerMonth() ?? 0;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid: number[] = [];
    for (let i = 0; i < firstDay; i++) grid.push(0);
    for (let i = 1; i <= daysInMonth; i++) grid.push(i);

    this.calendarDays.set(grid);
  }

  confirmDate() {
    if (this.pickerStep() !== 'DATE' || !this.pickerDate()) {
      this.toastService.error("Please complete date selection.");
      return;
    }
    this.editDob.set(this.tempDate());
    this.showDatePicker.set(false);
  }

  private checkCooldown() {
    const expiryTime = parseInt(localStorage.getItem('sync_cooldown') || '0', 10);
    const timeLeft = expiryTime - Date.now();

    if (timeLeft > 0) {
      this.isCooldownActive.set(true);
      // Automatically unlock the button when the time is up
      setTimeout(() => {
        this.isCooldownActive.set(false);
        localStorage.removeItem('sync_cooldown');
      }, timeLeft);
    } else {
      this.isCooldownActive.set(false);
      localStorage.removeItem('sync_cooldown');
    }
  }
}
import { Component, OnInit, inject, signal, computed, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserSubscriptionService } from '../../../../services/user-subscription-service';
import { SubscriptionPayment } from '../../../../models/user-subscription.model';
import { DialogService } from '../../../../services/dialog-service';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../../services/toast-service';
import { environment } from '../../../../../environments/environment';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SupabaseService } from '../../../../services/supabase-service';

@Component({
  selector: 'app-subscription-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription-detail.html',
})
export class SubscriptionDetail implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subService = inject(UserSubscriptionService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);
  role = this.supabaseService.currentUser()?.user_role || 'member';

  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);

  subscription = signal<any>(null);
  payments = signal<SubscriptionPayment[]>([]);

  editStatus = signal<string>('');
  editStartDate = signal<string>('');
  editEndDate = signal<string>('');
  editPausedAt = signal<string>('');
  editPauseReason = signal<string>('');
  invoicePayload = signal<any>(null);

  initialState: any = null;

  originalPrice = computed(() => Number(this.subscription()?.purchased_price) || 0);
  couponDiscount = computed(() => Number(this.subscription()?.coupon_discount) || 0);
  coinsUsed = computed(() => Number(this.subscription()?.coins_used) || 0);
  coinsValue = computed(() => this.coinsUsed() / 2);
  couponCode = computed(() => this.subscription()?.coupon_code || null);
  finalTotalPayable = computed(() => Math.max(0, this.originalPrice() - this.couponDiscount() - this.coinsValue()));

  isFirstPaymentApproved = computed(() => {
    return this.payments().some(p => p.installment_number === 1 && p.status === 'PAID');
  });

  daysPaused = computed(() => {
    const sub = this.subscription();
    if (sub?.status === 'PAUSED' && sub.paused_at) {
      const pauseDate = new Date(sub.paused_at).getTime();
      const now = new Date().getTime();
      return Math.max(0, Math.floor((now - pauseDate) / (1000 * 60 * 60 * 24)));
    }
    return 0;
  });

  projectedNewEndDate = computed(() => {
    const sub = this.subscription();
    if (sub?.status === 'PAUSED' && this.editStatus() === 'ACTIVE' && sub.end_date) {
      const originalEnd = new Date(sub.end_date);
      originalEnd.setDate(originalEnd.getDate() + this.daysPaused());
      return this.getLocalYYYYMMDD(originalEnd);
    }
    return null;
  });

  isFormValid = computed(() => {
    // ADDED: Prevent saving if core dates have been cleared
    if (!this.editStartDate() || this.editStartDate().trim() === '') return false;
    if (!this.editEndDate() || this.editEndDate().trim() === '') return false;

    if (this.editStatus() === 'PAUSED') {
      return this.editPausedAt().trim() !== '' && this.editPauseReason().trim() !== '';
    }
    return true;
  });

  activeModal = signal<'status' | 'start' | 'pause' | 'reason' | null>(null);

  statusOptions = [
    { value: 'PENDING', label: 'PENDING', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-warning', bg: 'bg-warning/10' },
    { value: 'ACTIVE', label: 'ACTIVE', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-success', bg: 'bg-success/10' },
    { value: 'PAUSED', label: 'PAUSED', icon: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-muted', bg: 'bg-muted/10' },
    { value: 'REJECTED', label: 'REJECTED', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-danger', bg: 'bg-danger/10' },
    { value: 'CANCELLED', label: 'CANCELLED', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', color: 'text-danger', bg: 'bg-danger/10' },
    { value: 'EXPIRED', label: 'EXPIRED', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-foreground', bg: 'bg-foreground/10' }
  ];

  currentStatusObj = computed(() => this.statusOptions.find(s => s.value === this.editStatus()) || this.statusOptions[0]);

  viewDate = signal(new Date());
  availableMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  viewYear = computed(() => this.viewDate().getFullYear());
  viewMonthIndex = computed(() => this.viewDate().getMonth());
  viewMonthName = computed(() => this.availableMonths[this.viewMonthIndex()]);

  calendarDays = computed(() => {
    const year = this.viewYear();
    const month = this.viewMonthIndex();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  });

  canGoPrevYear = computed(() => this.activeModal() !== 'start');
  canGoNextYear = computed(() => this.activeModal() !== 'start');

  private getLocalYYYYMMDD(dateValue: any): string {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getISTTimestamp(dateStr: string | null, isEndOfDay: boolean = false): string | null {
    if (!dateStr) return null;
    const timePart = isEndOfDay ? '23:59:59' : '00:00:00';
    return `${dateStr}T${timePart}+05:30`;
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate([`/${this.role}/subscription`]);
      return;
    }
    await this.loadData(id, false);
  }

  async loadData(id: string, forceRefresh = false) {
    if (!forceRefresh) this.isLoading.set(true);
    try {
      const data = await this.subService.getFullSubscriptionData(id, forceRefresh);

      this.subscription.set(data.subscription);
      this.payments.set(data.payments);

      const startStr = this.getLocalYYYYMMDD(data.subscription.start_date);
      const endStr = this.getLocalYYYYMMDD(data.subscription.end_date);
      const pauseStr = this.getLocalYYYYMMDD(data.subscription.paused_at);
      const reasonStr = data.subscription.pause_reason || '';

      this.editStatus.set(data.subscription.status);
      this.editStartDate.set(startStr);
      this.editEndDate.set(endStr);
      this.editPausedAt.set(pauseStr);
      this.editPauseReason.set(reasonStr);

      this.initialState = {
        status: data.subscription.status,
        startDate: startStr,
        endDate: endStr,
        pausedAt: pauseStr,
        pauseReason: reasonStr
      };

    } catch (error) {
      this.toastService.danger('Failed to load details.');
      this.router.navigate([`/${this.role}/subscription`]);
    } finally {
      this.isLoading.set(false);
    }
  }

  getInstallmentBaseValue(payment: SubscriptionPayment): number {
    const actualPaid = Number(payment.amount) || 0;
    if (payment.installment_number === 1) {
      return actualPaid + this.couponDiscount() + this.coinsValue();
    }
    return actualPaid;
  }

  formatDisplayDate(dateString: string): string {
    if (!dateString) return 'Not Set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  prevMonth() { const d = new Date(this.viewDate()); d.setMonth(d.getMonth() - 1); this.viewDate.set(d); }
  nextMonth() { const d = new Date(this.viewDate()); d.setMonth(d.getMonth() + 1); this.viewDate.set(d); }
  prevYear() { if (!this.canGoPrevYear()) return; const d = new Date(this.viewDate()); d.setFullYear(d.getFullYear() - 1); this.viewDate.set(d); }
  nextYear() { if (!this.canGoNextYear()) return; const d = new Date(this.viewDate()); d.setFullYear(d.getFullYear() + 1); this.viewDate.set(d); }

  isDayDisabled(day: number): boolean {
    const activeType = this.activeModal();
    const y = this.viewYear();
    const m = String(this.viewMonthIndex() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    if (activeType === 'start') {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      // --- TEMPORARY DATE LIMIT CHANGE ---
      // Changed from 15 days in the past to 365 days (1 year) for admin use.
      // TO REVERT: Change `today.getDate() - 365` back to `today.getDate() - 15`
      const minDate = new Date(today); minDate.setDate(today.getDate() - 365);
      // -----------------------------------

      const maxDate = new Date(today); maxDate.setDate(today.getDate() + 15);
      const checkDate = new Date(y, this.viewMonthIndex(), day); checkDate.setHours(0, 0, 0, 0);
      return checkDate < minDate || checkDate > maxDate;
    }
    if (activeType === 'pause') {
      const start = this.editStartDate(); const end = this.editEndDate();
      if (!start || !end) return true; return dateStr <= start || dateStr >= end;
    }
    return false;
  }

  isDaySelected(day: number): boolean {
    const y = this.viewYear();
    const m = String(this.viewMonthIndex() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (this.activeModal() === 'start') return this.editStartDate() === dateStr;
    if (this.activeModal() === 'pause') return this.editPausedAt() === dateStr;
    return false;
  }

  openModal(type: 'status' | 'start' | 'pause' | 'reason') {
    if (type === 'pause' || type === 'reason') {
      if (!this.isFirstPaymentApproved() || !this.editStartDate() || !this.editEndDate() || this.editStatus() !== 'PAUSED') return;
    }
    this.activeModal.set(type);
    if (['start', 'pause'].includes(type)) {
      let targetDateStr = '';
      if (type === 'start') targetDateStr = this.editStartDate();
      if (type === 'pause') {
        targetDateStr = this.editPausedAt();
        if (!targetDateStr && this.editStartDate()) {
          const s = new Date(this.editStartDate()); s.setDate(s.getDate() + 1); targetDateStr = this.getLocalYYYYMMDD(s);
        } else if (!targetDateStr) { targetDateStr = this.getLocalYYYYMMDD(new Date()); }
      }
      const d = targetDateStr ? new Date(targetDateStr) : new Date();
      this.viewDate.set(d);
    }
  }

  closeModal() { this.activeModal.set(null); }

  async selectStatus(value: string) {
    const currentDbStatus = this.subscription().status;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (value === 'ACTIVE' || value === 'PAUSED') {
      let checkDateStr = this.editEndDate();
      if (value === 'ACTIVE' && currentDbStatus === 'PAUSED') checkDateStr = this.projectedNewEndDate() || this.editEndDate();
      if (checkDateStr) {
        const checkDate = new Date(checkDateStr); checkDate.setHours(0, 0, 0, 0);
        if (checkDate < today) {
          this.toastService.danger(`Cannot set to ${value}. The expiration date has already passed.`);
          this.closeModal(); return;
        }
      }
    }

    if (value === 'PAUSED' && currentDbStatus !== 'PAUSED') {
      const confirmed = await this.dialogService.open({
        title: `Pause Membership`, message: `Are you sure you want to freeze this account?`, mode: 'warning', confirmText: `Pause Now`, cancelText: 'Cancel'
      });
      if (!confirmed) return;
    }

    if (value === 'ACTIVE' && currentDbStatus === 'PAUSED') {
      const sub = this.subscription(); let displayDate = 'Not Set';
      if (sub.end_date) {
        const dateCalc = new Date(sub.end_date); dateCalc.setDate(dateCalc.getDate() + this.daysPaused());
        displayDate = this.formatDisplayDate(this.getLocalYYYYMMDD(dateCalc));
      }
      const confirmed = await this.dialogService.open({
        title: `Reactivate Membership`, message: `Expiration will be extended to ${displayDate}.`, mode: 'warning', confirmText: `Reactivate`, cancelText: 'Cancel'
      });
      if (!confirmed) return;
    }

    this.editStatus.set(value);
    if (value === 'PAUSED' && !this.editPausedAt() && this.editStartDate()) {
      const s = new Date(this.editStartDate()); s.setDate(s.getDate() + 1);
      this.editPausedAt.set(this.getLocalYYYYMMDD(s));
    }
    this.closeModal();
  }

  selectDay(day: number) {
    if (this.isDayDisabled(day)) return;
    const y = this.viewYear(); const m = String(this.viewMonthIndex() + 1).padStart(2, '0'); const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`; const activeType = this.activeModal();

    if (activeType === 'start') {
      this.editStartDate.set(dateStr);
      const duration = this.subscription().purchased_duration_days;
      const endDate = new Date(y, this.viewMonthIndex(), day); endDate.setDate(endDate.getDate() + duration);
      this.editEndDate.set(this.getLocalYYYYMMDD(endDate));
    } else if (activeType === 'pause') { this.editPausedAt.set(dateStr); }
    this.closeModal();
  }

  clearDate() {
    const activeType = this.activeModal();
    if (activeType === 'start') { this.editStartDate.set(''); this.editEndDate.set(''); }
    if (activeType === 'pause') this.editPausedAt.set('');
    this.closeModal();
  }

  async verifyPayment(payment: SubscriptionPayment) {
    const isFirst = payment.installment_number === 1;

    if (isFirst && !this.editStartDate()) {
      this.toastService.warning('Please set the Activation Date before verifying the receipt.');
      this.openModal('start'); return;
    }

    try {
      this.isSaving.set(true);
      await this.subService.verifyPayment(
        payment.id,
        this.subscription().id,
        isFirst,
        this.subscription().purchased_duration_days,
        this.getISTTimestamp(this.editStartDate(), false) ?? undefined
      );
      this.toastService.success(`Payment Approved!`);
      await this.loadData(this.subscription().id, true);

      const updatedPayment = this.payments().find(p => p.id === payment.id) || payment;
      this.generateAndSendPDF(updatedPayment);

    } catch (error) { this.toastService.danger('Failed to approve payment.'); }
    finally { this.isSaving.set(false); }
  }

  async rejectPayment(payment: SubscriptionPayment) {
    const confirmed = await this.dialogService.open({
      title: 'Reject Payment',
      message: `Are you sure you want to reject Installment 0${payment.installment_number}?`,
      mode: 'delete',
      confirmText: 'Reject',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    this.isSaving.set(true);
    try {
      await this.subService.rejectPayment(payment.id, payment.installment_number, this.subscription().id);
      this.toastService.success('Payment rejected successfully.');
      await this.loadData(this.subscription().id, true);
    } catch (error) {
      this.toastService.danger('Failed to reject payment.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteSubscription() {
    if (this.subscription()?.status !== 'REJECTED') return;

    const confirmed = await this.dialogService.open({
      title: 'Delete Subscription',
      message: 'Are you sure you want to completely delete this subscription? This action permanently removes all associated data and cannot be undone.',
      mode: 'delete',
      confirmText: 'Delete Now',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    this.isSaving.set(true);
    try {
      await this.subService.deleteSubscription(this.subscription().id);
      this.toastService.success('Subscription deleted successfully.');
      this.router.navigate([`/${this.role}/subscription`]);
    } catch (error) {
      this.toastService.danger('Failed to delete subscription.');
    } finally {
      this.isSaving.set(false);
    }
  }

  resendPdf(payment: SubscriptionPayment) {
    this.toastService.success('Resending PDF receipt...');
    this.generateAndSendPDF(payment);
  }

  async saveChanges() {
    if (!this.isFormValid()) {
      this.toastService.danger('Please fill in required fields.');
      return;
    }

    const currentUIState = {
      status: this.editStatus(),
      startDate: this.editStartDate(),
      endDate: this.editEndDate(),
      pausedAt: this.editPausedAt(),
      pauseReason: this.editPauseReason()
    };

    const isUnchanged = JSON.stringify(this.initialState) === JSON.stringify(currentUIState);

    if (isUnchanged) {
      this.toastService.warning('No changes detected to save.');
      return;
    }

    const confirmed = await this.dialogService.open({
      title: 'Subscription change',
      message: 'Are you sure you want to apply these changes to the subscription?',
      mode: 'warning',
      confirmText: 'Update',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    this.isSaving.set(true);
    try {
      let finalEndDate = this.getISTTimestamp(this.editEndDate(), true);
      let finalPausedAt = this.getISTTimestamp(this.editPausedAt(), false);
      let finalReason = this.editPauseReason() || null;

      if (this.subscription().status === 'PAUSED' && this.editStatus() === 'ACTIVE') {
        if (this.projectedNewEndDate()) finalEndDate = this.getISTTimestamp(this.projectedNewEndDate(), true);
        finalPausedAt = null;
        finalReason = null;
      }

      const updates = {
        status: this.editStatus() as any,
        start_date: this.getISTTimestamp(this.editStartDate(), false),
        end_date: finalEndDate,
        paused_at: finalPausedAt,
        pause_reason: finalReason
      };

      await this.subService.updateSubscription(this.subscription().id, updates);
      this.toastService.success('Pass securely updated.');

      await this.loadData(this.subscription().id, true);
    } catch (error) {
      this.toastService.danger('Data synchronization failed.');
    } finally {
      this.isSaving.set(false);
    }
  }

 private async generateAndSendPDF(payment: any) {
  try {
    const sub = this.subscription() || {};
    const allPayments = this.payments() || [];

    // --- 1. CORE LOGIC & BUG FIXES ---
    const isSplit = allPayments.length > 1;
    const isPhase1 = !isSplit || payment?.installment_number === 1;

    const paidToday = Number(payment?.amount) || 0;

    const pastPayments = allPayments.filter((p: any) => p.status === 'PAID' && p.id !== payment?.id);
    let paidPreviously = pastPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

    // If it is the first installment, previous payments MUST be 0.
    if (isPhase1) {
      paidPreviously = 0;
    }

    const totalPaidToDate = paidPreviously + paidToday;

    const origPrice = Number(this.originalPrice ? this.originalPrice() : 0) || 0;
    const finalTotal = Number(this.finalTotalPayable ? this.finalTotalPayable() : 0) || 0;
    const cDiscount = Number(this.couponDiscount ? this.couponDiscount() : 0) || 0;
    const cValue = Number(this.coinsValue ? this.coinsValue() : 0) || 0;
    const cCode = this.couponCode ? this.couponCode() : 'N/A';
    const cUsedText = this.coinsUsed ? this.coinsUsed() : '0';

    let remaining = finalTotal - totalPaidToDate;
    if (remaining < 0) remaining = 0;

    let durationDays = '1 Month';
    if (sub?.purchased_duration_days) {
      durationDays = `${sub.purchased_duration_days} Days`;
    } else if (sub?.start_date && sub?.end_date) {
      const start = new Date(sub.start_date);
      const end = new Date(sub.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      durationDays = `${diffDays} Days`;
    }
    const durationText = durationDays.toUpperCase();

    // --- 2. BRANDING & SAFE METADATA ---
    const gymName = "VJ-FITNESS"; 
    const rawPlanName = sub?.purchased_plan_name || sub?.plan?.name || sub?.plans?.name || 'MEMBERSHIP';
    
    let pName = sub?.profiles?.full_name?.toUpperCase() || 'MEMBER';
    if (pName.length > 22) pName = pName.substring(0, 22) + '...';
    
    let pEmail = sub?.profiles?.email || 'N/A';
    if (pEmail.length > 30) pEmail = pEmail.substring(0, 30) + '...';

    const txnId = payment?.utr_number ? payment.utr_number : `VJ-FIT/24-25/${(payment?.id || '0000').substring(0, 4).toUpperCase()}`;
    const dateStr = payment?.verified_at
      ? new Date(payment.verified_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // --- 3. SVG TO PNG CONVERTER ---
    const svgToPng = async (svgStr: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 96; canvas.height = 96;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, 96, 96);
          resolve(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(url);
        };
        img.onerror = () => reject('SVG Error');
        img.src = url;
      });
    };

    // --- 4. THEME COLORS & PREMIUM ICONS ---
    const c = {
      black: [10, 10, 10] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      lime: [204, 255, 0] as [number, number, number], 
      darkGray: [28, 28, 28] as [number, number, number],
      gray: [115, 115, 115] as [number, number, number],
      lightGray: [245, 245, 245] as [number, number, number],
      red: [220, 38, 38] as [number, number, number],
      green: [34, 197, 94] as [number, number, number]
    };

    const svgs = {
      user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
      crown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#CCFF00"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>`,
      gymLogo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#CCFF00"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43 1.43-1.43z"/></svg>`,
      checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    };

    const pngs = {
      user: await svgToPng(svgs.user),
      crown: await svgToPng(svgs.crown),
      gymLogo: await svgToPng(svgs.gymLogo),
      checkCircle: await svgToPng(svgs.checkCircle)
    };

    // --- 5. PDF INITIALIZATION ---
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    
    // Background Watermark
    doc.setGState(new (doc as any).GState({ opacity: 0.02 }));
    doc.setTextColor(c.black[0], c.black[1], c.black[2]);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    for (let x = -50; x <= 250; x += 90) {
      for (let y = 0; y <= 320; y += 60) {
        doc.text(`VJ FITNESS`, x, y, { angle: 35 });
      }
    }
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

    // --- 6. PREMIUM COMPACT HEADER ---
    doc.setFillColor(c.black[0], c.black[1], c.black[2]);
    doc.rect(0, 0, 210, 42, 'F'); 

    const titleY = 20; 

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.lime[0], c.lime[1], c.lime[2]);
    doc.text('VJ', 15, titleY, { baseline: 'middle' }); // Explicit Middle Center Baseline
    
    const vjWidth = doc.getTextWidth('VJ');
    doc.setTextColor(c.white[0], c.white[1], c.white[2]);
    doc.text('-FITNESS', 15 + vjWidth + 1, titleY, { baseline: 'middle' });

    doc.setTextColor(c.white[0], c.white[1], c.white[2]);
    doc.setFontSize(16);
    doc.text('PAYMENT RECEIPT', 195, titleY, { align: 'right', baseline: 'middle' }); // Mathematically identical vertical center

    // Subtitles
    const subY1 = 30; 
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text('PREMIUM FITNESS FACILITY', 16, subY1, { baseline: 'middle' });

    doc.setFontSize(9);
    doc.text(`Txn ID:`, 145, subY1, { baseline: 'middle' });
    doc.setTextColor(c.lime[0], c.lime[1], c.lime[2]);
    doc.text(`${txnId}`, 195, subY1, { align: 'right', baseline: 'middle' });

    const subY2 = 36;
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text(`Date:`, 145, subY2, { baseline: 'middle' });
    doc.setTextColor(c.white[0], c.white[1], c.white[2]);
    doc.text(`${dateStr}`, 195, subY2, { align: 'right', baseline: 'middle' });

    let currY = 56;

    // --- 7. MEMBER INFO & REFINED PLAN BADGE ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text('BILLED TO', 15, currY);

    doc.setTextColor(c.black[0], c.black[1], c.black[2]);
    doc.setFontSize(16);
    doc.text(pName, 15, currY + 8);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text(pEmail, 15, currY + 14);
    if (sub?.profiles?.phone) doc.text(sub?.profiles?.phone, 15, currY + 20);

    doc.setFillColor(c.black[0], c.black[1], c.black[2]);
    doc.roundedRect(100, currY - 5, 95, 32, 1.5, 1.5, 'F');

    doc.addImage(pngs.crown, 'PNG', 105, currY - 1, 6, 6, 'alias-crown', 'FAST');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text('SUBSCRIPTION TIER', 114, currY + 3);

    doc.setFontSize(10); 
    doc.setTextColor(c.red[0], c.red[1], c.red[2]);
    doc.text(durationText, 190, currY + 3, { align: 'right' });

    doc.setTextColor(c.white[0], c.white[1], c.white[2]);
    doc.setFontSize(14);
    let displayPlanName = rawPlanName;
    if (displayPlanName.length > 20) displayPlanName = displayPlanName.substring(0, 20) + '...';
    doc.text(displayPlanName.toUpperCase(), 105, currY + 12);

    doc.setDrawColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
    doc.line(100, currY + 16, 195, currY + 16);

    const sDate = sub?.start_date ? new Date(sub.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'N/A';
    const eDate = sub?.end_date ? new Date(sub.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'N/A';
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.lime[0], c.lime[1], c.lime[2]); 
    doc.text(`${sDate}  —  ${eDate}`, 105, currY + 23);

    // --- 8. THE INVOICE LEDGER ---
    currY += 45; 

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.black[0], c.black[1], c.black[2]);
    doc.text('PLAN BREAKDOWN', 15, currY);
    
    currY += 6;
    doc.setDrawColor(c.lightGray[0], c.lightGray[1], c.lightGray[2]);
    doc.setLineWidth(0.5);
    doc.line(15, currY, 195, currY);
    currY += 8;

    const addRow = (label: string, amount: number, isSub: boolean = false, isBold: boolean = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isSub ? c.gray[0] : c.black[0], isSub ? c.gray[1] : c.black[1], isSub ? c.gray[2] : c.black[2]);
      doc.setFontSize(isBold ? 11 : 10);
      doc.text(label, 15, currY);
      
      const prefix = isSub ? '-Rs. ' : 'Rs. ';
      doc.text(`${prefix}${amount.toFixed(2)}`, 195, currY, { align: 'right' });
      currY += 9;
    };

    addRow('Original Plan Price', origPrice);
    if (cDiscount > 0) addRow(`Coupon Discount (${cCode})`, cDiscount, true);
    if (cValue > 0) addRow(`Coins Redeemed (${cUsedText})`, cValue, true);

    currY += 2;
    doc.line(15, currY, 195, currY);
    currY += 8;

    addRow('Net Plan Payable', finalTotal, false, true);

    // --- 9. THE PAYMENT STATUS CARD ---
    currY += 10;

    const cardHeight = paidPreviously > 0 ? 42 : 32;
    doc.setFillColor(c.lightGray[0], c.lightGray[1], c.lightGray[2]);
    doc.roundedRect(15, currY, 180, cardHeight, 2, 2, 'F');

    if (remaining === 0) {
      doc.setFillColor(c.lime[0], c.lime[1], c.lime[2]); 
    } else {
      doc.setFillColor(c.red[0], c.red[1], c.red[2]); 
    }
    doc.roundedRect(15, currY, 3, cardHeight, 1, 1, 'F');

    let cardY = currY + 10;

    if (paidPreviously > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
      doc.text('Previously Paid:', 25, cardY);
      doc.setTextColor(c.black[0], c.black[1], c.black[2]);
      doc.text(`Rs. ${paidPreviously.toFixed(2)}`, 190, cardY, { align: 'right' });
      cardY += 10;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.black[0], c.black[1], c.black[2]);
    doc.text('AMOUNT PAID TODAY', 25, cardY);
    
    doc.setFontSize(14);
    doc.text(`Rs. ${paidToday.toFixed(2)}`, 190, cardY, { align: 'right' });
    
    cardY += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text('Remaining Balance:', 25, cardY);
    
    doc.setTextColor(remaining > 0 ? c.red[0] : c.black[0], remaining > 0 ? c.red[1] : c.black[1], remaining > 0 ? c.red[2] : c.black[2]);
    doc.text(`Rs. ${remaining.toFixed(2)}`, 190, cardY, { align: 'right' });

    // --- 10. DYNAMIC STATUS INDICATOR ---
    const statusY = currY + cardHeight + 8;

    if (remaining === 0) {
      const statusMsg = 'Fully Paid';
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(c.green[0], c.green[1], c.green[2]);

      const msgWidth = doc.getTextWidth(statusMsg);
      const rightMargin = 195;
      const textX = rightMargin - msgWidth;
      const iconSize = 5;
      const iconX = textX - iconSize - 2;

      doc.text(statusMsg, textX, statusY + 0.5);
      doc.addImage(pngs.checkCircle, 'PNG', iconX, statusY - 3.5, iconSize, iconSize, 'alias-check', 'FAST');
    }

    // --- 11. PREMIUM FOOTER ---
    const footerY = 250; 

    doc.setFillColor(c.black[0], c.black[1], c.black[2]);
    doc.rect(0, footerY, 210, 47, 'F'); 

    doc.setFillColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
    doc.circle(25, footerY + 20, 11, 'F');
    doc.addImage(pngs.gymLogo, 'PNG', 18, footerY + 13, 14, 14, 'alias-gym', 'FAST');

    doc.setTextColor(c.lime[0], c.lime[1], c.lime[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('THANK YOU', 45, footerY + 16);
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`for choosing ${gymName}.`, 45, footerY + 22);
    doc.text('Stay fit, stay strong!', 45, footerY + 28);

    doc.setDrawColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
    doc.setLineWidth(0.5);
    doc.line(115, footerY + 10, 115, footerY + 32);

    doc.setTextColor(c.white[0], c.white[1], c.white[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPORT & CONTACT', 125, footerY + 16);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text('For any queries, please contact:', 125, footerY + 22);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.lime[0], c.lime[1], c.lime[2]);
    doc.text('+91 9594797973', 125, footerY + 28);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(c.gray[0], c.gray[1], c.gray[2]);
    doc.text('This is a system generated receipt. No physical signature is required.', 105, footerY + 42, { align: 'center' });

    // --- 12. OUTPUT AND SEND ---
    const base64Data = doc.output('datauristring').split(',')[1];

    const finalPayload = {
      txnId: txnId,
      date: dateStr,
      email: sub?.profiles?.email || 'N/A',
      name: sub?.profiles?.full_name || 'Member',
      paidToday: paidToday.toFixed(2),
      pdfBase64: base64Data
    };

    this.sendToCloudflare(finalPayload);

  } catch (error) {
    console.error("🔥 PDF GENERATION ERROR:", error);
    this.toastService.danger("Failed to build PDF. Please try again.");
  }
}

  private sendToCloudflare(payload: any) {
    const WORKER_URL = environment.invoiceApiUrl;
    this.http.post(WORKER_URL, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (res: any) => {
        this.toastService.success("Receipt emailed successfully.");
      },
      error: (err: any) => console.error('Cloudflare Request Failed', err)
    });
  }

  sendWhatsappReminder() {
    const sub = this.subscription();

    if (!sub || !sub.profiles?.phone) {
      this.toastService.warning('Phone number is missing for this user.');
      return;
    }

    // Format phone number to ensure it works with WhatsApp links
    let phone = sub.profiles.phone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    // Use Title Case for a more professional look (e.g., "John Doe" instead of "JOHN DOE")
    const name = sub.profiles.full_name
      ? sub.profiles.full_name.replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
      : 'Valued Member';

    const status = sub.status || 'UNKNOWN';

    // --- TIMEZONE SECURE DATE LOGIC ---
    const getISTMidnight = (dateStr: string | null | undefined | Date): Date | null => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: 'numeric', day: 'numeric'
      }).formatToParts(d);

      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

      return new Date(year, month, day, 0, 0, 0, 0);
    };

    const formatIST = (d: Date | null): string => {
      if (!d) return 'N/A';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const todayIST = getISTMidnight(new Date())!;
    const startDateIST = getISTMidnight(sub.start_date);
    const endDateIST = getISTMidnight(sub.end_date);
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    let message = '';

    switch (status) {
      case 'ACTIVE':
        if (endDateIST) {
          const daysRemaining = Math.round((endDateIST.getTime() - todayIST.getTime()) / MS_PER_DAY);

          if (daysRemaining <= 7 && daysRemaining >= 0) {
            // ACTIVE: EXPIRING SOON
            message = `✨ *Premium Membership Expiring Soon* ✨\n\nDear *${name}*,\n\nWe hope you are enjoying your exclusive fitness journey at VJ-FITNESS. This is a courtesy reminder that your current premium membership is nearing its conclusion in exactly *${daysRemaining} day(s)*.\n\n🔹 *Activation Date:*  ${formatIST(startDateIST)}\n🔸 *Expiration Date:*  ${formatIST(endDateIST)}\n\nTo ensure seamless, uninterrupted access to our state-of-the-art facilities and your ongoing fitness progress, please renew your subscription at your earliest convenience. Let us continue crushing those goals together! 🚀💎`;
          } else if (daysRemaining < 0) {
            // ACTIVE BUT TECHNICALLY EXPIRED
            message = `⚠️ *Action Required: Membership Update* ⚠️\n\nDear *${name}*,\n\nYour profile currently shows an active status; however, our digital records indicate that your subscription validity lapsed *${Math.abs(daysRemaining)} day(s) ago* on *${formatIST(endDateIST)}*.\n\nTo maintain your premium facility access, kindly reach out to our concierge desk to synchronize your records or finalize your renewal. We deeply appreciate your prompt attention to this matter! 🤝🏛️`;
          } else {
            // ACTIVE: STANDARD
            message = `👑 *Premium Membership: Active* 👑\n\nDear *${name}*,\n\nThank you for being a valued member of the VJ-FITNESS family! We are absolutely thrilled to have you with us.\n\nHere is a comprehensive overview of your current membership status:\n\n🔹 *Account Status:*  Active & Unlocked\n🔹 *Valid From:*       ${formatIST(startDateIST)}\n🔸 *Valid Until:*         ${formatIST(endDateIST)}\n⏳ *Days Remaining:* ${daysRemaining} Days\n\nYour account is in excellent standing. Keep pushing your limits, and remember our trainers are always here to support your fitness journey. Stay strong! 💪🌟`;
          }
        } else {
          message = `🌟 *Premium Membership: Active* 🌟\n\nDear *${name}*,\n\nYour VJ-FITNESS membership is currently fully active! However, your precise expiration timeline is not reflecting accurately in our digital records.\n\nPlease take a brief moment on your next visit to connect with our front desk team so we can ensure your profile is perfectly up-to-date. Have a fantastic workout today! 🏋️‍♂️✨`;
        }
        break;

      case 'EXPIRED':
        let overdueDays = 0;
        if (endDateIST) {
          overdueDays = Math.max(0, Math.round((todayIST.getTime() - endDateIST.getTime()) / MS_PER_DAY));
        }
        message = `🛑 *Premium Membership Expired* 🛑\n\nDear *${name}*,\n\nWe miss your energy here at VJ-FITNESS! This is a gentle notification that your premium subscription concluded on *${formatIST(endDateIST)}* and is currently overdue by *${overdueDays} day(s)*.\n\nAt this time, your facility access is temporarily restricted. We would love nothing more than to welcome you back to continue your fitness journey. \n\nPlease complete your renewal process online or at the front desk to instantly restore your premium benefits. We hope to see you back on the floor soon! 🔄🏅`;
        break;

      case 'PAUSED':
        const pausedAtIST = getISTMidnight(sub.paused_at);
        let currentPausedDays = 0;
        let projectedDateText = 'N/A';

        if (pausedAtIST) {
          currentPausedDays = Math.max(0, Math.round((todayIST.getTime() - pausedAtIST.getTime()) / MS_PER_DAY));
        }

        if (endDateIST) {
          const projected = new Date(endDateIST);
          projected.setDate(projected.getDate() + currentPausedDays);
          projectedDateText = formatIST(projected);
        }

        const pauseReason = sub.pause_reason ? `\n📝 *Reason on File:*   ${sub.pause_reason}` : '';

        message = `⏸️ *Membership Successfully Paused* ⏸️\n\nDear *${name}*,\n\nAs per your request, we have successfully placed your VJ-FITNESS membership on a temporary hold.\n\n🔹 *Paused On:*          ${formatIST(pausedAtIST)}\n⏳ *Total Days Frozen:*  ${currentPausedDays} Days${pauseReason}\n\n*Important Note:* Upon reactivation, your membership duration will be extended to compensate for this frozen period. If you were to resume your workouts today, your new adjusted expiration date would be *${projectedDateText}*.\n\nTake all the time you need, and simply drop us a message whenever you are ready to step back into the loop. We will be right here waiting! 🧘‍♂️💎`;
        break;

      case 'REJECTED':
        message = `⛔ *Action Required: Subscription Update* ⛔\n\nDear *${name}*,\n\nWe hope this message finds you well. We are reaching out directly because we noticed an irregularity regarding your recent VJ-FITNESS membership application or payment processing, resulting in a *REJECTED* status.\n\nTo resolve this matter swiftly and ensure you can get back to your workouts without delay, please contact our administration desk at your earliest convenience. We are here to assist you in clearing this up smoothly! 🤝🏢`;
        break;

      case 'PENDING':
        message = `⏳ *Payment Verification Pending* ⏳\n\nDear *${name}*,\n\nThank you for choosing VJ-FITNESS! Your premium membership is currently in the *PENDING* stage as our system securely processes and verifies your payment.\n\nOnce the transaction is successfully confirmed, your account will be instantly upgraded, and your exact activation dates will be assigned to your profile. \n\nIf your bank transfer is already completed, please feel free to share the transaction receipt with us here. Get ready to transform! 🚀💳`;
        break;

      case 'CANCELLED':
        message = `🚫 *Membership Cancellation Confirmed* 🚫\n\nDear *${name}*,\n\nThis message serves as official confirmation that your VJ-FITNESS subscription has been successfully cancelled.\n\nWe are genuinely sad to see you go. If you ever wish to restart your fitness journey in the future, our doors are always open, and we would be absolutely thrilled to welcome you back into our community. \n\nWishing you the absolute best in your ongoing health and wellness! 🌟🙌`;
        break;

      default:
        message = `🔔 *Premium Account Notification* 🔔\n\nDear *${name}*,\n\nPlease contact the VJ-FITNESS concierge desk regarding an update to your account status (${status}). We look forward to assisting you! ✨`;
        break;
    }

    const encodedMessage = encodeURIComponent(message);
    const deepLink = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
    window.location.href = deepLink;

    this.toastService.success('Opening WhatsApp securely...');
  }
}
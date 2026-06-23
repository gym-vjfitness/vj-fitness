import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as echarts from 'echarts';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ToastService } from '../../../services/toast-service';
import { TrainerOpsService } from '../../../services/trainer-ops-service';
import {
  TrainerAttendanceStatus,
  TrainerMini,
  TrainerPaymentMode,
} from '../../../models/trainer-ops.model';

type PickerType = 'month' | 'mode' | null;

@Component({
  selector: 'app-trainer-ops',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './trainer-ops.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerOps implements OnInit {
  ops = inject(TrainerOpsService);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  attendanceStatuses: (TrainerAttendanceStatus | 'all')[] = ['pending', 'approved', 'rejected', 'all'];
  paymentModes: TrainerPaymentMode[] = ['cash', 'upi', 'bank', 'cheque', 'other'];

  attendanceSearch = signal<string>('');
  attendanceResults = signal<TrainerMini[]>([]);
  attendanceSearchPerformed = signal<boolean>(false);
  paymentSearch = signal<string>('');
  paymentResults = signal<TrainerMini[]>([]);
  paymentSearchPerformed = signal<boolean>(false);
  
  isSavingPayment = signal<boolean>(false);
  activePicker = signal<PickerType>(null);

  chartOptions = signal<EChartsOption>({});
  isChartReady = signal<boolean>(false);

  attendanceTotalPages = computed(() => Math.max(1, Math.ceil(this.ops.adminAttendanceTotal() / this.ops.adminAttendancePageSize())));
  attendanceStart = computed(() => this.ops.adminAttendanceTotal() === 0 ? 0 : (this.ops.adminAttendancePage() - 1) * this.ops.adminAttendancePageSize() + 1);
  attendanceEnd = computed(() => Math.min(this.ops.adminAttendancePage() * this.ops.adminAttendancePageSize(), this.ops.adminAttendanceTotal()));

  paymentTotalPages = computed(() => Math.max(1, Math.ceil(this.ops.adminPaymentsTotal() / this.ops.adminPaymentsPageSize())));
  paymentStart = computed(() => this.ops.adminPaymentsTotal() === 0 ? 0 : (this.ops.adminPaymentsPage() - 1) * this.ops.adminPaymentsPageSize() + 1);
  paymentEnd = computed(() => Math.min(this.ops.adminPaymentsPage() * this.ops.adminPaymentsPageSize(), this.ops.adminPaymentsTotal()));

  async ngOnInit() {
    // Ensures we don't fetch if coming back and cache exists
    if (!this.ops.adminAttendanceLoaded()) {
      await this.loadAttendance();
    }
  }

  async setTab(tab: 'attendance' | 'payments') {
    if (this.ops.adminActiveTab() === tab) return; 
    this.ops.adminActiveTab.set(tab);
    
    if (tab === 'attendance' && !this.ops.adminAttendanceLoaded()) await this.loadAttendance();
    if (tab === 'payments' && !this.ops.adminPaymentsLoaded()) await this.loadPayments();
  }

  async loadAttendance(force = false) {
    try { await this.ops.fetchAdminAttendance(force); } 
    catch (error) { this.toastService.danger('Failed to load trainer attendance.'); }
  }

  async loadPayments(force = false) {
    try { 
      await this.ops.fetchAdminPayments(force); 
      this.buildChart(); 
    } catch (error) { this.toastService.danger('Failed to load trainer payments.'); }
  }

  async setAttendanceStatus(status: TrainerAttendanceStatus | 'all') {
    if (this.ops.adminAttendanceStatus() === status) return;
    this.ops.adminAttendanceStatus.set(status);
    this.ops.adminAttendancePage.set(1);
    await this.loadAttendance(); 
  }

  async searchAttendanceTrainer() {
    const term = this.attendanceSearch().trim();
    if (!term) {
      this.attendanceResults.set([]);
      this.attendanceSearchPerformed.set(false);
      return;
    }
    try {
      this.attendanceResults.set(await this.ops.searchTrainers(term));
      this.attendanceSearchPerformed.set(true);
    } 
    catch {
      this.toastService.warning('Trainer search failed.');
      this.attendanceSearchPerformed.set(false);
    }
  }

  clearAttendanceSearch() {
    this.attendanceSearch.set('');
    this.attendanceResults.set([]);
    this.attendanceSearchPerformed.set(false);
  }

  async searchPaymentTrainer() {
    const term = this.paymentSearch().trim();
    if (!term) {
      this.paymentResults.set([]);
      this.paymentSearchPerformed.set(false);
      return;
    }
    try {
      this.paymentResults.set(await this.ops.searchTrainers(term));
      this.paymentSearchPerformed.set(true);
    } 
    catch {
      this.toastService.warning('Trainer search failed.');
      this.paymentSearchPerformed.set(false);
    }
  }

  clearPaymentSearch() {
    this.paymentSearch.set('');
    this.paymentResults.set([]);
    this.paymentSearchPerformed.set(false);
  }

  async selectAttendanceTrainer(trainer: TrainerMini) {
    this.ops.adminAttendanceTrainerId.set(trainer.id);
    this.ops.adminAttendanceTrainerName.set(trainer.full_name || 'Unnamed Trainer');
    this.ops.adminAttendancePage.set(1);
    this.clearAttendanceSearch();
    await this.loadAttendance(true); // force load when changing trainer
  }

  async clearAttendanceTrainer() {
    this.ops.resetAdminAttendanceTrainer();
    await this.loadAttendance(true);
  }

  selectPaymentTrainer(trainer: TrainerMini) {
    this.ops.selectedPaymentTrainer.set(trainer);
    this.clearPaymentSearch();
  }

  async applyPaymentTrainerFilter(trainer: TrainerMini) {
    this.ops.adminPaymentsTrainerId.set(trainer.id);
    this.ops.adminPaymentsTrainerName.set(trainer.full_name || 'Unnamed Trainer');
    this.ops.adminPaymentsPage.set(1);
    this.selectPaymentTrainer(trainer);
    await this.loadPayments(true);
  }

  async clearPaymentTrainerFilter() {
    this.ops.resetAdminPaymentTrainer();
  }

  openPicker(picker: PickerType) { this.activePicker.set(picker); }
  closePicker() { this.activePicker.set(null); }

  selectMonth(m: string) { this.ops.paymentSalaryMonth.set(m); this.closePicker(); }
  selectMode(m: TrainerPaymentMode) { this.ops.paymentMode.set(m); this.closePicker(); }

  async reviewAttendance(id: string, status: 'approved' | 'rejected') {
    try {
      await this.ops.updateAttendanceStatus(id, status);
      this.toastService.success(status === 'approved' ? 'Attendance approved.' : 'Attendance rejected.');
    } catch (error) {
      this.toastService.danger('Could not update attendance.');
    }
  }

  async savePayment() {
    const trainer = this.ops.selectedPaymentTrainer();
    const amount = Number(this.ops.paymentAmount());
    if (!trainer) return this.toastService.warning('Select a trainer first.');
    if (!amount || amount <= 0) return this.toastService.warning('Enter a valid amount.');

    const targetMonthDate = `${this.ops.paymentSalaryMonth()}-01`;
    
    // Duplicate validation logic
    const alreadyPaid = this.ops.adminPayments().find(p => p.salary_month === targetMonthDate);
    if (alreadyPaid) {
      this.toastService.danger(`A payment for ${this.ops.paymentSalaryMonth()} has already been processed.`);
      return;
    }

    this.isSavingPayment.set(true);
    try {
      await this.ops.createPayment({
        trainer_profile_id: trainer.id,
        salary_month: targetMonthDate,
        amount,
        payment_date: this.ops.todayStringIst, 
        payment_mode: this.ops.paymentMode(),
        
      });

      this.ops.paymentAmount.set(null);
      this.toastService.success('Trainer payment saved.');
      this.buildChart();
    } catch (error) {
      this.toastService.danger('Could not save trainer payment.');
    } finally {
      this.isSavingPayment.set(false);
    }
  }

  async attendanceNext() { if (this.ops.adminAttendancePage() < this.attendanceTotalPages()) { this.ops.adminAttendancePage.update((p: number) => p + 1); await this.loadAttendance(); } }
  async attendancePrev() { if (this.ops.adminAttendancePage() > 1) { this.ops.adminAttendancePage.update((p: number) => p - 1); await this.loadAttendance(); } }
  async paymentsNext() { if (this.ops.adminPaymentsPage() < this.paymentTotalPages()) { this.ops.adminPaymentsPage.update((p: number) => p + 1); await this.loadPayments(); } }
  async paymentsPrev() { if (this.ops.adminPaymentsPage() > 1) { this.ops.adminPaymentsPage.update((p: number) => p - 1); await this.loadPayments(); } }

  formatIndianPricing(val: number | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val || 0));
  }

  trainerName(row: { profiles?: { full_name: string | null } | null }): string {
    return row.profiles?.full_name || 'Unnamed Trainer';
  }

  // BUG FIX: Cleaned up breakMinutes logic
  durationLabel(start: string, end: string): string {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const minutes = Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}H ${m}M`;
  }

  statusClass(status: string): string {
    if (status === 'approved' || status === 'completed') return 'bg-success/10 text-success border-success/30';
    if (status === 'pending') return 'bg-warning/10 text-warning border-warning/30';
    return 'bg-danger/10 text-danger border-danger/30';
  }

  private buildChart() {
    const snapshot = this.ops.adminPaymentSnapshot();
    const history = snapshot?.last_five_months || [];
    if (!isPlatformBrowser(this.platformId) || history.length === 0) {
      this.isChartReady.set(true);
      this.chartOptions.set({});
      return;
    }

    const dark = document.documentElement.classList.contains('dark');
    const color = {
      primary: dark ? '#60a5fa' : '#3b82f6',
      surface: dark ? '#f8fafc' :  '#0f172a',
      foreground: dark ? '#f8fafc' : '#0f172a',
      muted: dark ? '#64748b' : '#94a3b8',
    };

    this.chartOptions.set({
      color: [color.primary],
      tooltip: {
        trigger: 'axis',
        backgroundColor: color.surface,
        borderColor: color.muted,
        borderRadius: 8,
        textStyle: { color: color.primary, fontFamily: 'inherit', fontWeight: 800, fontSize: '6px' },
        formatter: (params: any) => ` <div style="font-size:9px;font-weight:800">
    ${params[0].name}<br/>
    ${this.formatIndianPricing(params[0].value)}
  </div>`,
      },
      grid: { left: '2%', right: '2%', top: '10%', bottom: '0%', containLabel: true },
      xAxis: {
        type: 'category',
        data: history.map((item: any) => item.month),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: color.muted, fontSize: 8, fontWeight: 800, margin: 12 },
      },
      yAxis: {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: color.muted, fontSize: 8, fontWeight: 800, formatter: (value: number) => `₹${value / 1000}k` },
      },
      series: [{
        type: 'bar',
        data: history.map((item: any) => item.total),
        barMaxWidth: 26,
        itemStyle: { borderRadius: [8, 8, 2, 2], shadowColor: color.primary, shadowBlur: 10 },
      }],
    });
    this.isChartReady.set(true);
  }
}
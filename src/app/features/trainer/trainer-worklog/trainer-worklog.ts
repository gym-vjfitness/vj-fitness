import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import * as echarts from 'echarts';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ToastService } from '../../../services/toast-service';
import { TrainerOpsService } from '../../../services/trainer-ops-service';

type TimePickerTarget = 'start' | 'end' | null;
type ClockMode = 'hour' | 'minute';
type AmPm = 'AM' | 'PM';

@Component({
  selector: 'app-trainer-worklog',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './trainer-worklog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerWorklog implements OnInit {
  ops = inject(TrainerOpsService);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  // --- Strict Date Options ---
  readonly allowedDates = [0, 1, 2].map(daysAgo => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return {
      id: d.toLocaleDateString('en-CA'),
      label: daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? 'YESTERDAY' : d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' }).toUpperCase()
    };
  });

  // --- Form State ---
  attendanceDate = signal<string>(this.allowedDates[0].id);
  startTime = signal<string>('09:00'); 
  endTime = signal<string>('18:00');   

  isSubmitting = signal<boolean>(false);

  // --- Clock UI State ---
  activePicker = signal<TimePickerTarget>(null);
  pickerMode = signal<ClockMode>('hour');
  pickerHour = signal<number>(9);
  pickerMinute = signal<number>(0);
  pickerAmPm = signal<AmPm>('AM');

  hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  minutes60 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // --- Computed Validation ---
  shiftStatus = computed(() => {
    const startMins = this.toMinutes(this.startTime());
    const endMins = this.toMinutes(this.endTime());

    if (endMins <= startMins) {
      return { valid: false, error: 'End time must be after Start time.', netString: '0H 0M' };
    }

    const net = endMins - startMins;
    const h = Math.floor(net / 60);
    const m = net % 60;
    return { valid: true, error: null, netString: `${h}H ${m}M` };
  });

  // --- Pagination & Charts ---
  chartOptions = signal<EChartsOption>({});
  isChartReady = signal<boolean>(false);

  attendanceTotalPages = computed(() => Math.max(1, Math.ceil(this.ops.trainerAttendanceTotal() / this.ops.trainerAttendancePageSize())));
  attendanceStart = computed(() => this.ops.trainerAttendanceTotal() === 0 ? 0 : (this.ops.trainerAttendancePage() - 1) * this.ops.trainerAttendancePageSize() + 1);
  attendanceEnd = computed(() => Math.min(this.ops.trainerAttendancePage() * this.ops.trainerAttendancePageSize(), this.ops.trainerAttendanceTotal()));

  paymentTotalPages = computed(() => Math.max(1, Math.ceil(this.ops.trainerPaymentsTotal() / this.ops.trainerPaymentsPageSize())));
  paymentStart = computed(() => this.ops.trainerPaymentsTotal() === 0 ? 0 : (this.ops.trainerPaymentsPage() - 1) * this.ops.trainerPaymentsPageSize() + 1);
  paymentEnd = computed(() => Math.min(this.ops.trainerPaymentsPage() * this.ops.trainerPaymentsPageSize(), this.ops.trainerPaymentsTotal()));

  async ngOnInit() {
    await this.loadAttendance();
  }

  async setTab(tab: 'submit' | 'attendance' | 'payments') {
    this.ops.trainerActiveTab.set(tab);
    if (tab === 'attendance' && !this.ops.trainerAttendanceLoaded()) await this.loadAttendance();
    if (tab === 'payments' && !this.ops.trainerPaymentsLoaded()) await this.loadPayments();
  }

  // --- Clock UI Methods ---
  openClock(target: TimePickerTarget) {
    const current24 = target === 'start' ? this.startTime() : this.endTime();
    let [h, m] = current24.split(':').map(Number);
    
    this.pickerAmPm.set(h >= 12 ? 'PM' : 'AM');
    h = h % 12 || 12;

    this.pickerHour.set(h);
    this.pickerMinute.set(Math.round(m / 5) * 5 % 60);
    this.pickerMode.set('hour');
    this.activePicker.set(target);
  }

  closeClock() { this.activePicker.set(null); }

  setClockHour(h: number) {
    this.pickerHour.set(h);
    this.pickerMode.set('minute');
  }

  setClockMinute(m: number) { this.pickerMinute.set(m); }

  confirmTime() {
    let h = this.pickerHour();
    const m = this.pickerMinute();
    const ampm = this.pickerAmPm();

    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    if (this.activePicker() === 'start') {
      this.startTime.set(timeString);
    } else if (this.activePicker() === 'end') {
      this.endTime.set(timeString);
    }
    this.closeClock();
  }

  async submitAttendance() {
    const status = this.shiftStatus();
    if (!status.valid) {
      this.toastService.warning(status.error || 'Invalid shift timings.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.ops.submitTrainerAttendance({
        attendance_date: this.attendanceDate(),
        start_time: this.startTime(),
        end_time: this.endTime(),
        
      });
      this.toastService.success('Shift submitted.');
      this.ops.trainerActiveTab.set('attendance');
      await this.loadAttendance(true);
    } catch (error: any) {
      this.toastService.danger(error?.message || 'Failed to submit shift.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async loadAttendance(force = false) { try { await this.ops.fetchTrainerAttendance(force); } catch (e) {} }
  async loadPayments(force = false) { try { await this.ops.fetchTrainerPayments(force); this.buildChart(); } catch (e) {} }
  
  // BUG FIX: Strictly typing (p: number) to eliminate TS7006 implicit 'any' error
  async attendanceNext() { 
    if (this.ops.trainerAttendancePage() < this.attendanceTotalPages()) { 
      this.ops.trainerAttendancePage.update((p: number) => p + 1); 
      this.ops.trainerAttendanceLoaded.set(false); 
      await this.loadAttendance(true); 
    } 
  }
  
  async attendancePrev() { 
    if (this.ops.trainerAttendancePage() > 1) { 
      this.ops.trainerAttendancePage.update((p: number) => p - 1); 
      this.ops.trainerAttendanceLoaded.set(false); 
      await this.loadAttendance(true); 
    } 
  }
  
  async paymentNext() { 
    if (this.ops.trainerPaymentsPage() < this.paymentTotalPages()) { 
      this.ops.trainerPaymentsPage.update((p: number) => p + 1); 
      this.ops.trainerPaymentsLoaded.set(false); 
      await this.loadPayments(true); 
    } 
  }
  
  async paymentPrev() { 
    if (this.ops.trainerPaymentsPage() > 1) { 
      this.ops.trainerPaymentsPage.update((p: number) => p - 1); 
      this.ops.trainerPaymentsLoaded.set(false); 
      await this.loadPayments(true); 
    } 
  }

  format12Hour(time24: string): string {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = Number(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  }

  private toMinutes(time24: string): number {
    if (!time24) return 0;
    const [h, m] = time24.split(':').map(Number);
    return h * 60 + m;
  }

  durationLabel(start: string, end: string): string {
    const startMins = this.toMinutes(start);
    const endMins = this.toMinutes(end);
    const net = Math.max(0, endMins - startMins);
    const h = Math.floor(net / 60);
    const m = net % 60;
    return `${h}H ${m}M`;
  }

  statusClass(status: string): string {
    if (!status) return 'bg-surface border-border/30';
    if (status === 'approved' || status === 'completed') return 'bg-success/10 text-success border-success/30';
    if (status === 'pending') return 'bg-warning/10 text-warning border-warning/30';
    if (status === 'rejected') return 'bg-danger/10 text-danger border-danger/30';
    return 'bg-danger/10 text-danger border-danger/30';
  }

  formatIndianPricing(val: number | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val || 0));
  }

  private buildChart() {
    const history = this.ops.trainerPaymentSnapshot()?.last_five_months || [];
    if (!isPlatformBrowser(this.platformId) || history.length === 0) {
      this.isChartReady.set(true);
      this.chartOptions.set({});
      return;
    }

    const dark = document.documentElement.classList.contains('dark');
    const color = {
      primary: dark ? '#60a5fa' : '#3b82f6',
      surface: dark ? '#0f172a' : '#f8fafc',
      foreground: dark ? '#f8fafc' : '#0f172a',
      muted: dark ? '#64748b' : '#94a3b8',
    };

    this.chartOptions.set({
      color: [color.primary],
      tooltip: {
        trigger: 'axis',
        backgroundColor: color.surface,
        borderColor: color.primary,
        borderRadius: 8,
        textStyle: { color: color.foreground, fontWeight: 800, fontSize: 10 },
        formatter: (params: any) => {
          const item = params[0];
          return `${item.name}<br/>${this.formatIndianPricing(item.value)}`;
        },
      },
      grid: { left: '2%', right: '2%', top: '10%', bottom: '0%', containLabel: true },
      xAxis: {
        type: 'category',
        data: history.map((item: any) => item.month), // Explicit any
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: color.muted, fontSize: 8, fontWeight: 800, margin: 12 }, 
      },
      yAxis: {
        type: 'value',
        splitLine: { show: false }, 
        axisLabel: { color: color.muted, fontSize: 8, fontWeight: 800, formatter: (value: number) => `₹${value / 1000}k` },
      },
      series: [
        {
          type: 'line',
          smooth: 0.4,
          data: history.map((item: any) => item.total), // Explicit any
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, cap: 'round', shadowColor: color.primary, shadowBlur: 10 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: color.primary },
              { offset: 1, color: 'transparent' },
            ]),
            opacity: 0.3
          },
        },
      ],
    });
    this.isChartReady.set(true);
  }
}
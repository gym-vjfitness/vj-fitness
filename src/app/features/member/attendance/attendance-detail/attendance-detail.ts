import { Component, inject, effect, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { SupabaseService } from '../../../../services/supabase-service';
import { AttendanceRecord } from '../../../../models/attendance.dto';
import { AttendanceTrackingService } from '../../../../services/attendance-tracking-service';
import { StorageService } from '../../../../services/storage-service';

interface DayStatus { date: string; dayName: string; isPresent: boolean; isToday: boolean; isFuture: boolean; isLastActive: boolean; }

@Component({
  selector: 'app-attendance-detail',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  providers: [DatePipe],
  templateUrl: './attendance-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './attendance-detail.scss',
})
export class AttendanceDetail implements OnInit, OnDestroy {
  private supabaseService = inject(SupabaseService);
  private attendanceTracker = inject(AttendanceTrackingService);
  private storageService = inject(StorageService);
  private datePipe = inject(DatePipe);

  attendanceRecords = signal<AttendanceRecord[]>([]);
  isLoading = signal<boolean>(true);
  themeToggleTrigger = signal<number>(0);

  currentPage = signal<number>(1);
  itemsPerPage = 10;

  private themeObserver!: MutationObserver;

  totalStreakCount = computed<number>(() => this.calculateStreak(this.attendanceRecords()));
  weeklyStreak = computed<DayStatus[]>(() => this.calculateWeeklyTracker(this.attendanceRecords()));
  thirtyDayProgress = computed(() => this.calculate30DayProgress(this.attendanceRecords()));

  // NEW: Premium Insights Computed Signal
  premiumStats = computed(() => this.calculatePremiumInsights(this.attendanceRecords()));

  paginatedRecords = computed<AttendanceRecord[]>(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.attendanceRecords().slice(start, start + this.itemsPerPage);
  });

  totalItems = computed<number>(() => this.attendanceRecords().length);
  totalPages = computed<number>(() => Math.max(1, Math.ceil(this.totalItems() / this.itemsPerPage)));

  paginatedStart = computed<number>(() => this.totalItems() === 0 ? 0 : ((this.currentPage() - 1) * this.itemsPerPage) + 1);
  paginatedEnd = computed<number>(() => Math.min(this.currentPage() * this.itemsPerPage, this.totalItems()));

  chartOption = computed<EChartsOption>(() => {
    this.themeToggleTrigger();
    return this.generateGlowingWeeklyChart(this.attendanceRecords());
  });

  constructor() {
    effect(() => {
      if (this.supabaseService.currentUser()?.id) {
        this.loadAndSyncData();
      }
    });
  }

  ngOnInit() {
    if (typeof document !== 'undefined') {
      this.themeObserver = new MutationObserver(() => this.themeToggleTrigger.update(v => v + 1));
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  ngOnDestroy() {
    if (this.themeObserver) this.themeObserver.disconnect();
  }

  private getISTDateString(date: Date): string {
    const dateInIST = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dateInIST.getFullYear()}-${pad(dateInIST.getMonth() + 1)}-${pad(dateInIST.getDate())}`;
  }

  async loadAndSyncData() {
    this.isLoading.set(true);
    const profileId = this.supabaseService.currentUser()?.id;
    if (!profileId) return;

    const cacheKey = `attendance_30d_${profileId}`;
    const syncKey = `history_synced_30d_${profileId}`;

    const now = new Date();
    const todayStr = this.getISTDateString(now);

    const thirtyDaysAgoObj = new Date(now);
    thirtyDaysAgoObj.setDate(thirtyDaysAgoObj.getDate() - 30);
    const limitDateStr = this.getISTDateString(thirtyDaysAgoObj);

    let localData: AttendanceRecord[] = await this.storageService.getItem(cacheKey) || [];

    localData.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
    localData = localData.filter(r => r.attendance_date >= limitDateStr);

    if (localData.length > 0) {
      this.attendanceRecords.set(localData);
      this.isLoading.set(false);
    }

    let shouldFetch = false;
    let fetchSince = limitDateStr;

    const hasSyncedHistory = await this.storageService.getItem(syncKey);

    if (!hasSyncedHistory || localData.length === 0) {
      shouldFetch = true;
      fetchSince = limitDateStr;
    } else {
      const newestRecord = localData[0];
      const newestDateStr = newestRecord.attendance_date;

      if (newestDateStr < todayStr || !newestRecord.check_out_time) {
        shouldFetch = true;
        fetchSince = newestDateStr;
      }
    }

    if (shouldFetch) {
      try {
        const apiData = await this.attendanceTracker.getAttendanceHistory(profileId, fetchSince, todayStr);

        const map = new Map<string, AttendanceRecord>();
        localData.forEach(item => map.set(item.id, item));

        apiData.forEach(item => {
          item.check_in_time = item.check_in_time.substring(0, 19) + 'Z';
          item.check_out_time = item.check_out_time ? item.check_out_time.substring(0, 19) + 'Z' : null;
          map.set(item.id, item);
        });

        let finalData = Array.from(map.values());
        finalData = finalData.filter(r => r.attendance_date >= limitDateStr);
        finalData.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());

        this.attendanceRecords.set(finalData);
        await this.storageService.setItem(cacheKey, finalData);

        if (!hasSyncedHistory) {
          await this.storageService.setItem(syncKey, true);
        }
      } catch (err) {
        console.error("Data sync failed:", err);
      }
    }
    this.isLoading.set(false);
  }

  nextPage() { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }
  prevPage() { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }

  private calculateStreak(records: AttendanceRecord[]): number {
    if (!records.length) return 0;

    const uniqueDates = [...new Set(records.map(r => r.attendance_date.split('T')[0]))].sort((a, b) => b.localeCompare(a));
    const todayStr = this.getISTDateString(new Date());
    const yesterdayStr = this.getISTDateString(new Date(Date.now() - 86400000));

    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) return 0;

    // FIX: Get the exact date of THIS week's Monday to act as a barrier
    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dayOfWeek = todayIST.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const currentWeekMonday = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate() + distanceToMonday);
    currentWeekMonday.setHours(0, 0, 0, 0);

    let streak = 0;
    let expectedDate = new Date(uniqueDates[0]);
    expectedDate.setHours(0, 0, 0, 0);

    for (const dateStr of uniqueDates) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const recordDate = new Date(y, m - 1, d);
      recordDate.setHours(0, 0, 0, 0);

      // FIX: If the record date goes earlier than this week's Monday, STOP counting.
      if (recordDate.getTime() < currentWeekMonday.getTime()) {
        break;
      }

      if (recordDate.getTime() === expectedDate.getTime()) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else break;
    }

    return streak;
  }

  private calculateWeeklyTracker(records: AttendanceRecord[]): DayStatus[] {
    const today = new Date();
    const todayISTStr = this.getISTDateString(today);

    const dayOfWeek = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const week: DayStatus[] = [];
    const presentDates = new Set(records.map(r => r.attendance_date.split('T')[0]));

    const sortedPresent = Array.from(presentDates).sort((a, b) => b.localeCompare(a));
    const lastActiveDate = sortedPresent.length > 0 ? sortedPresent[0] : null;

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateString = this.getISTDateString(date);
      const isPresent = presentDates.has(dateString);

      week.push({
        date: dateString,
        dayName: this.datePipe.transform(date, 'EE')?.charAt(0) || '',
        isPresent: isPresent,
        isToday: dateString === todayISTStr,
        isFuture: dateString > todayISTStr,
        isLastActive: isPresent && dateString === lastActiveDate
      });
    }
    return week;
  }

  private calculate30DayProgress(records: AttendanceRecord[]) {
    const uniqueDates = new Set(records.map(r => r.attendance_date.split('T')[0]));
    const presentDays = uniqueDates.size;
    const percentage = Math.round((presentDays / 30) * 100) || 0;

    const segments = Array.from({ length: 30 }, (_, i) => i < presentDays);

    return { presentDays, totalDays: 30, percentage, segments };
  }

  // NEW: Calculates premium data purely based on the local 30-day history
  // ENHANCED & BULLETPROOF PREMIUM INSIGHTS
  private calculatePremiumInsights(records: AttendanceRecord[]) {
    // 1. Edge Case Fix: Ensure we only process records with valid checkouts
    const validRecords = records.filter(r => r.check_out_time);
    
    // 2. Edge Case Fix: Prevent Division by Zero & NaN errors for brand new users
    if (validRecords.length === 0) return null;

    let totalMins = 0;
    let morning = 0, afternoon = 0, evening = 0;
    let maxSessionMins = 0;
    const dayCounts: Record<string, number> = {};

    validRecords.forEach(r => {
      // Aggregate duration (Edge Case Fix: Math.max ensures we never get negative time)
      const mins = Math.max(0, this.getMins(r.check_in_time, r.check_out_time!));
      totalMins += mins;

      // Track longest session
      if (mins > maxSessionMins) {
        maxSessionMins = mins;
      }

      // Aggregate favorite day
      const dateObj = new Date(r.attendance_date);
      const dayStr = this.datePipe.transform(dateObj, 'EEEE') || 'Unknown';
      dayCounts[dayStr] = (dayCounts[dayStr] || 0) + 1;

      // Aggregate Time of day
      const hour = new Date(r.check_in_time).getHours();
      if (hour >= 5 && hour < 12) morning++;
      else if (hour >= 12 && hour < 17) afternoon++;
      else evening++;
    });

    const avgMins = Math.round(totalMins / validRecords.length);
    const favoriteDay = Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b);
    
    let persona = 'Night Owl 🌙';
    const maxTime = Math.max(morning, afternoon, evening);
    if (maxTime === morning) persona = 'Morning Warrior ☀️';
    else if (maxTime === afternoon) persona = 'Afternoon Hustler ⚡';

    // Calculate New Metrics
    const uniqueDaysAttended = new Set(validRecords.map(r => r.attendance_date.split('T')[0])).size;
    const consistencyScore = Math.round((uniqueDaysAttended / 30) * 100);
    const weeklyAverage = (uniqueDaysAttended / 4.28).toFixed(1); // 30 days = ~4.28 weeks
    const restDays = 30 - uniqueDaysAttended; // NEW: Recovery Tracking
    const longestSessionDisplay = maxSessionMins >= 60 
      ? `${Math.floor(maxSessionMins / 60)}h ${maxSessionMins % 60}m` 
      : `${maxSessionMins}m`;

    return { 
      totalHours: (totalMins / 60).toFixed(1), 
      avgSession: avgMins, 
      favoriteDay, 
      persona,
      consistencyScore,
      weeklyAverage,
      restDays, // EXPORTED NEW METRIC
      longestSessionDisplay
    };
  }


  private getThemeColor(varName: string): string {
    if (typeof document !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#000';
    }
    return '#000';
  }

  private generateGlowingWeeklyChart(records: AttendanceRecord[]): EChartsOption {
    const primary = this.getThemeColor('--primary');
    const border = this.getThemeColor('--border');
    const muted = this.getThemeColor('--muted');
    const surface = this.getThemeColor('--surface');

    const uniqueDates = new Set(records.map(r => r.attendance_date.split('T')[0]));
    const weekLabels: string[] = [];
    const weekData: number[] = [0, 0, 0, 0];

    const anchorDate = new Date();

    for (let i = 3; i >= 0; i--) {
      const endOffset = i * 7;
      const startOffset = endOffset + 6;

      const startDate = new Date(anchorDate);
      startDate.setDate(anchorDate.getDate() - startOffset);

      const endDate = new Date(anchorDate);
      endDate.setDate(anchorDate.getDate() - endOffset);

      weekLabels.push(`${this.datePipe.transform(startDate, 'MMM d')} - ${this.datePipe.transform(endDate, 'd')}`);

      let daysAttended = 0;
      for (let j = startOffset; j >= endOffset; j--) {
        const checkDate = new Date(anchorDate);
        checkDate.setDate(anchorDate.getDate() - j);

        if (uniqueDates.has(this.getISTDateString(checkDate))) {
          daysAttended++;
        }
      }
      weekData[3 - i] = daysAttended;
    }

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Weekly Frequency',
        textStyle: { color: this.getThemeColor('--foreground'), fontSize: 20, fontWeight: 900 },
        left: '2%',
        top: '0%'
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderColor: border,
        textStyle: { color: this.getThemeColor('--foreground') },
        padding: [6, 10],
        formatter: (params: any) => {
          const val = params[0];
          return `<div style="font-weight:bold;color:${muted};font-size:10px;margin-bottom:2px;">${val.name}</div>
                  <div style="color:${primary};font-weight:900;font-size:14px;">🔥 ${val.value}</div>`;
        }
      },
      grid: { left: '6.5%', right: '7%', bottom: '0%', top: '20%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: weekLabels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          margin: 16,
          fontWeight: 700,
          fontSize: 10,
          showMaxLabel: true,
          padding: [0, 10, 0, 0]
        }
      },
      yAxis: {
        type: 'value',
        max: 7,
        name: 'Days',
        nameLocation: 'middle',
        nameRotate: 90,
        nameGap: 25,
        nameTextStyle: { color: muted, fontWeight: 900, fontSize: 13 },
        splitLine: { lineStyle: { color: border, type: 'dashed', opacity: 0.6 } },
        axisLabel: { color: muted, fontWeight: 900 }
      },
      series: [
        {
          name: 'Days',
          type: 'line',
          smooth: 0.4,
          symbolSize: 10,
          symbol: 'circle',
          itemStyle: { color: surface, borderWidth: 3, borderColor: primary },
          lineStyle: {
            width: 5,
            color: primary,
            shadowColor: primary,
            shadowBlur: 15
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
            ])
          },
          data: weekData
        }
      ]
    };
  }

  private getMins(inTime: string, outTime: string): number {
    return Math.round((new Date(outTime).getTime() - new Date(inTime).getTime()) / 60000);
  }

  getDurationDisplay(checkIn: string, checkOut: string | null): string {
    if (!checkOut) return '--';
    const mins = this.getMins(checkIn, checkOut);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }
}
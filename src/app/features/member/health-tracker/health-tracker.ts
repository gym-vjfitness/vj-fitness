import { Component, inject, OnInit, signal, computed, PLATFORM_ID, afterNextRender, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthTrackingService } from '../../../services/health-tracking-service';
import { SupabaseService } from '../../../services/supabase-service';
import { ToastService } from '../../../services/toast-service';
import { StorageService } from '../../../services/storage-service';

import * as echarts from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { DialogService } from '../../../services/dialog-service';
import { MeasurementLog, MemberData } from '../../../models/health-tracker.model';
import { Router } from '@angular/router';



@Component({
  selector: 'app-health-tracker',
  standalone: true,
  imports: [ReactiveFormsModule, NgxEchartsDirective, CommonModule],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './health-tracker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health-tracker.scss',
})
export class HealthTracker implements OnInit, OnDestroy {
  private healthService = inject(HealthTrackingService);
  private supabaseService = inject(SupabaseService);
  private storageService = inject(StorageService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  private themeObserver: MutationObserver | null = null;
  private readonly REFRESH_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 15 Minutes Cooldown

  memberData = signal<MemberData | null>(null);
  historyData = signal<MeasurementLog[]>([]);

  isLoading = signal<boolean>(true);
  isRefreshing = signal<boolean>(false);
  isChartReady = signal<boolean>(false);
  dialogService = inject(DialogService);
  private router = inject(Router);

  isUpdateModalOpen = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  activeUpdateTab = signal<'weight' | 'height' | 'chest' | 'waist'>('weight');

  latestRecordDate = computed(() => {
    const history = this.historyData();
    if (!history.length) return null;
    return new Date(history[history.length - 1].recorded_at);
  });

  daysUntilNextUpdate = computed(() => {
    const lastDate = this.latestRecordDate();
    if (!lastDate) return 0;
    const nextUpdate = new Date(lastDate);
    nextUpdate.setDate(nextUpdate.getDate() + 10);
    const diffTime = nextUpdate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
    return diffDays > 0 ? diffDays : 0;
  });

  canUpdate = computed(() => this.daysUntilNextUpdate() === 0);

  updateForm: FormGroup = this.fb.group({
    weight_kg: [null, [Validators.required, Validators.min(20), Validators.max(300)]],
    height_cm: [null, [Validators.required, Validators.min(50), Validators.max(300)]],
    chest_cm: [null, [Validators.required, Validators.min(20), Validators.max(200)]],
    waist_cm: [null, [Validators.required, Validators.min(20), Validators.max(200)]]
  });

  chartOptions = signal<EChartsOption>({});

  constructor() {
    afterNextRender(() => {
      if (this.historyData().length > 0) {
        this.setupThemeObserver();
        this.buildChart(this.historyData());
      }
    });
  }

  async ngOnInit() {
    await this.loadData();
  }

  ngOnDestroy() {
    if (this.themeObserver) this.themeObserver.disconnect();
  }

  // ✅ ANTI-SPAM: Handles the cooldown logic for the refresh button
  async handleManualRefresh() {
    const user = this.supabaseService.currentUser();
    if (!user?.id) return;

    const lastSyncStr = await this.storageService.getItem<string>(`last_sync_${user.id}`);

    if (lastSyncStr) {
      const lastSyncTime = parseInt(lastSyncStr, 10);
      const now = new Date().getTime();

      if (now - lastSyncTime < this.REFRESH_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((this.REFRESH_COOLDOWN_MS - (now - lastSyncTime)) / 60000);
        this.toastService.info(`Data is up to date. Try again in ${minutesLeft}m.`);
        return; // Block the API call!
      }
    }

    const confirmed = await this.dialogService.open({
      title: `warning`,
      message: `Are you sure you want to fetch health data?`,
      mode: 'warning',
      confirmText: `Yes, Continue`,
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    await this.loadData(true);
  }

  async loadData(forceRefresh = false) {
    if (!forceRefresh && this.historyData().length === 0) {
      this.isLoading.set(true);
    } else if (forceRefresh) {
      this.isRefreshing.set(true);
    }

    // ✅ THE FIX: Hard-Reload Race Condition handling
    // 1. Try to read from the synchronous Signal first (fastest, for tab-switching)
    let userId = this.supabaseService.currentUser()?.id;

    // 2. If the Signal is empty (because of a hard page refresh), await the local session.
    // This does NOT waste a network API call, it just reads the local auth cache safely.
    if (!userId) {
      const session = await this.supabaseService.getSession();
      userId = session?.user?.id;
    }

    // 3. If STILL no user, they are truly logged out. Abort safely.
    if (!userId) {
      this.isLoading.set(false);
      this.isRefreshing.set(false);
      return;
    }

    const statsKey = `member_stats_${userId}`;
    const historyKey = `member_history_${userId}`;
    const syncKey = `last_sync_${userId}`;

    // 1. Try to load from IndexedDB first (Tab switching / Offline mode)
    if (!forceRefresh) {
      try {
        const localStats = await this.storageService.getItem<MemberData>(statsKey);
        const localHistory = await this.storageService.getItem<MeasurementLog[]>(historyKey);

        if (localStats && localHistory) {
          this.memberData.set(localStats);
          this.historyData.set(localHistory);
          if (isPlatformBrowser(this.platformId) && localHistory.length > 0) {
            setTimeout(() => this.buildChart(localHistory), 50);
          }
          this.isLoading.set(false);
          return; // ✅ EXIT EARLY: No API calls to Supabase!
        }
      } catch (err) {
        console.warn("IndexedDB read failed, falling back to network.", err);
      }
    }

    // 2. Fetch from Backend (Only if Force Refresh is clicked, or IndexedDB is empty)
    try {
      const [memberStats, history] = await Promise.all([
        this.healthService.getMemberStats(userId),
        this.healthService.getMeasurementHistory(userId)
      ]);

      if (memberStats && history) {
        this.memberData.set(memberStats);
        this.historyData.set(history);

        // Cache to IndexedDB and set sync timer
        await this.storageService.setItem(statsKey, memberStats);
        await this.storageService.setItem(historyKey, history);
        await this.storageService.setItem(syncKey, new Date().getTime().toString());

        if (isPlatformBrowser(this.platformId) && history.length > 0) {
          setTimeout(() => this.buildChart(history), 50);
        }

        if (forceRefresh) this.toastService.success('Data perfectly synced.');
      }
    } catch (e) {
      this.toastService.error('Offline. Displaying cached data.');
    }

    this.isLoading.set(false);
    this.isRefreshing.set(false);
  }

  private setupThemeObserver() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.themeObserver = new MutationObserver(() => {
      if (this.historyData().length > 0) {
        this.buildChart(this.historyData());
      }
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  private getThemeColors() {
    const isDark = isPlatformBrowser(this.platformId) && document.documentElement.classList.contains('dark');
    return {
      primary: isDark ? '#60a5fa' : '#3b82f6',
      accent: isDark ? '#a78bfa' : '#8b5cf6',
      foreground: isDark ? '#f8fafc' : '#0f172a',
      muted: isDark ? '#64748b' : '#94a3b8',
      surface: isDark ? '#0f172a' : '#f8fafc',
      border: isDark ? '#1e293b' : '#e2e8f0',
    };
  }

  buildChart(history: MeasurementLog[]) {
    if (!history || history.length === 0) {
      this.isChartReady.set(true);
      return;
    }

    const c = this.getThemeColors();

    const dates = history.map(h => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(h.recorded_at)));
    const weights = history.map(h => h.weight_kg);
    const heights = history.map(h => h.height_cm);
    const chests = history.map(h => h.chest_cm || 0);
    const waists = history.map(h => h.waist_cm || 0);

    this.chartOptions.set({
      color: [c.primary, c.accent, '#f59e0b', '#10b981'],
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        padding: 0,
        borderRadius: 16,
        extraCssText: 'box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.2);',
        formatter: (params: any) => {
          const date = params[0].name;
          let html = `<div style="padding: 16px; border-radius: 16px;" class="bg-background border border-success/50">`;
          html += `<div style="font-size: 11px; font-weight: 800; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;" class="text-warning" >${date}</div>`;
          params.forEach((p: any) => {
            const unit = p.seriesName === 'Weight' ? 'kg' : 'cm';
            html += `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 24px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${p.color}; box-shadow: 0 0 5px ${p.color};"></span>
                  <span style="font-size: 14px; font-weight: 700; " class="text-foreground">${p.seriesName}</span>
                </div>
                <div style="font-size: 16px; font-weight: 900;" class="text-info">${p.value} <span style="font-size: 11px; color: ${c.muted}; font-weight: 700;">${unit}</span></div>
              </div>`;
          });
          html += `</div>`;
          return html;
        }
      },
      legend: {
        data: ['Weight', 'Height', 'Chest', 'Waist'],
        top: 0,
        icon: 'circle',
        itemGap: 24,
        inactiveColor: c.muted,
        inactiveBorderColor: c.muted,
        selectedMode: 'multiple',
        textStyle: { color: 'inherit', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' },
        selected: {
          'Weight': true,
          'Waist': true,
          'Height': false,
          'Chest': false
        }
      },
      dataZoom: [
        { type: 'inside', start: history.length > 7 ? 60 : 0, end: 100, zoomOnMouseWheel: false }
      ],
      grid: { left: '2%', right: '2%', bottom: '5%', top: '18%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: c.muted, margin: 16, fontWeight: 700, fontFamily: 'inherit' }
      },
      yAxis: [
        {
          type: 'value',
          position: 'left',
          min: (val) => val.min === val.max ? val.min - 10 : Math.floor(val.min - (val.max - val.min) * 0.4),
          max: (val) => val.min === val.max ? val.max + 10 : Math.ceil(val.max + (val.max - val.min) * 0.4),
          splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
          axisLabel: { show: true, formatter: '{value} kg', color: c.muted, fontWeight: 600, fontSize: 11, fontFamily: 'inherit' }
        },
        {
          type: 'value',
          position: 'right',
          min: (val) => val.min === val.max ? val.min - 10 : Math.floor(val.min - (val.max - val.min) * 0.4),
          max: (val) => val.min === val.max ? val.max + 10 : Math.ceil(val.max + (val.max - val.min) * 0.4),
          splitLine: { show: false },
          axisLabel: { show: true, formatter: '{value} cm', color: c.muted, fontWeight: 600, fontSize: 11, fontFamily: 'inherit' }
        }
      ],
      series: [
        {
          name: 'Weight',
          type: 'line',
          yAxisIndex: 0,
          smooth: 0.5,
          data: weights,
          symbol: 'circle',
          symbolSize: 10,
          showSymbol: true,
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          lineStyle: { width: 4, cap: 'round', shadowColor: 'rgba(0,0,0,0.1)', shadowBlur: 10, shadowOffsetY: 5 },
        },
        {
          name: 'Height',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.5,
          data: heights,
          symbol: 'circle',
          symbolSize: 10,
          showSymbol: true,
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          lineStyle: { width: 4, cap: 'round', shadowColor: 'rgba(0,0,0,0.1)', shadowBlur: 10, shadowOffsetY: 5 },
        },
        {
          name: 'Chest',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.5,
          data: chests,
          symbol: 'circle',
          symbolSize: 10,
          showSymbol: true,
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          lineStyle: { width: 4, cap: 'round', shadowColor: 'rgba(0,0,0,0.1)', shadowBlur: 10, shadowOffsetY: 5 },
        },
        {
          name: 'Waist',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.5,
          data: waists,
          symbol: 'circle',
          symbolSize: 10,
          showSymbol: true,
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          lineStyle: { width: 4, cap: 'round', shadowColor: 'rgba(0,0,0,0.1)', shadowBlur: 10, shadowOffsetY: 5 },
        }
      ]
    });

    this.isChartReady.set(true);
  }

  setUpdateTab(tab: 'weight' | 'height' | 'chest' | 'waist') {
    this.activeUpdateTab.set(tab);
    this.updateForm.markAsUntouched();
  }

  openUpdateModal() {
    if (!this.canUpdate()) return;

    this.updateForm.reset();

    if (!this.memberData()?.weight_kg) {
      this.activeUpdateTab.set('weight');
    } else if (!this.memberData()?.height_cm) {
      this.activeUpdateTab.set('height');
    } else if (!this.memberData()?.chest_cm) {
      this.activeUpdateTab.set('chest');
    } else if (!this.memberData()?.waist_cm) {
      this.activeUpdateTab.set('waist');
    } else {
      this.activeUpdateTab.set('weight');
    }

    this.isUpdateModalOpen.set(true);
  }

  closeUpdateModal() {
    this.isUpdateModalOpen.set(false);
  }

  isFieldInvalid(field: 'weight_kg' | 'height_cm' | 'chest_cm' | 'waist_cm'): boolean {
    const control = this.updateForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getErrorMessage(field: 'weight_kg' | 'height_cm' | 'chest_cm' | 'waist_cm'): string {
    const control = this.updateForm.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'This field cannot be empty.';
    if (control.errors['min']) return `Value must be at least ${control.errors['min'].min}.`;
    if (control.errors['max']) return `Value cannot exceed ${control.errors['max'].max}.`;
    return 'Invalid input.';
  }

  isCurrentTabInvalid(): boolean {
    const tab = this.activeUpdateTab();
    const control = this.updateForm.get(
      tab === 'weight' ? 'weight_kg' :
      tab === 'height' ? 'height_cm' :
      tab === 'chest' ? 'chest_cm' : 'waist_cm'
    );
    return !control || control.invalid;
  }

  async submitUpdate() {
    const user = this.supabaseService.currentUser();
    if (!user?.id) return;

    // Check if the tab they are currently viewing has a valid input
    if (this.isCurrentTabInvalid()) {
      const tab = this.activeUpdateTab();
      const field = tab === 'weight' ? 'weight_kg' :
                    tab === 'height' ? 'height_cm' :
                    tab === 'chest' ? 'chest_cm' : 'waist_cm';
      this.updateForm.get(field)?.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const formValues = this.updateForm.value;
    const currentStats = this.memberData();

    // Grab values from ALL form inputs if the user typed them.
    // If an input is empty, carry over the existing value from their profile
    // so the new Supabase row always has a complete set of measurements.
    const weightToSubmit = formValues.weight_kg ?? currentStats?.weight_kg;
    const heightToSubmit = formValues.height_cm ?? currentStats?.height_cm;
    const chestToSubmit = formValues.chest_cm ?? currentStats?.chest_cm;
    const waistToSubmit = formValues.waist_cm ?? currentStats?.waist_cm;

    // 1. Send the complete payload to Supabase
    const result = await this.healthService.addMeasurement(
      user.id,
      weightToSubmit,
      heightToSubmit,
      chestToSubmit,
      waistToSubmit
    );

    if (result.success && result.data) {
      let currentHistory = [...this.historyData()];

      // 2. Use real DB payload
      currentHistory.push(result.data);
      currentHistory.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

      if (currentHistory.length > 10) {
        currentHistory.splice(0, 1); 
      }

      const newStats: MemberData = {
        ...currentStats!,
        weight_kg: result.data.weight_kg,
        height_cm: result.data.height_cm,
        chest_cm: result.data.chest_cm,
        waist_cm: result.data.waist_cm
      };

      this.memberData.set(newStats);
      this.historyData.set(currentHistory);

      // 3. Update cache with correct IDs
      await this.storageService.setItem(`member_stats_${user.id}`, newStats);
      await this.storageService.setItem(`member_history_${user.id}`, currentHistory);
      await this.storageService.setItem(`last_sync_${user.id}`, new Date().getTime().toString());

      this.buildChart(currentHistory);

      this.closeUpdateModal();
      this.toastService.success('Vitals secured! Locked for 10 days.');
    } else {
      this.toastService.error(result.message || 'Failed to update data.');
    }

    this.isSubmitting.set(false);
  }

  navigateToInsights() {
    const currentWeight = this.memberData()?.weight_kg;
    const currentHeight = this.memberData()?.height_cm;
    const currentWaist = this.memberData()?.waist_cm;

    if (currentWeight && currentHeight) {
      this.router.navigate(['/member/health-tracker/insight'], {
        queryParams: { 
          weight: currentWeight, 
          height: currentHeight,
          waist: currentWaist
        }
      });
    } else {
      this.toastService.error('Please record your vitals first to see insights.');
    }
  }
}
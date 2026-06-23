import { Component, inject, OnInit, signal, PLATFORM_ID, afterNextRender, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

import { ToastService } from '../../../services/toast-service';

import * as echarts from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { AdminDashboardService, DashboardSnapshot } from '../../../services/admin-dashboard-service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './admin-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit, OnDestroy {
  private dashboardService = inject(AdminDashboardService);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  dashboardData = this.dashboardService.dashboardState; 
  
  isLoading = signal<boolean>(true);
  isRefreshing = signal<boolean>(false);
  isChartReady = signal<boolean>(false);
  
  cooldownRemainingMs = signal<number>(0);
  private timerInterval: any;

  chartOptions = signal<EChartsOption>({});
  private themeObserver: MutationObserver | null = null;

  constructor() {
    afterNextRender(() => {
      if (this.dashboardData()?.monthly_earnings_history) {
        this.setupThemeObserver();
        this.buildChart(this.dashboardData()!.monthly_earnings_history);
      }
    });
  }

  async ngOnInit() {
    this.startCooldownTimer();
    await this.loadData(false);
  }

  ngOnDestroy() {
    if (this.themeObserver) this.themeObserver.disconnect();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // ✅ FORCES INDIAN NUMBER FORMATTING (1,85,000) IN THE HTML TEMPLATE
  formatINR(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('en-IN').format(value);
  }

  startCooldownTimer() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.updateTimer();
    this.timerInterval = setInterval(() => this.updateTimer(), 60000); 
  }

  updateTimer() {
    const lastSync = parseInt(localStorage.getItem('admin_last_sync_time') || '0', 10);
    const diff = Date.now() - lastSync;
    const ONE_HOUR = 3600000;

    if (diff < ONE_HOUR) {
       this.cooldownRemainingMs.set(ONE_HOUR - diff);
    } else {
       this.cooldownRemainingMs.set(0);
    }
  }

  async handleManualRefresh() {
    if (this.cooldownRemainingMs() > 0) return; 
    
    this.isRefreshing.set(true);
    await this.loadData(true);
    this.updateTimer(); 
    this.isRefreshing.set(false);
    this.toastService.success('Data synced! Locked for 1 Hour.');
  }

  async loadData(forceRefresh: boolean) {
    if (!forceRefresh && !this.dashboardData()) this.isLoading.set(true);
    
    const { data, error } = await this.dashboardService.getDashboardData(forceRefresh);
    
    if (error || !data) {
      this.toastService.error('Failed to load dashboard data.');
      this.isLoading.set(false);
      return;
    }
    
    if (isPlatformBrowser(this.platformId) && data.monthly_earnings_history.length > 0) {
      setTimeout(() => this.buildChart(data.monthly_earnings_history), 50);
    } else {
      this.isChartReady.set(true);
    }
    
    this.isLoading.set(false);
  }

  private setupThemeObserver() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.themeObserver = new MutationObserver(() => {
      if (this.dashboardData()) this.buildChart(this.dashboardData()!.monthly_earnings_history);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  private getThemeColors() {
    const isDark = isPlatformBrowser(this.platformId) && document.documentElement.classList.contains('dark');
    return {
      primary: isDark ? '#60a5fa' : '#3b82f6',
      foreground: isDark ? '#f8fafc' : '#0f172a',
      muted: isDark ? '#64748b' : '#94a3b8',
      surface: isDark ? '#0f172a' : '#f8fafc',
      border: isDark ? '#1e293b' : '#e2e8f0',
      success: isDark ? '#4ade80' : '#22c55e',
    };
  }

  buildChart(history: { month: string, earning: number }[]) {
    if (!history || history.length === 0) {
      this.isChartReady.set(true);
      return;
    }

    const c = this.getThemeColors();
    const months = history.map(h => h.month);
    const earnings = history.map(h => h.earning);

    this.chartOptions.set({
      color: [c.success],
      tooltip: {
        trigger: 'axis',
        backgroundColor: c.surface,
        borderColor: c.border,
        textStyle: { color: c.foreground, fontWeight: 700, fontFamily: 'inherit' },
        borderRadius: 16,
        padding: 12,
        formatter: (params: any) => {
          return `<div class="flex flex-col gap-1">
                    <span class="text-[10px] font-black text-muted uppercase tracking-widest">${params[0].name}</span>
                    <span class="text-xl font-black text-success">₹${params[0].value.toLocaleString('en-IN')}</span>
                  </div>`;
        }
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: c.muted, margin: 12, fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        scale: true, 
        splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
        axisLabel: { 
          show: true, 
          formatter: (value: any) => '₹' + value.toLocaleString('en-IN'), 
          color: c.muted, 
          fontWeight: 700, 
          fontSize: 10, 
          fontFamily: 'inherit' 
        }
      },
      series: [
        {
          name: 'Earnings',
          type: 'line',
          smooth: 0.4,
          data: earnings,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: false,
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          lineStyle: { width: 4, cap: 'round', shadowColor: c.success, shadowBlur: 10, shadowOffsetY: 5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: c.success },
              { offset: 1, color: 'transparent' }
            ])
          }
        }
      ]
    });

    this.isChartReady.set(true);
  }
}
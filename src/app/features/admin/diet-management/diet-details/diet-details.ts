import { Component, OnInit, inject, signal, input, effect, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { NgClass, Location } from '@angular/common';
import { Router } from '@angular/router';
import { DietPlan } from '../../../../models/diet-plan.dto';
import { DietService } from '../../../../services/diet-service';
import { StorageService } from '../../../../services/storage-service';

@Component({
  selector: 'app-diet-details',
  standalone: true,
  imports: [NgClass],
  templateUrl: './diet-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './diet-details.scss',
})
export class DietDetails implements OnDestroy {
  private dietService = inject(DietService);
  private storageService = inject(StorageService);
  private location = inject(Location);
  private router = inject(Router);

  plan = signal<DietPlan | null>(null);
  activeDay = signal<string | null>(null);
  dietInput = input<DietPlan | string | null | undefined>(undefined, { alias: 'input' });
  
  isLoading = signal<boolean>(true);
  isUnassigned = signal<boolean>(false);
  
  // Refresh Cooldown State
  isRefreshDisabled = signal<boolean>(false);
  isAdmin = signal<boolean>(false);
  private cooldownTimer: any;
  private readonly ONE_HOUR_MS = 60 * 60 * 1000;

  private stateData = history.state?.dietData;

  constructor() {
    // Determine context based on URL
    this.isAdmin.set(this.router.url.includes('/admin'));
  }

  private inputChangeEffect = effect(async () => {
    const value = this.stateData || this.dietInput();
    
    if (!value || value === 'unassigned') {
      this.isLoading.set(false);
      this.isUnassigned.set(true);
      return;
    }

    if (typeof value === 'string') {
      await this.loadDietData(value);
    } else {
      // Direct object passing (from history state)
      this.plan.set(value);
      this.isLoading.set(false);
      this.isUnassigned.set(false);
      this.updateCache(value, Date.now()); // Save to appropriate cache
    }
  });

  async loadDietData(planId: string, forceRefresh = false) {
    this.isLoading.set(true);
    let cachedData: DietPlan | null = null;
    let fetchTime = 0;

    // 1. Check Caches if NOT forcing a refresh
    if (!forceRefresh) {
      if (this.isAdmin()) {
        // ADMIN: Check Memory Cache
        const cache = this.dietService.adminDietCache.get(planId);
        if (cache) {
          cachedData = cache.data;
          fetchTime = cache.timestamp;
        }
      } else {
        // USER: Check Local Storage
        const storageObj = await this.storageService.getItem<{data: DietPlan, timestamp: number}>('user_diet_cache');
        if (storageObj && storageObj.data.id === planId) {
          cachedData = storageObj.data;
          fetchTime = storageObj.timestamp;
        }
      }
    }

    // 2. Resolve Data
    if (cachedData) {
      this.plan.set(cachedData);
      this.isUnassigned.set(false);
      this.setupRefreshCooldown(fetchTime);
      this.isLoading.set(false);
    } else {
      await this.fetchFromApi(planId);
    }
  }

  async fetchFromApi(planId: string) {
    try {
      const data = await this.dietService.getDietPlanDetailsById(planId);
      if (data) {
        this.plan.set(data);
        this.isUnassigned.set(false);
        this.updateCache(data, Date.now());
      } else {
        this.isUnassigned.set(true);
      }
    } catch (error) {
      console.error('Error fetching diet plan:', error);
      this.isUnassigned.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Smartly routes data to memory or storage based on role
  private async updateCache(data: DietPlan, timestamp: number) {
    if (this.isAdmin()) {
      this.dietService.adminDietCache.set(data.id, { data, timestamp });
    } else {
      await this.storageService.setItem('user_diet_cache', { data, timestamp });
    }
    this.setupRefreshCooldown(timestamp);
  }

  // --- Refresh Logic ---
  onRefresh() {
    const currentId = this.plan()?.id || (typeof this.dietInput() === 'string' ? this.dietInput() as string : null);
    if (currentId && !this.isRefreshDisabled()) {
      this.loadDietData(currentId, true); // Force refresh
    }
  }

  setupRefreshCooldown(fetchTimestamp: number) {
    const timePassed = Date.now() - fetchTimestamp;
    
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);

    if (timePassed < this.ONE_HOUR_MS) {
      this.isRefreshDisabled.set(true);
      const timeRemaining = this.ONE_HOUR_MS - timePassed;
      
      this.cooldownTimer = setTimeout(() => {
        this.isRefreshDisabled.set(false);
      }, timeRemaining);
    } else {
      this.isRefreshDisabled.set(false);
    }
  }

  // --- UI Helpers ---
  setActiveDay(dayName: string | null) {
    this.activeDay.set(dayName);
  }

  goBack() {
    this.location.back();
  }

  ngOnDestroy() {
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
  }
}
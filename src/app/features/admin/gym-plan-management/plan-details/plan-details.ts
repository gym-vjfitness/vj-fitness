import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { GymPlanDTO } from '../../../../models/gym-plan.model';
import { GymPlanService } from '../../../../services/gym-plan-service';
import { StorageService } from '../../../../services/storage-service';
import { SupabaseService } from '../../../../services/supabase-service';

@Component({
  selector: 'app-plan-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-details.html',
})
export class PlanDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planService = inject(GymPlanService);
  private storageService = inject(StorageService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  // State Signals
  plan = signal<GymPlanDTO | null>(null);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPlanDetails(id);
    } else {
      this.errorMessage.set('Invalid Plan ID.');
      this.isLoading.set(false);
    }
  }

  async loadPlanDetails(id: string) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const cacheKey = `plan_details_${id}`;

    try {
      // 1. Check Local Storage First (Solves Points 1 & 2)
      try {
        const cachedPlan = await this.storageService.getItem<GymPlanDTO>(cacheKey);
        if (cachedPlan) {
          this.plan.set(cachedPlan);
          this.isLoading.set(false);
          return; // Exit early, no API call needed!
        }
      } catch (cacheError) {
        console.warn('Failed to read from local storage, falling back to API:', cacheError);
      }

      // 2. If not in cache, fetch from API
      const data = await this.planService.getPlanById(id);
      
      // Sort prices from shortest duration to longest for a clean UI flow
      if (data.plan_prices) {
        data.plan_prices.sort((a, b) => a.duration_in_days - b.duration_in_days);
      }
      
      // 3. Save the fetched & sorted data to Local Storage
      try {
        await this.storageService.setItem(cacheKey, data);
      } catch (cacheError) {
        console.warn('Failed to save to local storage:', cacheError);
      }

      this.plan.set(data);
    } catch (error: any) {
      console.error('Error fetching plan details:', error);
      this.errorMessage.set('Could not load plan details. It may have been deleted.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Premium UI Helper to convert days into clean text
  getDurationLabel(days: number): string {
    switch (days) {
      case 30: return 'One Month';
      case 60: return 'Two Months';
      case 90: return 'Three Months';
      case 180: return 'Six Months';
      case 270: return 'Nine Months';
      case 365: return 'Annual Pass';
      default: return `${days} Days`;
    }
  }

  goBack() {
    this.router.navigate([`/${this.role}/gym-plan`]);
  }

  goToEdit() {
    const currentPlan = this.plan();
    if (currentPlan?.id) {
      this.router.navigate([`/${this.role}/gym-plan/update`, currentPlan.id]);
    }
  }
}
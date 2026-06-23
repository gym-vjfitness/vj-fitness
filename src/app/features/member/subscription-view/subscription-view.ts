import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionViewService } from '../../../services/subscription-view-service';
import { ToastService } from '../../../services/toast-service';

import { SubscriptionPlan, SubscriptionPrice, seletedSubscriptionPlan } from '../../../models/subscription-view.model';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-subscription-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription-view.html',
})
export class SubscriptionView implements OnInit {
  private subscriptionService = inject(SubscriptionViewService);
  private supabaseService = inject(SupabaseService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  plans = signal<SubscriptionPlan[]>([]);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  selectedPriceMap = signal<Record<string, string>>({});
  
  canSubscribe = signal<boolean>(false);
  lockReason = signal<string>('Verifying Status...'); 
  
  // NEW: Signal to track if the latest subscription was rejected
  isRejected = signal<boolean>(false);

  async ngOnInit() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      // Run both network requests concurrently
      await Promise.all([
        this.loadSubscriptions(),
        this.checkSubscriptionStatus()
      ]);
    } catch (error) {
      this.errorMessage.set('Membership details are currently unavailable.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async checkSubscriptionStatus() {
    try {
      const currentUser = this.supabaseService.currentUser();
      
      // Reset rejected state on check
      this.isRejected.set(false);
      
      if (!currentUser?.id) {
        this.canSubscribe.set(false);
        this.lockReason.set('Authentication Required');
        return;
      }

      const latestSub = await this.subscriptionService.getLatestSubscriptionDetails(currentUser.id);

      // SCENARIO 1: User has NEVER taken a subscription
      if (!latestSub) {
        this.canSubscribe.set(true);
        return;
      }

      // SCENARIO 2: Subscription is fully Expired or Cancelled
      const openStatuses = ['EXPIRED', 'CANCELLED'];
      if (openStatuses.includes(latestSub.status)) {
        this.canSubscribe.set(true);
        return;
      }

      // SCENARIO 3: Subscription was REJECTED by Admin
      if (latestSub.status === 'REJECTED') {
        this.canSubscribe.set(true); // Allow selecting a new plan
        this.isRejected.set(true);   // Trigger the warning banner UI
        return;
      }

      // SCENARIO 4: User has a PENDING or PAUSED subscription
      if (latestSub.status === 'PENDING') {
        this.canSubscribe.set(false);
        this.lockReason.set('Request Pending');
        return;
      }

      if (latestSub.status === 'PAUSED') {
        this.canSubscribe.set(false);
        this.lockReason.set('Plan Paused');
        return;
      }

      // SCENARIO 5: Subscription is ACTIVE (Apply the 5-day rule)
      if (latestSub.status === 'ACTIVE') {
        if (!latestSub.end_date) {
          this.canSubscribe.set(false);
          this.lockReason.set('Active Plan Exists');
          return;
        }

        const endDate = new Date(latestSub.end_date);
        const currentDate = new Date();

        const utcExpiry = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const utcCurrent = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        const diffTime = utcExpiry - utcCurrent;
        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

        if (diffDays <= 5) {
          this.canSubscribe.set(true);
        } else {
          this.canSubscribe.set(false);
          this.lockReason.set('Active Plan Exists');
        }
      }
      
    } catch (error) {
      console.error('Failed to verify user subscription status', error);
      this.canSubscribe.set(false);
      this.lockReason.set('Status Verification Failed');
    }
  }

  async loadSubscriptions() {
    const data = await this.subscriptionService.getActiveSubscriptions();
    const validPlans = data.filter(p => p.plan_prices && p.plan_prices.length > 0 && p.is_active);

    this.plans.set(validPlans);

    const initialMap: Record<string, string> = {};
    validPlans.forEach(plan => {
      initialMap[plan.id] = plan.plan_prices[0].id;
    });
    this.selectedPriceMap.set(initialMap);
  }

  selectPriceTier(planId: string, priceId: string) {
    this.selectedPriceMap.update(map => ({ ...map, [planId]: priceId }));
  }

  getSelectedPrice(plan: SubscriptionPlan): SubscriptionPrice | undefined {
    const selectedId = this.selectedPriceMap()[plan.id];
    return plan.plan_prices.find(p => p.id === selectedId);
  }

  getSavingsPercentage(plan: SubscriptionPlan): number | null {
    const selectedPriceId = this.selectedPriceMap()[plan.id];
    const priceObj = plan.plan_prices.find(p => p.id === selectedPriceId);

    if (!priceObj || priceObj.duration_in_days <= 30) return null;

    const basePriceObj = plan.plan_prices.find(p => p.duration_in_days === 30 || p.duration_in_days === 31);
    if (!basePriceObj) return null;

    const months = Math.round(priceObj.duration_in_days / 30.416);
    if (months <= 1) return null;

    const expectedCost = basePriceObj.price * months;
    const savings = Math.round(((expectedCost - priceObj.price) / expectedCost) * 100);

    return savings > 0 ? savings : null;
  }

  getMonthlyEquivalent(price: number, days: number): number | null {
    if (days < 28) return null;
    const exactMonths = days / 30.416;
    const roundedMonths = Math.round(exactMonths);
    if (roundedMonths <= 1) return null;
    return Math.round(price / roundedMonths);
  }

  getDurationNumber(days: number): string {
    if (days >= 28 && days <= 31) return '1';
    if (days >= 89 && days <= 92) return '3';
    if (days >= 178 && days <= 183) return '6';
    if (days >= 360 && days <= 366) return '12';
    return Math.round(days / 30.416).toString();
  }

  // NEW: Navigation method for the rejection banner
  goToProfile() {
    this.router.navigate(['/member/profile']);
  }

  onSelectPlan(plan: SubscriptionPlan) {
    if (!this.canSubscribe()) {
      this.toastService.error(`Cannot select plan: ${this.lockReason()}`);
      return;
    }

    const selectedPrice = this.getSelectedPrice(plan);
    if (!selectedPrice) return;

    const selectedPlan: seletedSubscriptionPlan = {
      id: plan.id,
      name: plan.name,
      plan_features: (plan.plan_features ?? []).map(({ id, ...feature }) => feature.name),
      plan_price: selectedPrice
    };

    this.subscriptionService.clearSubscriptionCache();

    this.toastService.success(`${plan.name} Plan selected for ${selectedPlan.plan_price.name} duration`);

    this.router.navigate(['member/billing'], {
      state: { plan: selectedPlan }
    });
  }
}
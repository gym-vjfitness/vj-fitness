import { Component, OnInit, inject, signal, computed, HostListener, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SubscriptionViewService } from '../../../services/subscription-view-service';
import { UserSubscriptionService } from '../../../services/user-subscription-service';
import { ToastService } from '../../../services/toast-service';
import { CouponService } from '../../../services/coupon-service';
import { SubscriptionPlan, SubscriptionPrice, seletedSubscriptionPlan } from '../../../models/subscription-view.model';
import { CouponPreviewResponse } from '../../../models/coupon.model';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-admin-offline-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-offline-checkout.html',
})
export class AdminOfflineCheckout implements OnInit {
  private router = inject(Router);
  private viewService = inject(SubscriptionViewService);
  private subService = inject(UserSubscriptionService);
  private couponService = inject(CouponService);
  private toastService = inject(ToastService);
  private eRef = inject(ElementRef);
  private supabaseService = inject(SupabaseService);

  targetProfileId = signal<string>('');
  targetUserName = signal<string>('Member');

  isLoading = signal<boolean>(true);
  isProcessing = signal<boolean>(false);
  
  existingSubscription = signal<any | null>(null);
  pendingSecondInstallment = signal<any | null>(null);

  plans = signal<SubscriptionPlan[]>([]);
  selectedPlan = signal<SubscriptionPlan | null>(null);
  selectedPrice = signal<SubscriptionPrice | null>(null);

  role = this.supabaseService.currentUser()?.user_role || 'member';

  // Discount & Coupon State
  discountAmount = signal<number>(0);
  adminNote = signal<string>(''); 
  
  couponCodeInput = signal<string>('');
  isApplyingCoupon = signal<boolean>(false);
  couponError = signal<string | null>(null);
  appliedCouponData = signal<CouponPreviewResponse | null>(null);

  paymentMode = signal<'FULL' | 'SPLIT'>('FULL');

  isDropdownOpen = signal<boolean>(false);
  paymentMethod = signal<'CASH' | 'CARD' | 'UPI_DIRECT' | 'NET_BANKING'>('CASH');
  
  paymentMethodsList = [
    { id: 'CASH', label: 'Hard Cash', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'CARD', label: 'POS / Card', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { id: 'UPI_DIRECT', label: 'Direct UPI', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { id: 'NET_BANKING', label: 'Net Banking', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' }
  ];

  selectedMethodData = computed(() => this.paymentMethodsList.find(m => m.id === this.paymentMethod())!);

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen.set(false);
    }
  }

  selectPaymentMethod(id: any) {
    this.paymentMethod.set(id);
    this.isDropdownOpen.set(false);
  }

  isSplitAllowed = computed(() => {
    const price = this.selectedPrice();
    return price ? price.duration_in_days !== 30 : false;
  });

  // Strict UI Math
  subtotal = computed(() => this.selectedPrice()?.price || 0);
  totalPlanPrice = computed(() => Math.max(0, this.subtotal() - this.discountAmount()));
  
  // SPLIT MATH BREAKDOWN
  baseInstallment2 = computed(() => Math.floor(this.subtotal() / 2));
  baseInstallment1 = computed(() => this.subtotal() - this.baseInstallment2());

  // How much of the discount gets eaten by the first installment
  discountAppliedToFirst = computed(() => Math.min(this.discountAmount(), this.baseInstallment1()));

  firstInstallmentDue = computed(() => {
    if (this.paymentMode() === 'FULL') return this.totalPlanPrice();
    return Math.max(0, this.baseInstallment1() - this.discountAmount());
  });

  secondInstallmentAmount = computed(() => {
    if (this.paymentMode() === 'FULL') return 0;
    const leftoverDiscount = Math.max(0, this.discountAmount() - this.baseInstallment1());
    return Math.max(0, this.baseInstallment2() - leftoverDiscount);
  });

  async ngOnInit() {
    const navState = history.state;
    if (!navState || !navState.profileId) {
      this.toastService.danger('Session invalid. Returning to directory.');
      this.router.navigate([`/${this.role}/users`]);
      return;
    }

    this.targetProfileId.set(navState.profileId);
    this.targetUserName.set(navState.userName || 'Member');
    await this.verifyUserStatusAndLoad();
  }

  async verifyUserStatusAndLoad() {
    this.isLoading.set(true);
    try {
      const userSubs = await this.subService.getUserSubscriptions(this.targetProfileId());
      const activeSub = userSubs.find((s: any) => ['ACTIVE', 'PENDING', 'PAUSED'].includes(s.status));
      
      if (activeSub) {
        this.existingSubscription.set(activeSub);
        const payments = await this.subService.getSubscriptionPayments(activeSub.id);
        const pendingInst = payments.find((p: any) => p.installment_number === 2 && p.status === 'PENDING');
        if (pendingInst) this.pendingSecondInstallment.set(pendingInst);
        return; 
      }

      const data = await this.viewService.getActiveSubscriptions();
      this.plans.set(data);
    } catch (error) {
      this.toastService.danger('Failed to initialize workspace.');
    } finally {
      this.isLoading.set(false);
    }
  }

  setPaymentMode(mode: 'FULL' | 'SPLIT') {
    if (mode === 'SPLIT' && !this.isSplitAllowed()) return;
    this.paymentMode.set(mode);
  }

  onPlanSelect(plan: SubscriptionPlan) {
    this.selectedPlan.set(plan);
    if (plan.plan_prices.length > 0) this.selectedPrice.set(plan.plan_prices[0]);
    if (!this.isSplitAllowed() && this.paymentMode() === 'SPLIT') this.paymentMode.set('FULL');
    
    this.removeCoupon();
  }

  goToSubscriptionDetail() {
    const sub = this.existingSubscription();
    if (sub) this.router.navigate([`/${this.role}/subscription/detail`, sub.id]);
  }

  getMonthlyEquivalent(price: number, days: number): number | null {
    if (days < 28) return null;
    const roundedMonths = Math.round(days / 30.416);
    if (roundedMonths <= 1) return null;
    return Math.round(price / roundedMonths);
  }

  getSavingsPercentage(plan: SubscriptionPlan, priceId: string): number | null {
    const priceObj = plan.plan_prices.find(p => p.id === priceId);
    if (!priceObj || priceObj.duration_in_days <= 30) return null;
    const basePriceObj = plan.plan_prices.find(p => p.duration_in_days === 30 || p.duration_in_days === 31);
    if (!basePriceObj) return null;

    const months = Math.round(priceObj.duration_in_days / 30.416);
    if (months <= 1) return null;

    const expectedCost = basePriceObj.price * months;
    const savings = Math.round(((expectedCost - priceObj.price) / expectedCost) * 100);
    return savings > 0 ? savings : null;
  }

  async applyCoupon() {
    const code = this.couponCodeInput().trim().toUpperCase();
    if (!code) return;
    
    this.isApplyingCoupon.set(true);
    this.couponError.set(null);
    
    try {
      const result = await this.couponService.previewCoupon(code, this.subtotal());
      if (result.is_valid) {
        this.discountAmount.set(result.discount_amount);
        this.appliedCouponData.set(result);
        this.adminNote.set(code); 
        this.toastService.success('Coupon Validated & Applied');
      } else {
        this.couponError.set(result.message);
      }
    } catch (e) {
      this.couponError.set('Validation failed. Check connection.');
    } finally {
      this.isApplyingCoupon.set(false);
    }
  }

  removeCoupon() {
    this.couponCodeInput.set('');
    this.discountAmount.set(0);
    this.appliedCouponData.set(null);
    this.adminNote.set('');
    this.couponError.set(null);
  }

  async confirmOfflinePayment() {
    const plan = this.selectedPlan();
    const price = this.selectedPrice();
    if (!plan || !price) return;
    
    this.isProcessing.set(true);
    const planData: seletedSubscriptionPlan = {
      id: plan.id,
      name: plan.name,
      plan_features: (plan.plan_features ?? []).map(f => f.name),
      plan_price: price
    };

    try {
      const result = await this.subService.adminOfflineCheckout(
        this.targetProfileId(), 
        planData, 
        this.paymentMethod() as 'CASH' | 'CARD' | 'UPI_DIRECT' | 'NET_BANKING', 
        this.paymentMode(),
        this.discountAmount(),
        this.adminNote().trim() || null
      );

      this.toastService.success('Offline payment recorded securely.');
      this.router.navigate([`/${this.role}/subscription/detail`, result.subscription.id]);
    } catch (error) {
      this.toastService.danger('Transaction failed. Check ledger.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async processSecondInstallment() {
    const payment = this.pendingSecondInstallment();
    const sub = this.existingSubscription();
    if (!payment || !sub) return;

    this.isProcessing.set(true);
    try {
      await this.subService.adminCollectSecondInstallment(payment.id, this.paymentMethod() as 'CASH' | 'CARD' | 'UPI_DIRECT' | 'NET_BANKING');
      this.toastService.success('Remaining balance collected securely.');
      setTimeout(() => {
        this.router.navigate([`/${this.role}/subscription/detail`, sub.id]);
      }, 1000);
    } catch (error) {
      this.toastService.danger('Failed to process balance recovery.');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
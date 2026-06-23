import { Component, OnInit, HostListener, inject, signal, computed, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { seletedSubscriptionPlan } from '../../../models/subscription-view.model';
import QRCodeStyling from 'qr-code-styling';
import { SettingService } from '../../../services/setting-service';
import { ToastService } from '../../../services/toast-service';
import { UserSubscription } from '../../../models/user-subscription.model';
import { UserSubscriptionService } from '../../../services/user-subscription-service';
import { AttendanceTrackingService } from '../../../services/attendance-tracking-service';
import { CouponService } from '../../../services/coupon-service';
import { CouponPreviewResponse } from '../../../models/coupon.model';

@Component({
  selector: 'app-membership-billing',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './membership-billing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './membership-billing.scss',
})
export class MembershipBilling implements OnInit {
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef;

  private router = inject(Router);
  private settingService = inject(SettingService);
  private toastService = inject(ToastService);
  private subscriptionService = inject(UserSubscriptionService);
  private attendanceService = inject(AttendanceTrackingService);
  private couponService = inject(CouponService);

  // Data State
  selectedPlan = signal<seletedSubscriptionPlan | null>(null);
  adminUpiId = signal<string>('');
  bankAccountName = signal<string>('');
  isDataReady = signal<boolean>(false);
  isCopied = signal<boolean>(false);

  // UI State
  isFeaturesExpanded = signal<boolean>(false);

  // Coupon State
  couponCode = signal<string>('');
  isCouponApplied = signal<boolean>(false);
  isCouponApplying = signal<boolean>(false);
  discountAmount = signal<number>(0);
  couponError = signal<string | null>(null);
  couponDetails = signal<CouponPreviewResponse | null>(null);

  // --- Professional Coupon Formatting ---
  couponDescription = computed(() => {
    const details = this.couponDetails();
    if (!details) return '';
    return details.discount_type === 'percent'
      ? `${details.discount_value}% Discount`
      : `Flat ₹${details.discount_value} Discount`;
  });

  limitWarningMessage = computed(() => {
    const details = this.couponDetails();
    console.log(details);
    if (!details) return null;

    if (details?.discount_type === 'percent' && details.max_discount) {
      
      const theoreticalDiscount = this.subtotal() * (details.discount_value / 100);
      if (theoreticalDiscount > details.max_discount) {
        return `Max limit reached. Coupon offers ${details.discount_value}% off up to ₹${details.max_discount}.`;
      }
    }
    return null;
  });

  // Coin State
  availableCoins = signal<number>(0);
  isCoinsApplied = signal<boolean>(false);

  coinDiscount = computed(() => {
    if (!this.isCoinsApplied()) return 0;
    return this.availableCoins() / 2;
  });

  // Payment Mode State
  paymentMode = signal<'FULL' | 'SPLIT'>('FULL');

  isSplitAllowed = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return false;
    return plan.plan_price.duration_in_days !== 30;
  });

  // Math
  subtotal = computed(() => this.selectedPlan()?.plan_price.price || 0);
  totalDiscount = computed(() => this.discountAmount() + this.coinDiscount());

  baseInstallment2 = computed(() => Math.floor(this.subtotal() / 2));
  baseInstallment1 = computed(() => this.subtotal() - this.baseInstallment2());

  firstInstallmentDue = computed(() => {
    if (this.paymentMode() === 'FULL') {
      return Math.max(0, this.subtotal() - this.totalDiscount());
    }
    return Math.max(0, this.baseInstallment1() - this.totalDiscount());
  });

  secondInstallmentAmount = computed(() => {
    if (this.paymentMode() === 'FULL') return 0;
    const leftoverDiscount = Math.max(0, this.totalDiscount() - this.baseInstallment1());
    return Math.max(0, this.baseInstallment2() - leftoverDiscount);
  });

  taxAmount = signal<number>(0);
  totalDue = computed(() => {
    return this.firstInstallmentDue() + this.taxAmount();
  });

  // Gateway State
  isPaymentInitiated = signal<boolean>(false);
  transactionId = signal<string>('');
  isProcessing = signal<boolean>(false);
  private intentFired = false;
  private qrCode!: QRCodeStyling;

  async ngOnInit() {
    const navigationState = history.state;

    if (!navigationState || !navigationState.plan) {
      this.router.navigate(['/member/plans']);
      return;
    }

    this.selectedPlan.set(navigationState.plan);

    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      await this.fetchUserCoins(user.id);
    }

    await this.fetchGymSettings();
  }

  private async fetchUserCoins(profileId: string) {
    const coins = await this.attendanceService.fetchCoinBalance(profileId);
    this.availableCoins.set(coins);
  }

  toggleCoins() {
    if (this.availableCoins() < 2) {
      this.toastService.info('Minimum 2 coins required for a discount.');
      return;
    }
    this.isCoinsApplied.update(v => !v);
    setTimeout(() => this.updateQR(), 50);
  }

  private async fetchGymSettings() {
    try {
      const settings = await this.settingService.getSettings();
      if (settings && settings.admin_upi_id) {
        this.adminUpiId.set(settings.admin_upi_id);
        this.bankAccountName.set(settings.bank_account_name || 'Gym Membership');
      } else {
        this.adminUpiId.set('fallback@upi');
        this.bankAccountName.set('Failed to fetch UPI Details');
      }
      this.isDataReady.set(true);
      setTimeout(() => this.initQRCode(), 50);
    } catch (error) {
      console.error('Failed to load gateway settings', error);
    }
  }

  toggleFeatures() {
    this.isFeaturesExpanded.update(v => !v);
  }

  setPaymentMode(mode: 'FULL' | 'SPLIT') {
    if (mode === 'SPLIT' && !this.isSplitAllowed()) return;
    this.paymentMode.set(mode);
    setTimeout(() => this.updateQR(), 50);
  }

  private getSecureUpiUrl(): string {
   const amount = Number(this.totalDue()).toFixed(2);

  const params = new URLSearchParams({
    pa: this.adminUpiId().trim(),
    pn: this.bankAccountName().trim(),
    am: amount,
    cu: "INR",
    mode: "04"
  });

  return `upi://pay?${params.toString()}`;
  }

  private initQRCode() {
    this.qrCode = new QRCodeStyling({
      width: 280,
      height: 280,
      type: "svg",
      data: this.getSecureUpiUrl(),
      margin: 0,
      image: "assets/gym_logo_transperant.png",
      dotsOptions: { color: "var(--foreground)", type: "dots" },
      cornersSquareOptions: { color: "var(--primary)", type: "extra-rounded" },
      backgroundOptions: { color: "transparent" },
      imageOptions: { crossOrigin: "anonymous", margin: 5, imageSize: 0.35 }
    });

    if (this.qrCanvas) {
      this.qrCode.append(this.qrCanvas.nativeElement);
    }
  }

  private updateQR() {
    if (this.qrCode) {
      this.qrCode.update({ data: this.getSecureUpiUrl() });
    }
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.hidden && this.intentFired) {
      this.isPaymentInitiated.set(true);
      this.intentFired = false;
    }
  }

  openUpiApp() {
    if (this.totalDue() <= 0) return;
    this.intentFired = true;
    window.location.href = this.getSecureUpiUrl();
    setTimeout(() => { this.intentFired = false; }, 5000);
  }

  async applyCoupon() {
    this.couponError.set(null);
    this.couponDetails.set(null);
    const code = this.couponCode().trim().toUpperCase();

    if (!code) return;

    this.isCouponApplying.set(true);

    try {
      const result = await this.couponService.previewCoupon(code, this.subtotal());

      if (result.is_valid) {
        this.isCouponApplied.set(true);
        this.discountAmount.set(result.discount_amount);
        this.couponDetails.set(result);

        // FIX: Update the actual signal to the clean, uppercase value so it's sent properly!
        this.couponCode.set(code);

        this.updateQR();
        this.toastService.success('Coupon Applied Successfully');
      } else {
        this.isCouponApplied.set(false);
        this.discountAmount.set(0);
        this.couponError.set(result.message);
      }
    } catch (error) {
      this.couponError.set('Failed to validate coupon. Please check your connection.');
    } finally {
      this.isCouponApplying.set(false);
    }
  }

  removeCoupon() {
    this.isCouponApplied.set(false);
    this.discountAmount.set(0);
    this.couponCode.set('');
    this.couponError.set(null);
    this.couponDetails.set(null);
    this.updateQR();
  }

  async confirmPayment() {
    const userRaw = localStorage.getItem("user");

    if (!userRaw) {
      this.toastService.danger('Session expired. Please log in again.');
      this.router.navigate(['/auth/login']);
      return;
    }

    const user = JSON.parse(userRaw);
    const utr = this.transactionId().trim();
    const plan = this.selectedPlan();

    if (utr.length < 8 || !plan) {
      this.toastService.danger('Invalid Transaction ID. Please verify and try again.');
      return;
    }

    this.isProcessing.set(true);

    try {
      const coinsToUse = this.isCoinsApplied() ? this.availableCoins() : 0;
      const features = [...plan.plan_features];

      // FIX: Ensure we send the cleanly trimmed and uppercase version to the DB
      const rawCode = this.couponCode();
      const codeToApply = this.isCouponApplied() && rawCode ? rawCode.trim().toUpperCase() : null;
      const discountToApply = this.isCouponApplied() ? this.discountAmount() : 0;

      await this.subscriptionService.checkoutSubscription(
        user.id,
        plan.id,
        plan.plan_price.id,
        utr,
        this.paymentMode(),
        coinsToUse,
        features,
        codeToApply,
        discountToApply
      );

      this.toastService.success('Payment verified successfully.');
      this.router.navigate(['/member/dashboard']);
    } catch (error: any) {
      console.error('Submission Error:', error);
      const msg = error?.message || 'Submission failed. Please try again.';
      this.toastService.danger(msg);
    } finally {
      this.isProcessing.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/member/plans']);
  }

  async copyUpiId(): Promise<void> {
    const upiId = this.adminUpiId();
    
    // Safety check in case the signal is empty
    if (!upiId) return; 

    try {
      // Use the modern Clipboard API
      await navigator.clipboard.writeText(upiId);
      
      // Set to true to show the checkmark
      this.isCopied.set(true);

      // Revert back to the copy icon after 2 seconds
      setTimeout(() => {
        this.isCopied.set(false);
      }, 2000);

      this.toastService.success('UPI ID has been copied.');
      
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }
}
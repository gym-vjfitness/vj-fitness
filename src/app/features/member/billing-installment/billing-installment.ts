import { Component, OnInit, ElementRef, ViewChild, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import QRCodeStyling from 'qr-code-styling';
import { UserSubscriptionService } from '../../../services/user-subscription-service';
import { SettingService } from '../../../services/setting-service';
import { ToastService } from '../../../services/toast-service';
import { SubscriptionPayment } from '../../../models/user-subscription.model';

@Component({
  selector: 'app-billing-installment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './billing-installment.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './billing-installment.scss',
})
export class BillingInstallment implements OnInit {
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef;

  private subService = inject(UserSubscriptionService);
  private settingService = inject(SettingService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  isLoading = signal<boolean>(true);
  isProcessing = signal<boolean>(false);
  isCopied = signal<boolean>(false);
  
  // Data
  subscription = signal<any | null>(null);
  payments = signal<SubscriptionPayment[]>([]);
  
  // Gateway Settings
  adminUpiId = signal<string>('');
  bankAccountName = signal<string>('');
  private qrCode!: QRCodeStyling;

  // Payment UI State
  activePendingPayment = signal<SubscriptionPayment | null>(null);
  showPaymentModal = signal<boolean>(false);
  newUtrNumber = signal<string>('');
  
  // Rejection Resubmission State
  isSubmittingRejectedUtr = signal<boolean>(false);

  // Computed Check to see if they owe money
  duePayment = computed(() => {
    return this.payments().find(p => p.status === 'PENDING') || null;
  });

  // Computed Check to see if the 2nd Installment was rejected
  rejectedPayment = computed(() => {
    return this.payments().find(p => p.status === 'REJECTED' && p.installment_number === 2) || null;
  });

  async ngOnInit() {
    const userRaw = localStorage.getItem("user");
    if (!userRaw) {
      this.router.navigate(['/auth/login']);
      return;
    }

    const user = JSON.parse(userRaw);
    await this.loadDashboardData(user.id);
    await this.fetchGymSettings();
  }

  async loadDashboardData(profileId: string) {
    this.isLoading.set(true);
    try {
      const subs = await this.subService.getUserSubscriptions(profileId);
      if (subs && subs.length > 0) {
        const currentSub = subs[0]; 
        this.subscription.set(currentSub);
        
        const payData = await this.subService.getSubscriptionPayments(currentSub.id);
        this.payments.set(payData);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      this.toastService.danger('Failed to load your membership details.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async fetchGymSettings() {
    try {
      const settings = await this.settingService.getSettings();
      if (settings && settings.admin_upi_id) {
        this.adminUpiId.set(settings.admin_upi_id);
        this.bankAccountName.set(settings.bank_account_name || 'Gym Admin');
      }
    } catch (error) {
      console.error('Failed to load settings', error);
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // --- Rejected UTR Submitting Logic ---
  sanitizeAlphanumeric(event: Event, inputEl: HTMLInputElement) {
    const start = inputEl.selectionStart;
    const originalValue = inputEl.value;
    const sanitized = originalValue.replace(/[^a-zA-Z0-9]/g, '');
    
    if (originalValue !== sanitized) {
      inputEl.value = sanitized;
      const diff = originalValue.length - sanitized.length;
      const newPos = start ? Math.max(0, start - diff) : 0;
      inputEl.setSelectionRange(newPos, newPos);
    }
  }

  async submitRejectedUtr(paymentId: string, inputElement: HTMLInputElement) {
    const newUtr = inputElement.value.trim();
    const userRaw = localStorage.getItem("user");
    const sub = this.subscription();

    if (!newUtr || !userRaw || !sub) return;
    const user = JSON.parse(userRaw);

    this.isSubmittingRejectedUtr.set(true);
    try {
      await this.subService.reSubmitRejectedSecondInstallment(paymentId, newUtr, sub.id, user.id);
      
      // Intentional 4-second delay to let the animation play out nicely
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Refresh the data so the UI updates to "PENDING_VERIFICATION"
      await this.loadDashboardData(user.id);
      
      // ✅ FIX: Added the missing success toast right here
      this.toastService.success('Transaction details submitted!');
      
    } catch (error) {
      console.error('Error submitting UTR:', error);
      this.toastService.danger('Failed to submit transaction details!');
    } finally {
      this.isSubmittingRejectedUtr.set(false);
      inputElement.value = '';
    }
  }

  // --- Payment Modal Logic ---
  openPaymentModal(payment: SubscriptionPayment) {
    this.activePendingPayment.set(payment);
    this.showPaymentModal.set(true);
    this.newUtrNumber.set('');
    
    setTimeout(() => this.initQRCode(payment.amount), 100);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
    this.activePendingPayment.set(null);
  }

  private getSecureUpiUrl(amount: number): string {
    const safeUpi = encodeURIComponent(this.adminUpiId());
    const safeName = encodeURIComponent(this.bankAccountName().replace(/[^a-zA-Z0-9 ]/g, ''));
    return `upi://pay?pa=${safeUpi}&pn=${safeName}&am=${amount.toFixed(2)}&cu=INR&tn=GymInstallment`;
  }

  private initQRCode(amount: number) {
    this.qrCode = new QRCodeStyling({
      width: 220,
      height: 220,
      type: "svg",
      data: this.getSecureUpiUrl(amount),
      margin: 0,
      image: "assets/gym_logo_transperant.png",
      dotsOptions: { color: "var(--foreground)", type: "dots" },
      cornersSquareOptions: { color: "var(--primary)", type: "extra-rounded" },
      backgroundOptions: { color: "transparent" },
      imageOptions: { crossOrigin: "anonymous", margin: 5, imageSize: 0.35 }
    });

    if (this.qrCanvas && this.qrCanvas.nativeElement) {
      this.qrCanvas.nativeElement.innerHTML = ''; 
      this.qrCode.append(this.qrCanvas.nativeElement);
    }
  }

  openUpiApp() {
    const payment = this.activePendingPayment();
    if (!payment) return;
    window.location.href = this.getSecureUpiUrl(payment.amount);
  }

  async submitInstallment() {
    const payment = this.activePendingPayment();
    const utr = this.newUtrNumber().trim();

    if (!payment || utr.length < 8) {
      this.toastService.danger('Please enter a valid 12-digit UTR number.');
      return;
    }

    this.isProcessing.set(true);
    try {
      await this.subService.submitInstallmentUtr(payment.id, utr);
      this.toastService.success('Verification submitted successfully!');
      
      this.closePaymentModal();
      
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        await this.loadDashboardData(JSON.parse(userRaw).id);
      }
    } catch (error) {
      this.toastService.danger('Failed to submit UTR. Please try again.');
    } finally {
      this.isProcessing.set(false);
    }
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
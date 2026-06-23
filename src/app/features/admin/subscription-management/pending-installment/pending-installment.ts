import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserSubscriptionService } from '../../../../services/user-subscription-service';
import { SupabaseService } from '../../../../services/supabase-service';

@Component({
  selector: 'app-pending-installment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './pending-installment.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pending-installment.scss',
})
export class PendingInstallment implements OnInit {
  private subscriptionService = inject(UserSubscriptionService);
  private router = inject(Router);
  private datePipe = inject(DatePipe);
  private supabaseService = inject(SupabaseService);
  role = this.supabaseService.currentUser()?.user_role || 'member';

  isLoading = signal<boolean>(true);
  isSearching = signal<boolean>(false);

  // State
  installments = signal<any[]>([]);
  totalCount = signal<number>(0);

  currentPage = signal<number>(1);
  pageSize = 10;

  searchInput = signal<string>('');

  // --- Computed Signals for Pagination UI ---
  startIndex = computed(() => this.totalCount() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1);
  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize, this.totalCount()));
  totalItems = computed(() => this.totalCount());
  hasPrevPage = computed(() => this.currentPage() > 1);
  hasNextPage = computed(() => this.currentPage() < this.totalPages);

  ngOnInit() {
    const savedState = this.subscriptionService.pendingState;
    this.currentPage.set(savedState.page || 1);
    this.searchInput.set(savedState.searchTerm || '');
    this.loadData();
  }

  async loadData(forceRefresh = false) {
    this.isLoading.set(true);
    try {
      const result = await this.subscriptionService.getPaginatedPendingInstallments(
        this.currentPage(),
        this.pageSize,
        this.searchInput().trim(),
        forceRefresh
      );

      this.installments.set(result.data);
      this.totalCount.set(result.count);
    } catch (error) {
      console.error('Error loading pending installments:', error);
    } finally {
      this.isLoading.set(false);
      this.isSearching.set(false);
    }
  }

  performSearch() {
    this.isSearching.set(true);
    this.currentPage.set(1);
    this.loadData(true);
  }

  clearSearch() {
    this.searchInput.set('');
    if (this.subscriptionService.pendingState.searchTerm !== '') {
      this.performSearch();
    }
  }


  formatINR(amount: number): string {
    if (!amount) return '0';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount() / this.pageSize) || 1;
  }

  goToNextPage() {
    if (this.currentPage() < this.totalPages) {
      this.currentPage.update(p => p + 1);
      this.loadData(true);
    }
  }

  goToPrevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadData(true);
    }
  }

  goToSubscription(subscriptionId: string) {
    this.router.navigate([`/${this.role}/subscription/detail`, subscriptionId]);
  }

  // --- NEW: Overdue Calculation Method ---
  getDueDateStatus(dueDateStr: string): { text: string; isOverdue: boolean } {
    const dueDate = new Date(dueDateStr);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diff = today.getTime() - dueDate.getTime();
    const days = Math.floor(diff / (1000 * 3600 * 24));

    if (days > 0) {
      // Past due
      return { text: `${days} ${days === 1 ? 'Day' : 'Days'} Overdue`, isOverdue: true };
    } else if (days === 0) {
      // Due today
      return { text: 'Due Today', isOverdue: false };
    } else {
      // Future due date
      const daysLeft = Math.abs(days);
      return { text: `${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'} Left`, isOverdue: false };
    }
  }

  openWhatsApp(user: any, event: Event) {
    event.stopPropagation();
    if (!user.phone) {
      alert('No phone number recorded for this user.');
      return;
    }

    const dueDate = new Date(user.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = today.getTime() - dueDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    const formattedDate = this.datePipe.transform(dueDate, 'mediumDate');
    const formattedAmt = this.formatINR(user.amount);
    let message = '';

    if (daysDiff > 0) {
      const dayStr = daysDiff === 1 ? '1 day' : `${daysDiff} days`;
      message = `Hello ${user.fullName}, ⏳\n\nThis is a polite reminder from the gym. Your 2nd subscription installment of ₹${formattedAmt} was due on *${formattedDate}* and is currently *${dayStr} overdue*.\n\nPlease clear the pending dues at your earliest convenience to ensure uninterrupted access. Let us know if you need any assistance!\n\nThank you, 💪`;
    } else if (daysDiff === 0) {
      message = `Hello ${user.fullName}, ⏳\n\nThis is a gentle reminder that your 2nd subscription installment of ₹${formattedAmt} is due *today* (*${formattedDate}*).\n\nPlease complete the payment to maintain your access. Keep pushing your limits! 🏋️‍♂️✨`;
    } else {
      const daysUntil = Math.abs(daysDiff);
      const dayStr = daysUntil === 1 ? '1 day' : `${daysUntil} days`;
      message = `Hello ${user.fullName}, 👋\n\nHope you're having a great workout week!\n\nThis is a gentle reminder that your 2nd subscription installment of ₹${formattedAmt} is scheduled for *${formattedDate}* (in ${dayStr}).\n\nKeep up the great work! 🏋️‍♂️✨`;
    }

    const encodedMessage = encodeURIComponent(message);
    let cleanPhone = user.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) { cleanPhone = '91' + cleanPhone; }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
    } else {
      window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  }
}
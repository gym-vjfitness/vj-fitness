import { Component, inject, OnInit, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CouponService } from '../../../services/coupon-service';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service';
import { CouponDTO } from '../../../models/coupon.model';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-coupon-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupon-management.html',
})
export class CouponManagement implements OnInit {
  private couponService = inject(CouponService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  role = this.supabaseService.currentUser()?.user_role || 'member';

  // State
  coupons = signal<Partial<CouponDTO>[]>([]);
  isLoading = signal<boolean>(true);

  // --- THE FIX: Search & Filter Variables matched to HTML ---
  searchQuery = signal<string>('');
  private activeSearchQuery = signal<string>('');

  filteredCoupons = computed(() => {
    const query = this.activeSearchQuery().toLowerCase().trim();
    const all = this.coupons();
    if (!query) return all;
    return all.filter(c => c.code?.toLowerCase().includes(query));
  });

  // Pagination
  currentPage = signal<number>(1);
  itemsPerPage = 10;

  paginatedCoupons = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.filteredCoupons().slice(start, start + this.itemsPerPage);
  });

  startIndex = computed(() => this.filteredCoupons().length === 0 ? 0 : (this.currentPage() - 1) * this.itemsPerPage + 1);
  endIndex = computed(() => Math.min(this.currentPage() * this.itemsPerPage, this.filteredCoupons().length));
  totalItems = computed(() => this.filteredCoupons().length);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.itemsPerPage) || 1);

  // Floating Menu State
  openMenuId = signal<string | null>(null);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.action-menu')) {
      this.openMenuId.set(null);
    }
  }

  async ngOnInit() {
    await this.loadCoupons();
  }

  async loadCoupons(forceRefresh = false) {
    this.isLoading.set(true);
    try {
      const data = await this.couponService.getCoupons(forceRefresh);
      this.coupons.set(data);
    } catch (error) {
      this.toastService.error('Failed to load coupons');
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- THE FIX: Missing Search Methods Added ---
  onSearchChange(term: string) {
    this.searchQuery.set(term);
  }

  performSearch() {
    this.activeSearchQuery.set(this.searchQuery());
    this.currentPage.set(1);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.activeSearchQuery.set('');
    this.currentPage.set(1);
  }

  toggleMenu(id: string | undefined, event: Event) {
    event.stopPropagation();
    if (!id) return;
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  // --- ACTIONS ---

  goToCreatePlan() {
    this.router.navigate([`/${this.role}/setting/coupon/create`]);
  }

  editPlan(id: string | undefined) {
    if (!id) return;
    this.router.navigate([`/${this.role}/setting/coupon/update`, id]);
  }

  async toggleStatus(coupon: Partial<CouponDTO>) {
    this.openMenuId.set(null);
    const newStatus = !coupon.is_active;
    const actionText = newStatus ? 'activate' : 'deactivate';

    const confirmed = await this.dialogService.open({
      title: `${newStatus ? 'Activate' : 'Deactivate'} Coupon`,
      message: `Are you sure you want to ${actionText} "${coupon.code}"?`,
      mode: 'warning',
      confirmText: newStatus ? 'Activate' : 'Deactivate',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      await this.couponService.toggleCouponStatus(coupon.id!, newStatus);
      this.toastService.success(`Coupon ${actionText}d successfully`);
      await this.loadCoupons(true);
    } catch (error) {
      this.toastService.error('Failed to update status');
    }
  }

  async deletePlan(coupon: Partial<CouponDTO>) {
    this.openMenuId.set(null);
    const confirmed = await this.dialogService.open({
      title: 'Delete Coupon',
      message: `Are you sure you want to delete "${coupon.code}"? It will be removed permanently.`,
      mode: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      await this.couponService.deleteCoupon(coupon.id!);
      this.toastService.success('Coupon deleted permanently');
      await this.loadCoupons(true);
    } catch (error) {
      this.toastService.error('Failed to delete coupon');
    }
  }

  // Pagination Checks
  hasNextPage = computed(() => this.currentPage() < this.totalPages());
  hasPrevPage = computed(() => this.currentPage() > 1);

  goToNextPage() { if (this.hasNextPage()) this.currentPage.update(p => p + 1); }
  goToPrevPage() { if (this.hasPrevPage()) this.currentPage.update(p => p - 1); }
}
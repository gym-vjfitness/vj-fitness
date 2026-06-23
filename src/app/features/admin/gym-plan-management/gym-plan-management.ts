import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GymPlanService } from '../../../services/gym-plan-service';
import { GymPlanDTO } from '../../../models/gym-plan.model';
import { DialogService } from '../../../services/dialog-service';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast-service';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-gym-plan-management',
  standalone: true,
  imports: [FormsModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gym-plan-management.html',
})
export class GymPlanManagement implements OnInit {
  private planService = inject(GymPlanService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  // State Signals (Linked to Service for Cache Preservation)
  plans = this.planService.plans;
  totalItems = this.planService.totalItems;
  currentPage = this.planService.currentPage;
  pageSize = this.planService.pageSize;
  searchTerm = this.planService.searchTerm;
  searchInput = this.planService.searchInput;

  isLoading = signal<boolean>(true);
  
  // Track which card's 3-dots menu is open
  openMenuId = signal<string | null>(null);

  // Pagination Computed Values
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  hasNextPage = computed(() => this.currentPage() < this.totalPages());
  hasPrevPage = computed(() => this.currentPage() > 1);

  startIndex = computed(() => {
    if (this.totalItems() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.totalItems());
  });

  ngOnInit() {
    // Only load from API if we haven't loaded data yet
    if (!this.planService.hasLoaded()) {
      this.loadPlans();
    } else {
      // Data is already cached in service, just stop loading spinner
      this.isLoading.set(false);
    }
  }

  async loadPlans() {
    this.isLoading.set(true);
    try {
      const response = await this.planService.getPaginatedPlans(
        this.searchTerm(),
        this.currentPage(),
        this.pageSize()
      );
      this.plans.set(response.data);
      this.totalItems.set(response.total);
      
      // Mark as loaded so it doesn't refetch on tab switch
      this.planService.hasLoaded.set(true); 
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  performSearch() {
    this.searchTerm.set(this.searchInput());
    this.currentPage.set(1);
    this.loadPlans();
  }

  clearSearch() {
    this.searchInput.set('');
    
    // Only call the API if the text we are clearing was ACTUALLY searched and applied
    if (this.searchTerm() !== '') {
      this.searchTerm.set('');
      this.currentPage.set(1);
      this.loadPlans();
    }
  }

  goToCreatePlan() {
    this.router.navigate([`/${this.role}/gym-plan/create`]);
  }

  // Menu Handlers
  toggleMenu(planId: string) {
    this.openMenuId.update(id => id === planId ? null : planId);
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  // Actions
  viewPlan(id: string) {
    this.router.navigate([`/${this.role}/gym-plan/details`, id])
    this.closeMenu();
  }

  editPlan(id: string) {
    this.router.navigate([`/${this.role}/gym-plan/update`, id]);
    this.closeMenu();
  }

  async changeGymPlanStatus(id: string, activeStatus: boolean) {
    let msgString = activeStatus ? 'activated' : 'deactivated';
    
    const confirmed = await this.dialogService.open({
      title: activeStatus ? `Activate` : `De-Activate`,
      message: activeStatus ? `Do you really want to activate this Subscription Plan?` : `This plan will be hidden from new users. Existing subscriptions will remain active.`,
      mode: activeStatus ? 'normal' : 'delete',
      confirmText: activeStatus ? `Activate` : `De-Activate`,
      cancelText: 'Cancel'
    });

    if (confirmed) {
       try {
         await this.planService.togglePlanStatus(id, activeStatus);
         this.toastService.success(`Plan ${msgString} successfully!`);
         this.loadPlans();
       } catch(err) {
         this.toastService.error(`Failed to update plan status.`);
       }
    }

    this.closeMenu();
  }

  async deletePlan(id: string) {
    const confirmed = await this.dialogService.open({
      title: 'Delete Plan',
      message: 'Are you sure you want to permanently delete this plan? This action cannot be undone.',
      mode: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        await this.planService.deletePlan(id);
        this.toastService.success('Plan deleted successfully!');
        this.loadPlans();
      } catch (err) {
        this.toastService.error('Failed to delete plan. It might be tied to existing subscriptions.');
      }
    }
    this.closeMenu();
  }

  // Pagination Methods
  goToNextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
      this.loadPlans();
    }
  }

  goToPrevPage() {
    if (this.hasPrevPage()) {
      this.currentPage.update(p => p - 1);
      this.loadPlans();
    }
  }
}
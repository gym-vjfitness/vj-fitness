import { Component, OnInit, inject, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DietService } from '../../../services/diet-service';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-diet-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diet-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './diet-management.scss',
})
export class DietManagement implements OnInit {
  private dietService = inject(DietService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  // State Management
  dietPlans = signal<{ id: string; title: string }[]>([]);
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  
  searchTerm = signal<string>('');
  searchInput = signal<string>('');
  
  isLoading = signal<boolean>(true);
  openMenuId = signal<string | null>(null);

  // Pagination Computations
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

  async ngOnInit() {
    // Check in-memory cache to prevent unwanted API calls on tab switch
    const cache = this.dietService.listState ? this.dietService.listState() : null;
    
    if (cache) {
      this.dietPlans.set(cache.data);
      this.totalItems.set(cache.total);
      this.currentPage.set(cache.page);
      this.searchTerm.set(cache.search);
      this.searchInput.set(cache.search);
      this.isLoading.set(false);
    } else {
      await this.loadPlans();
    }
  }

  // Closes the 3-dots action menu when clicking anywhere else on the document
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.action-menu')) {
      this.closeMenu();
    }
  }

  async loadPlans() {
    this.isLoading.set(true);
    try {
      const res = await this.dietService.getPaginatedPlans(
        this.currentPage(),
        this.pageSize(),
        this.searchTerm()
      );
      this.dietPlans.set(res.data);
      this.totalItems.set(res.total);
      
      // Update cache
      if (this.dietService.listState) {
        this.dietService.listState.set({
          data: res.data,
          total: res.total,
          page: this.currentPage(),
          search: this.searchTerm()
        });
      }
    } catch (error) {
      console.error('Error fetching diets:', error);
      this.toastService.danger('Failed to load Diet Plans.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Search Logic
  performSearch() {
    this.searchTerm.set(this.searchInput().trim());
    this.currentPage.set(1);
    this.loadPlans();
  }

  clearSearch() {
    this.searchInput.set('');
    if (this.searchTerm() !== '') {
      this.searchTerm.set('');
      this.currentPage.set(1);
      this.loadPlans();
    }
  }

  // 3-Dots Menu Logic
  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId.update(current => current === id ? null : id);
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  // Actions
  goToCreatePlan() {
    this.router.navigate([`/${this.role}/diet/create`]);
  }

  viewPlan(id: string) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/diet/details`, id]);
  }

  editPlan(id: string) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/diet/update`, id]);
  }

  async deletePlan(plan: { id: string; title: string }) {
    this.closeMenu();
    const confirmed = await this.dialogService.open({
      title: 'Delete Diet Plan',
      message: `Are you sure you want to delete "${plan.title}"? This action cannot be undone.`,
      mode: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        await this.dietService.deleteDietPlan(plan.id);
        this.toastService.success('Diet Plan deleted successfully!');
        
        // Go back a page if deleting the last item on the current page
        if (this.dietPlans().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }
        this.loadPlans();
      } catch (err) {
        this.toastService.danger('Failed to delete Diet Plan.');
      }
    }
  }

  // Pagination Navigation
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
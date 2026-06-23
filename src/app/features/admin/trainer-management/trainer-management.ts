import { Component, OnInit, inject, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TrainerService } from '../../../services/trainer-service';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-trainer-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trainer-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './trainer-management.scss',
})
export class TrainerManagement implements OnInit {
  private trainerService = inject(TrainerService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private supabaseService = inject(SupabaseService);
  
  role = this.supabaseService.currentUser()?.user_role || 'admin';

  // State Management
  trainers = signal<{ id: string; full_name: string }[]>([]);
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
    const cache = this.trainerService.listState ? this.trainerService.listState() : null;
    
    if (cache) {
      this.trainers.set(cache.data);
      this.totalItems.set(cache.total);
      this.currentPage.set(cache.page);
      this.searchTerm.set(cache.search);
      this.searchInput.set(cache.search);
      this.isLoading.set(false);
    } else {
      await this.loadTrainers();
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

  async loadTrainers() {
    this.isLoading.set(true);
    try {
      const res = await this.trainerService.getPaginatedTrainers(
        this.currentPage(),
        this.pageSize(),
        this.searchTerm()
      );
      this.trainers.set(res.data);
      this.totalItems.set(res.total);
      
      // Update cache
      if (this.trainerService.listState) {
        this.trainerService.listState.set({
          data: res.data,
          total: res.total,
          page: this.currentPage(),
          search: this.searchTerm()
        });
      }
    } catch (error) {
      console.error('Error fetching trainers:', error);
      this.toastService.danger('Failed to load Trainers.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Search Logic (Triggers only on Enter or Button Click)
  performSearch() {
    this.searchTerm.set(this.searchInput().trim());
    this.currentPage.set(1);
    this.loadTrainers();
  }

  clearSearch() {
    this.searchInput.set('');
    // Only fetch if we actually had an active search to prevent unwanted calls
    if (this.searchTerm() !== '') {
      this.searchTerm.set('');
      this.currentPage.set(1);
      this.loadTrainers();
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


  viewTrainer(id: string) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/trainers/access`, id]);
  }

  editTrainer(id: string) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/trainers/update`, id]);
  }

  async deleteTrainer(trainer: { id: string; full_name: string }) {
    this.closeMenu();
    const confirmed = await this.dialogService.open({
      title: 'Delete Trainer',
      message: `Are you sure you want to delete "${trainer.full_name}"? Their assigned members will automatically be unassigned.`,
      mode: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        await this.trainerService.deleteTrainer(trainer.id);
        this.toastService.success('Trainer deleted successfully!');
        
        // Go back a page if deleting the last item on the current page
        if (this.trainers().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }
        this.loadTrainers();
      } catch (err) {
        this.toastService.danger('Failed to delete Trainer.');
      }
    }
  }

  // Pagination Navigation
  goToNextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
      this.loadTrainers();
    }
  }

  goToPrevPage() {
    if (this.hasPrevPage()) {
      this.currentPage.update(p => p - 1);
      this.loadTrainers();
    }
  }
}
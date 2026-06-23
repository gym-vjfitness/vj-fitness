import { Component, inject, OnInit, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkoutService } from '../../../services/workout-service';
import { DialogService } from '../../../services/dialog-service';
import { ToastService } from '../../../services/toast-service';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../services/supabase-service';

// Updated interface (No goal_type)
export interface WorkoutMetaDataDto {
  id?: string;
  heading: string;
  difficulty_level: string;
  target_audience: string;
}

@Component({
  selector: 'app-workout-management',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './workout-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './workout-management.scss',
})
export class WorkoutManagement implements OnInit {
  workoutService = inject(WorkoutService);
  dialogService = inject(DialogService);
  toastService = inject(ToastService);
  router = inject(Router);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  workouts = this.workoutService.workouts;
  totalCount = this.workoutService.totalItems;
  currentPage = this.workoutService.currentPage;
  pageSize = this.workoutService.pageSize;
  searchTerm = this.workoutService.searchTerm;
  searchInput = this.workoutService.searchInput;
  
  isLoading = signal(true);
  openMenuId = signal<string | null>(null);

  startIndex = computed(() => {
    if (this.totalCount() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });
  
  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalCount()));
  hasNextPage = computed(() => this.endIndex() < this.totalCount());
  hasPrevPage = computed(() => this.currentPage() > 1);

  ngOnInit() {
    if (!this.workoutService.hasLoaded()) {
      this.loadWorkouts();
    } else {
      this.isLoading.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.action-menu')) {
      this.closeMenu();
    }
  }

  async loadWorkouts() {
    this.isLoading.set(true);
    try {
      const { data, count, error } = await this.workoutService.getPaginatedWorkouts(
        this.currentPage(), 
        this.pageSize(),
        this.searchTerm()
      );
      if (error) throw error;
      
      this.workouts.set(data || []);
      this.totalCount.set(count);
      this.workoutService.hasLoaded.set(true);
    } catch (error) {
      this.toastService.error("Failed to fetch Workout Plans!");
    } finally {
      this.isLoading.set(false);
    }
  }

  performSearch() {
    this.searchTerm.set(this.searchInput());
    this.currentPage.set(1);
    this.loadWorkouts();
  }

  clearSearch() {
    this.searchInput.set('');
    if (this.searchTerm() !== '') {
      this.searchTerm.set('');
      this.currentPage.set(1);
      this.loadWorkouts();
    }
  }

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId.update(current => current === id ? null : id);
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  nextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
      this.loadWorkouts();
    }
  }

  prevPage() {
    if (this.hasPrevPage()) {
      this.currentPage.update(p => p - 1);
      this.loadWorkouts();
    }
  }

  onViewDetails(workout: WorkoutMetaDataDto) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/workout/details`, workout.id]);
  }

  onEditPlan(workout: WorkoutMetaDataDto) {
    this.closeMenu();
    // Strictly matching your requested updated path
    this.router.navigate([`/${this.role}/workout/update`, workout.id]);
  }

  async onDeletePlan(workout: WorkoutMetaDataDto) {
    this.closeMenu();
    const confirmed = await this.dialogService.open({
      title: `Delete Workout`,
      message: `Are you sure you want to delete '${workout.heading}' permanently?`,
      mode: 'delete',
      confirmText: `Delete`,
      cancelText: 'Cancel'
    });

    if (confirmed) {
      const { error } = await this.workoutService.deleteWorkoutPlan(workout.id!);
      if (error) {
        this.toastService.error('Failed to delete workout.');
      } else {
        this.toastService.success('Workout Plan deleted successfully!');
        if (this.workouts().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }
        this.loadWorkouts();
      }
    }
  }
}
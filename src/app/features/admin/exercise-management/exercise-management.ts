import { Component, OnInit, inject, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ExerciseService } from './../../../services/exercise-service';
import { ToastService } from './../../../services/toast-service';
import { DialogService } from './../../../services/dialog-service';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-exercise-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exercise-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './exercise-management.scss',
})
export class ExerciseManagement implements OnInit {
  private exerciseService = inject(ExerciseService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  exercises = this.exerciseService.exercises;
  totalItems = this.exerciseService.totalItems;
  currentPage = this.exerciseService.currentPage;
  pageSize = this.exerciseService.pageSize;
  searchTerm = this.exerciseService.searchTerm;
  searchInput = this.exerciseService.searchInput;
  selectedMuscleGroup = this.exerciseService.selectedMuscleGroup;

  isLoading = signal<boolean>(true);
  isFilterDropdownOpen = signal<boolean>(false);
  
  // Tracks which table row's 3-dots menu is currently open
  openMenuId = signal<string | null>(null);

  muscleGroups = [
    { name: 'All Muscles', colorClass: 'text-foreground border-border bg-surface', path: 'M4 6h16M4 12h16M4 18h16' },
    { name: 'Biceps', colorClass: 'text-accent border-accent/30 bg-accent/10', path: 'M12 8v12 M7 8h10 M4 5l3 3v5 M20 5l-3 3v5 M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z' },
    { name: 'Chest', colorClass: 'text-danger border-danger/30 bg-danger/10', path: 'M6 6c3-1 9-1 12 0 1.5 3.5 1.5 7.5 0 11-3 1.5-9 1.5-12 0C4.5 13.5 4.5 9.5 6 6z M12 5v13 M6 10.5c2.5 1 4.5 1 6 0 1.5 1 3.5 1 6 0 M8 6v4 M16 6v4' },
    { name: 'Back', colorClass: 'text-warning border-warning/30 bg-warning/10', path: 'M12 21L5 12c0-3 2-5 7-5s7 2 7 5l-7 9z M12 7v14 M7 12c1.5 1.5 3.5 2 5 2s3.5-.5 5-2' },
    { name: 'Legs', colorClass: 'text-primary border-primary/30 bg-primary/10', path: 'M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M12 6v6l-4 4v5 M12 12l4 4v5 M7 16h10 M8 12l-3-3 M16 12l3-3 M5 21h14' },
    { name: 'Core', colorClass: 'text-success border-success/30 bg-success/10', path: 'M7 5c0-1.5 1-2.5 2.5-2.5h5C16 2.5 17 3.5 17 5v14c0 1.5-1 2.5-2.5 2.5h-5C8 21.5 7 20.5 7 19V5z M7 10h10 M7 15h10 M12 2.5v19' },
    { name: 'Shoulders', colorClass: 'text-info border-info/30 bg-info/10', path: 'M4 11c0-4 3-7 8-7s8 3 8 7v4c0 1.5-1 3-3 3H7c-2 0-3-1.5-3-3v-4z M12 4v14 M4 11h16 M8 4l-4 7 M16 4l4 7' },
    { name: 'Triceps', colorClass: 'text-accent border-accent/30 bg-accent/10', path: 'M12 8v12 M7 8h10 M4 5l3 3v5 M20 5l-3 3v5 M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z' },
    { name: 'Full Body', colorClass: 'text-secondary border-secondary/30 bg-secondary/10', path: 'M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 7v6 M5 6l5 3 M19 6l-5 3 M6 21l4-8 M18 21l-4-8' },
    { name: 'Cardio', colorClass: 'text-danger border-danger/30 bg-danger/10', path: 'M22 12h-4l-3 9L9 3l-3 9H2' }
  ];

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
    if (!this.exerciseService.hasLoaded()) {
      this.loadExercises();
    } else {
      this.isLoading.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    // Close filter dropdown if clicked outside
    if (!target.closest('.filter-dropdown')) {
      this.isFilterDropdownOpen.set(false);
    }
    // Close 3-dots action menu if clicked outside
    if (!target.closest('.action-menu')) {
      this.closeMenu();
    }
  }

  async loadExercises() {
    this.isLoading.set(true);
    try {
      const response = await this.exerciseService.getExercises(
        this.currentPage(),
        this.pageSize(),
        this.searchTerm(),
        this.selectedMuscleGroup()
      );
      this.exercises.set(response.data);
      this.totalItems.set(response.count);
      this.exerciseService.hasLoaded.set(true);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      this.toastService.error('Failed to load exercises.');
    } finally {
      this.isLoading.set(false);
    }
  }

  performSearch() {
    this.searchTerm.set(this.searchInput());
    this.currentPage.set(1);
    this.loadExercises();
  }

  clearSearch() {
    this.searchInput.set('');
    if (this.searchTerm() !== '') {
      this.searchTerm.set('');
      this.currentPage.set(1);
      this.loadExercises();
    }
  }

  toggleFilterDropdown(event: Event) {
    event.stopPropagation();
    this.isFilterDropdownOpen.update(v => !v);
  }

  selectMuscleFilter(muscleName: string, event: Event) {
    event.stopPropagation();
    this.selectedMuscleGroup.set(muscleName === 'All Muscles' ? '' : muscleName);
    this.isFilterDropdownOpen.set(false);
    this.currentPage.set(1);
    this.loadExercises();
  }

  // Handle 3-dots menu
  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId.update(current => current === id ? null : id);
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  goToCreateExercise() {
    this.router.navigate([`/${this.role}/exercise-library/create`]);
  }

  editExercise(id: string) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/exercise-library/update`, id]);
  }

  async deleteExercise(id: string) {
    this.closeMenu();
    const confirmed = await this.dialogService.open({
      title: 'Delete Exercise',
      message: 'Are you sure you want to delete this exercise? This action cannot be undone.',
      mode: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        await this.exerciseService.deleteExercise(id);
        this.toastService.success('Exercise deleted successfully!');
        this.loadExercises();
      } catch (err) {
        this.toastService.error('Failed to delete exercise.');
      }
    }
  }

  goToNextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
      this.loadExercises();
    }
  }

  goToPrevPage() {
    if (this.hasPrevPage()) {
      this.currentPage.update(p => p - 1);
      this.loadExercises();
    }
  }
}
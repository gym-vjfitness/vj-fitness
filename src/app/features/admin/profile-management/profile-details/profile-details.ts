import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, tap } from 'rxjs';

import { SupabaseService } from '../../../../services/supabase-service';
import { DietService } from '../../../../services/diet-service';
import { WorkoutService } from '../../../../services/workout-service';
import { ProfileService } from '../../../../services/profile-service';
import { ProfileShortInfoDto } from '../../../../models/user.model';
import { ToastService } from '../../../../services/toast-service';
import { TrainerService } from '../../../../services/trainer-service';

@Component({
  selector: 'app-profile-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './profile-details.scss',
})
export class ProfileDetails implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  private supabaseService = inject(SupabaseService);
  private dietService = inject(DietService);
  private workoutService = inject(WorkoutService);
  private profileService = inject(ProfileService);
  private trainerService = inject(TrainerService);
  private toastService = inject(ToastService);

  // Current Logged-In User Role Logic
  currentUserRole = this.supabaseService.currentUser()?.user_role || 'member';
  isAdmin = this.currentUserRole === 'admin';

  // User State
  profileInfo = signal<ProfileShortInfoDto | null>(null);
  profileId = signal<string | null>(null);

  // Form Submission & Loading States
  isInitializing = signal<boolean>(true);
  isSaving = signal<boolean>(false);
  errorMessage = signal<string>('');

  // --- Initial States for Dirty Checking ---
  initialDietId = signal<string | null>(null);
  initialWorkoutId = signal<string | null>(null);
  initialTrainerId = signal<string | null>(null);

  // --- Diet Search States ---
  dietSearchQuery = signal<string>('');
  selectedDietId = signal<string | null>(null);
  showDietDropdown = signal<boolean>(false);
  isSearchingDiet = signal<boolean>(false);
  filteredDiets = signal<{ id: string; title: string }[]>([]);
  private dietSearchSubject = new Subject<string>();

  // --- Workout Search States ---
  workoutSearchQuery = signal<string>('');
  selectedWorkoutId = signal<string | null>(null);
  showWorkoutDropdown = signal<boolean>(false);
  isSearchingWorkout = signal<boolean>(false);
  filteredWorkouts = signal<{ id: string; heading: string }[]>([]);
  private workoutSearchSubject = new Subject<string>();

  // --- Trainer Search States ---
  trainerSearchQuery = signal<string>('');
  selectedTrainerId = signal<string | null>(null);
  showTrainerDropdown = signal<boolean>(false);
  isSearchingTrainer = signal<boolean>(false);
  filteredTrainers = signal<{ id: string; full_name: string }[]>([]);
  private trainerSearchSubject = new Subject<string>();

  // Computed signal to check if anything has changed
  hasChanges = computed(() => {
    return this.selectedDietId() !== this.initialDietId() ||
      this.selectedWorkoutId() !== this.initialWorkoutId() ||
      this.selectedTrainerId() !== this.initialTrainerId();
  });

  constructor() {
    // Setup Debounced Diet Search
    this.dietSearchSubject.pipe(
      debounceTime(900),
      distinctUntilChanged(),
      tap(() => this.isSearchingDiet.set(true)),
      switchMap(query => {
        if (!query.trim()) return of([]);
        return this.dietService.searchDiets(query).catch(() => []);
      }),
      takeUntilDestroyed()
    ).subscribe(results => {
      this.filteredDiets.set(results);
      this.isSearchingDiet.set(false);
      this.showDietDropdown.set(results.length > 0);
    });

    // Setup Debounced Workout Search
    this.workoutSearchSubject.pipe(
      debounceTime(900),
      distinctUntilChanged(),
      tap(() => this.isSearchingWorkout.set(true)),
      switchMap(query => {
        if (!query.trim()) return of([]);
        return this.workoutService.searchWorkouts(query).catch(() => []);
      }),
      takeUntilDestroyed()
    ).subscribe(results => {
      this.filteredWorkouts.set(results);
      this.isSearchingWorkout.set(false);
      this.showWorkoutDropdown.set(results.length > 0);
    });

    // Setup Debounced Trainer Search
    this.trainerSearchSubject.pipe(
      debounceTime(600),
      distinctUntilChanged(),
      tap(() => this.isSearchingTrainer.set(true)),
      switchMap(query => {
        if (!query.trim()) return of([]);
        return this.trainerService.searchTrainers(query).catch(() => []);
      }),
      takeUntilDestroyed()
    ).subscribe(results => {
      this.filteredTrainers.set(results);
      this.isSearchingTrainer.set(false);
      this.showTrainerDropdown.set(results.length > 0);
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.profileId.set(id);

    const state = this.location.getState() as any;
    if (state && state.profileInfo) {
      this.profileInfo.set(state.profileInfo);
      this.loadExistingAssignments(id!);
    } else {
      this.errorMessage.set('User data not found. Please navigate from the members list.');
      this.isInitializing.set(false);
    }
  }

  async loadExistingAssignments(id: string) {
    try {
      const assignments: any = await this.profileService.getMemberAssignments(id);

      if (assignments) {
        if (assignments.diet_plan_id && assignments.diet_plans) {
          this.selectedDietId.set(assignments.diet_plan_id);
          this.dietSearchQuery.set(assignments.diet_plans.title);
          this.initialDietId.set(assignments.diet_plan_id);
        }

        if (assignments.exercise_plan_id && assignments.workout_plans) {
          this.selectedWorkoutId.set(assignments.exercise_plan_id);
          this.workoutSearchQuery.set(assignments.workout_plans.heading);
          this.initialWorkoutId.set(assignments.exercise_plan_id);
        }

        if (assignments.assigned_trainer_id && assignments.trainer) {
          this.selectedTrainerId.set(assignments.assigned_trainer_id);
          this.trainerSearchQuery.set(assignments.trainer.full_name);
          this.initialTrainerId.set(assignments.assigned_trainer_id);
        }
      }
    } catch (error) {
      console.error('Failed to load existing assignments', error);
    } finally {
      this.isInitializing.set(false);
    }
  }

  // Input Handlers
  onDietInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.dietSearchQuery.set(query);
    this.selectedDietId.set(null);

    if (query.trim()) {
      this.dietSearchSubject.next(query);
    } else {
      this.showDietDropdown.set(false);
      this.filteredDiets.set([]);
    }
  }

  onWorkoutInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.workoutSearchQuery.set(query);
    this.selectedWorkoutId.set(null);

    if (query.trim()) {
      this.workoutSearchSubject.next(query);
    } else {
      this.showWorkoutDropdown.set(false);
      this.filteredWorkouts.set([]);
    }
  }

  onTrainerInput(event: Event) {
    if (!this.isAdmin) return; // Guard clause just in case

    const query = (event.target as HTMLInputElement).value;
    this.trainerSearchQuery.set(query);
    this.selectedTrainerId.set(null);

    if (query.trim()) {
      this.trainerSearchSubject.next(query);
    } else {
      this.showTrainerDropdown.set(false);
      this.filteredTrainers.set([]);
    }
  }

  // Selection Handlers
  selectDiet(diet: { id: string; title: string }) {
    this.selectedDietId.set(diet.id);
    this.dietSearchQuery.set(diet.title);
    this.showDietDropdown.set(false);
  }

  selectWorkout(workout: { id: string; heading: string }) {
    this.selectedWorkoutId.set(workout.id);
    this.workoutSearchQuery.set(workout.heading);
    this.showWorkoutDropdown.set(false);
  }

  selectTrainer(trainer: { id: string; full_name: string }) {
    if (!this.isAdmin) return;

    this.selectedTrainerId.set(trainer.id);
    this.trainerSearchQuery.set(trainer.full_name);
    this.showTrainerDropdown.set(false);
  }

  clearDiet() {
    this.selectedDietId.set(null);
    this.dietSearchQuery.set('');
    this.filteredDiets.set([]);
    this.showDietDropdown.set(false);
  }

  clearWorkout() {
    this.selectedWorkoutId.set(null);
    this.workoutSearchQuery.set('');
    this.filteredWorkouts.set([]);
    this.showWorkoutDropdown.set(false);
  }

  clearTrainer() {
    if (!this.isAdmin) return;

    this.selectedTrainerId.set(null);
    this.trainerSearchQuery.set('');
    this.filteredTrainers.set([]);
    this.showTrainerDropdown.set(false);
  }

  async assignPlans() {
    if (!this.profileInfo()?.is_active || !this.profileId()) return;

    if (!this.hasChanges()) {
      return;
    }

    try {
      this.isSaving.set(true);
      this.errorMessage.set('');

      await this.profileService.assignPlansToMember(
        this.profileId()!,
        this.selectedDietId(),
        this.selectedWorkoutId(),
        this.selectedTrainerId()
      );

      this.initialDietId.set(this.selectedDietId());
      this.initialWorkoutId.set(this.selectedWorkoutId());
      this.initialTrainerId.set(this.selectedTrainerId());

      this.toastService.success('Member setup successfully updated.');
    } catch (error: any) {
      this.toastService.error('Failed to assign programs.');
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack() {
    this.location.back();
  }
}
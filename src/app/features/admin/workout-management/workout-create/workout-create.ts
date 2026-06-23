import { Component, OnInit, inject, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router'; 
import { ToastService } from '../../../../services/toast-service';
import { WorkoutService } from '../../../../services/workout-service';
import { ExerciseService } from '../../../../services/exercise-service';
import { DialogService } from '../../../../services/dialog-service'; 
import { WorkoutDay, WorkoutPlanInsert, WorkoutPlanDetails } from '../../../../models/workout.model';
import { ExerciseSearchResult } from '../../../../models/exercise.model';
import { SupabaseService } from '../../../../services/supabase-service';

@Component({
  selector: 'app-workout-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './workout-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './workout-create.scss',
})
export class WorkoutCreate implements OnInit {
  workoutForm!: FormGroup;
  isEditMode = signal(false);
  isSaving = signal(false);
  isLoading = signal(false);
  planId = signal<string | null>(null);
  private initialPayloadStr = ''; 
  
  activeDayIndex = 0;
  readonly daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  goalOptions = ['Fat loss', 'Muscle gain', 'Strength', 'Rehab', 'General fitness'];
  difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
  audienceOptions = ['Men', 'Women', 'Seniors', 'Athletes'];
  activeDropdown: 'goal' | 'difficulty' | 'audience' | null = null;

  activeDropdownIndex = signal<number | null>(null);
  exerciseSearchResults = signal<ExerciseSearchResult[]>([]);
  isSearching = signal(false);
  private searchTimeout: any;
  private touchStartX = 0;

  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute); 
  private router = inject(Router); 
  workoutService = inject(WorkoutService);
  exerciseService = inject(ExerciseService);
  dialogService = inject(DialogService); 
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  ngOnInit() {
    this.workoutForm = this.fb.group({
      heading: ['', Validators.required],
      description: [''], 
      goalType: ['', Validators.required], 
      difficultyLevel: ['', Validators.required],
      targetAudience: ['', Validators.required],
      weeklySchedule: this.fb.array(
        this.daysOfWeek.map(day => this.fb.group({
          dayName: [day],
          focusMuscle: [''],
          dayNotes: [''], 
          exercises: this.fb.array([])
        }))
      )
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.planId.set(id);
      this.loadPlanData(id);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) this.activeDropdown = null;
    if (!target.closest('.autocomplete-container')) this.activeDropdownIndex.set(null);
  }

  get weeklySchedule(): FormArray { return this.workoutForm.get('weeklySchedule') as FormArray; }
  getExercises(dayIndex: number): FormArray { return this.weeklySchedule.at(dayIndex).get('exercises') as FormArray; }
  getActiveDayGroup(): FormGroup { return this.weeklySchedule.at(this.activeDayIndex) as FormGroup; }
  getSetDetails(dayIndex: number, exerciseIndex: number): FormArray { 
    return this.getExercises(dayIndex).at(exerciseIndex).get('setDetails') as FormArray; 
  }

  async loadPlanData(id: string) {
    // 1. Check if we already have THIS SPECIFIC workout in the multi-plan cache
    const cachedPlan = this.workoutService.cachedEditPlans().get(id);
    if (cachedPlan) {
      this.patchFormWithData(cachedPlan);
      return;
    }

    // 2. Fetch from Backend if not cached
    this.isLoading.set(true);
    const { data, error } = await this.workoutService.getWorkoutPlanById(id);
    this.isLoading.set(false);

    if (error || !data) {
      this.toastService.danger('Failed to load workout plan details.');
      this.router.navigate([`/${this.role}/workout`]); 
      return;
    }

    // 3. Save into the Map cache so returning later doesn't fetch again
    this.workoutService.cachedEditPlans.update(map => {
      const newMap = new Map(map);
      newMap.set(id, data);
      return newMap;
    });

    this.patchFormWithData(data);
  }

  private patchFormWithData(data: WorkoutPlanDetails) {
    this.workoutForm.patchValue({
      heading: data.heading,
      description: data.description || '',
      goalType: data.goal_type,
      difficultyLevel: data.difficulty_level,
      targetAudience: data.target_audience
    });

    const scheduleData = (data.schedule_data as WorkoutDay[]) || [];

    this.weeklySchedule.controls.forEach((dayGroupCtrl) => {
      const dayGroup = dayGroupCtrl as FormGroup;
      const dayName = dayGroup.get('dayName')?.value;
      const matchingBackendDay = scheduleData.find(d => d.dayName === dayName);

      if (matchingBackendDay) {
        dayGroup.patchValue({
          focusMuscle: matchingBackendDay.focusMuscle || '',
          dayNotes: matchingBackendDay.dayNotes || ''
        });

        const exercisesArray = dayGroup.get('exercises') as FormArray;
        exercisesArray.clear(); 

        if (matchingBackendDay.exercises && matchingBackendDay.exercises.length > 0) {
          matchingBackendDay.exercises.forEach(ex => {
            const trackType = ex.trackingType || 'reps';
            const maxVal = trackType === 'time' ? 1800 : 50;

            const exGroup = this.fb.group({
              exercise_id: [ex.exercise_id, Validators.required],
              name: [ex.name, Validators.required],
              trackingType: [trackType],
              sets: [ex.sets, [Validators.required, Validators.min(1)]],
              restSeconds: [ex.restSeconds || null],
              setDetails: this.fb.array([])
            });

            const setDetailsArray = exGroup.get('setDetails') as FormArray;
            if (ex.setDetails && ex.setDetails.length > 0) {
              ex.setDetails.forEach(val => {
                setDetailsArray.push(this.fb.group({
                  value: [val, [Validators.required, Validators.min(1), Validators.max(maxVal)]]
                }));
              });
            }

            exercisesArray.push(exGroup);
          });
        }
      }
    });

    // Save initial state for dirty checking
    this.initialPayloadStr = JSON.stringify(this.getCleanPayload());
  }

  toggleDropdown(type: 'goal' | 'difficulty' | 'audience', event: Event) {
    event.stopPropagation();
    this.activeDropdown = this.activeDropdown === type ? null : type;
  }
  
  selectOption(type: 'goal' | 'difficulty' | 'audience', value: string, event: Event) {
    event.stopPropagation();
    if (type === 'goal') this.workoutForm.get('goalType')?.setValue(value);
    if (type === 'difficulty') this.workoutForm.get('difficultyLevel')?.setValue(value);
    if (type === 'audience') this.workoutForm.get('targetAudience')?.setValue(value);
    this.activeDropdown = null; 
  }

  onExerciseSearch(event: Event, index: number) {
    const query = (event.target as HTMLInputElement).value;
    this.activeDropdownIndex.set(index);
    const group = this.getExercises(this.activeDayIndex).at(index) as FormGroup;
    
    group.get('exercise_id')?.setValue(null);
    group.updateValueAndValidity(); 

    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    if (!query.trim()) {
      this.exerciseSearchResults.set([]);
      this.isSearching.set(false);
      return;
    }
    
    this.searchTimeout = setTimeout(async () => {
      this.isSearching.set(true);
      try {
        const res = await this.exerciseService.searchExercisesForAutocomplete(query);
        this.exerciseSearchResults.set(res);
      } catch(error) {
        console.error('Search failed:', error);
      } finally {
        this.isSearching.set(false);
      }
    }, 500); 
  }

  selectExerciseFromLibrary(exercise: ExerciseSearchResult, index: number) {
    const group = this.getExercises(this.activeDayIndex).at(index) as FormGroup;
    group.patchValue({ name: exercise.name, exercise_id: exercise.id });
    this.activeDropdownIndex.set(null);
    group.updateValueAndValidity(); 
  }

  addExercise() {
    this.getExercises(this.activeDayIndex).push(this.fb.group({
      exercise_id: [null, Validators.required], 
      name: ['', Validators.required], 
      trackingType: ['reps'], 
      sets: [null, [Validators.required, Validators.min(1)]],
      restSeconds: [null],
      setDetails: this.fb.array([]) 
    })); 
  }

  removeExercise(exerciseIndex: number, event: Event) { 
    event.stopPropagation();
    this.getExercises(this.activeDayIndex).removeAt(exerciseIndex); 
  }

  onTouchStart(event: TouchEvent) { this.touchStartX = event.changedTouches[0].screenX; }

  onTouchEnd(event: TouchEvent, exerciseIndex: number) {
    const touchEndX = event.changedTouches[0].screenX;
    const diff = touchEndX - this.touchStartX;
    if (diff > 15) this.setTrackingType(exerciseIndex, 'time');
    else if (diff < -15) this.setTrackingType(exerciseIndex, 'reps');
  }

  setTrackingType(exerciseIndex: number, type: 'reps' | 'time') {
    const group = this.getExercises(this.activeDayIndex).at(exerciseIndex) as FormGroup;
    group.get('trackingType')?.setValue(type);

    const setDetails = group.get('setDetails') as FormArray;
    const maxVal = type === 'time' ? 1800 : 50;
    
    setDetails.controls.forEach(ctrl => {
      const valCtrl = ctrl.get('value');
      valCtrl?.setValidators([Validators.required, Validators.min(1), Validators.max(maxVal)]);
      valCtrl?.updateValueAndValidity();
    });
  }

  onSetsChange(exerciseIndex: number) {
    const group = this.getExercises(this.activeDayIndex).at(exerciseIndex) as FormGroup;
    const setsCount = group.get('sets')?.value || 0;
    const setDetails = group.get('setDetails') as FormArray;
    
    const type = group.get('trackingType')?.value || 'reps';
    const maxVal = type === 'time' ? 1800 : 50;

    while (setDetails.length < setsCount) {
      setDetails.push(this.fb.group({
        value: [null, [Validators.required, Validators.min(1), Validators.max(maxVal)]]
      }));
    }
    while (setDetails.length > setsCount) {
      setDetails.removeAt(setDetails.length - 1);
    }
  }

  onFirstSetChange(exerciseIndex: number, setIndex: number, event: Event) {
    if (setIndex !== 0) return;
    const val = (event.target as HTMLInputElement).value;
    const setDetails = this.getSetDetails(this.activeDayIndex, exerciseIndex);
    
    for (let i = 1; i < setDetails.length; i++) {
      const control = setDetails.at(i).get('value');
      if (val !== '') control?.setValue(Number(val));
      else control?.setValue(null);
    }
  }

  hasMaxError(exerciseIndex: number): boolean {
    const setDetails = this.getSetDetails(this.activeDayIndex, exerciseIndex);
    return setDetails.controls.some(ctrl => ctrl.get('value')?.hasError('max'));
  }

  private getCleanPayload(): WorkoutPlanInsert {
    const rawForm = this.workoutForm.value;
    const cleanScheduleData: WorkoutDay[] = rawForm.weeklySchedule.map((day: any) => {
      const cleanDay: WorkoutDay = { dayName: day.dayName, exercises: [] };
      if (day.focusMuscle?.trim()) cleanDay.focusMuscle = day.focusMuscle.trim();
      if (day.dayNotes?.trim()) cleanDay.dayNotes = day.dayNotes.trim();

      cleanDay.exercises = day.exercises.map((ex: any) => ({
        exercise_id: ex.exercise_id,
        name: ex.name,
        trackingType: ex.trackingType,
        sets: ex.sets,
        restSeconds: ex.restSeconds,
        setDetails: ex.setDetails.map((set: any) => set.value) 
      }));
      return cleanDay;
    });

    const payload: WorkoutPlanInsert = {
      heading: rawForm.heading,
      goal_type: rawForm.goalType, 
      difficulty_level: rawForm.difficultyLevel,
      target_audience: rawForm.targetAudience,
      schedule_data: cleanScheduleData
    };
    if (rawForm.description?.trim()) payload.description = rawForm.description.trim();

    return payload;
  }

  async savePlan() {
    if (this.workoutForm.invalid) {
      this.workoutForm.markAllAsTouched();
      this.toastService.danger('Please fix validation errors and complete all set values.');
      return;
    }
    
    const dbPayload = this.getCleanPayload();
    const currentPayloadStr = JSON.stringify(dbPayload);

    if (this.isEditMode()) {
      if (currentPayloadStr === this.initialPayloadStr) {
        this.toastService.info('No changes detected.');
        return; 
      }

      const confirmed = await this.dialogService.open({
        title: `Update Workout Plan`,
        message: `Are you sure you want to update this workout plan?`,
        mode: 'warning',
        confirmText: `Yes, Update`,
        cancelText: 'Cancel'
      });

      if (!confirmed) return; 
    }

    this.isSaving.set(true);
    try {
      if (this.isEditMode() && this.planId()) {
        const { error } = await this.workoutService.updateWorkoutPlan(this.planId()!, dbPayload);
        if (error) throw error; 
        
        // Caches are cleared inside the service automatically
        this.toastService.success('Workout Plan updated successfully!');
        
        // REDIRECT TO ADMIN ROUTE ON SUCCESS
        this.router.navigate([`/${this.role}/workout`]); 
      } else {
        const { error } = await this.workoutService.createWorkoutPlan(dbPayload);
        if (error) throw error; 
        
        this.toastService.success('Workout Plan created successfully!');
        
        // REDIRECT TO ADMIN ROUTE ON SUCCESS
        this.router.navigate([`/${this.role}/workout`]); 
      }
    } catch (error: any) {
      this.toastService.danger(this.isEditMode() ? 'Failed to update Workout Plan' : 'Failed to create Workout Plan');
    } finally {
      this.isSaving.set(false);
    }
  }
}
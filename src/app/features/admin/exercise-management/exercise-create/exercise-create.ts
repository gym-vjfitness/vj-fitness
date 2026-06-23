import { Component, OnInit, inject, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';
import { Exercise, CreateExerciseDto } from '../../../../models/exercise.model';
import { ExerciseService } from '../../../../services/exercise-service';
import { StorageService } from '../../../../services/storage-service';
import { SupabaseService } from '../../../../services/supabase-service';

@Component({
  selector: 'app-exercise-create',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './exercise-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './exercise-create.scss',
})
export class ExerciseCreate implements OnInit {
  exerciseForm!: FormGroup;
  
  private fb = inject(FormBuilder);
  private exerciseService = inject(ExerciseService);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  isEditMode = signal(false);
  editingExerciseId = signal<string | null>(null);
  isLoading = signal(false);
  isFetchingData = signal(false);

  isMuscleDropdownOpen = signal(false);
  isEquipmentDropdownOpen = signal(false);

  muscleGroups = [
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

  equipmentList = [
    { name: 'Bodyweight', colorClass: 'text-accent border-accent/30 bg-accent/10', path: 'M3 5h18 M7 5v4l3 3v8 M17 5v4l-3 3v8 M12 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M10 12h4' },
    { name: 'Barbell', colorClass: 'text-info border-info/30 bg-info/10', path: 'M2 12h20 M4 8v8 M20 8v8 M7 9v6 M17 9v6' },
    { name: 'Dumbbell', colorClass: 'text-primary border-primary/30 bg-primary/10', path: 'M5 12h14 M3 9v6 M21 9v6 M7 10v4 M17 10v4' },
    { name: 'Kettlebell', colorClass: 'text-warning border-warning/30 bg-warning/10', path: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M9 9V5a3 3 0 0 1 6 0v4 M9 5h6' },
    { name: 'Machine', colorClass: 'text-success border-success/30 bg-success/10', path: 'M7 3h10v18H7V3z M7 7h10 M7 11h10 M7 15h10 M17 9h4 M10 3v18 M14 3v18' },
    { name: 'Cables', colorClass: 'text-secondary border-secondary/30 bg-secondary/10', path: 'M4 4h16 M5 4v16 M19 4v16 M5 6l6 8 M19 6l-6 8 M9 14h6' },
    { name: 'Resistance Band', colorClass: 'text-warning border-warning/30 bg-warning/10', path: 'M2 12c0-4 8-6 10-6s10 2 10 6-8 6-10 6-10-2-10-6z M12 6v12 M6 9v6 M18 9v6' },
    { name: 'None', colorClass: 'text-muted border-muted/30 bg-muted/10', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M4.93 4.93l14.14 14.14' }
  ];

  ngOnInit() {
    this.exerciseForm = this.fb.group({
      name: ['', Validators.required],
      target_muscle_group: [''],
      equipment_required: [''],
      video_url: [''],
      description: ['']
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.editingExerciseId.set(id);
        this.loadExerciseData(id);
      }
    });
  }

  async loadExerciseData(id: string) {
    this.isFetchingData.set(true);
    const cacheKey = `exercise_details_${id}`;

    try {
      let exerciseData: any = null;

      try {
        const cachedEx = await this.storageService.getItem<any>(cacheKey);
        if (cachedEx) exerciseData = cachedEx;
      } catch (e) {}

      if (!exerciseData) {
        exerciseData = await this.exerciseService.getExerciseById(id);
        try { await this.storageService.setItem(cacheKey, exerciseData); } catch (e) {}
      }

      this.populateForm(exerciseData);
      this.exerciseForm.markAsPristine();

    } catch (error) {
      this.toastService.error('Failed to load exercise details.');
      this.goBack();
    } finally {
      this.isFetchingData.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.isMuscleDropdownOpen.set(false);
      this.isEquipmentDropdownOpen.set(false);
    }
  }

  toggleMuscleDropdown(event: Event) {
    event.stopPropagation();
    this.isMuscleDropdownOpen.update(v => !v);
    this.isEquipmentDropdownOpen.set(false);
  }

  toggleEquipmentDropdown(event: Event) {
    event.stopPropagation();
    this.isEquipmentDropdownOpen.update(v => !v);
    this.isMuscleDropdownOpen.set(false);
  }

  selectMuscle(muscle: string, event: Event) {
    event.stopPropagation();
    this.exerciseForm.patchValue({ target_muscle_group: muscle });
    this.exerciseForm.markAsDirty();
    this.isMuscleDropdownOpen.set(false);
  }

  selectEquipment(equipment: string, event: Event) {
    event.stopPropagation();
    this.exerciseForm.patchValue({ equipment_required: equipment });
    this.exerciseForm.markAsDirty();
    this.isEquipmentDropdownOpen.set(false);
  }

  private populateForm(exercise: Exercise) {
    this.exerciseForm.patchValue({
      name: exercise.name || '',
      target_muscle_group: exercise.target_muscle_group || '',
      equipment_required: exercise.equipment_required || '',
      video_url: exercise.video_url || '',
      description: exercise.description || ''
    });
  }

  goBack() {
    this.router.navigate([`/${this.role}/exercise-library`]);
  }

  async saveExercise() {
    if (this.exerciseForm.invalid) {
      this.toastService.error('Please provide an exercise name.');
      this.exerciseForm.markAllAsTouched();
      return;
    }

    const payload: CreateExerciseDto = this.exerciseForm.value;

    try {
      if (this.isEditMode() && this.editingExerciseId()) {
        
        if (this.exerciseForm.pristine) {
          this.toastService.info('No changes were made.');
          this.goBack();
          return;
        }

        const confirmed = await this.dialogService.open({
          title: `Update Exercise`,
          message: `Are you sure you want to apply these changes?`,
          mode: 'warning',
          confirmText: `Save Changes`,
          cancelText: 'Cancel'
        });

        if (confirmed) {
          this.isLoading.set(true);
          await this.exerciseService.updateExercise(this.editingExerciseId()!, payload);
          this.toastService.success('Exercise updated successfully!');
          this.goBack();
        }
      } else {
        this.isLoading.set(true);
        await this.exerciseService.createExercise(payload);
        this.toastService.success('Exercise created successfully!');
        this.goBack();
      }
    } catch (error) {
      console.error(error);
      this.toastService.error('Failed to save exercise.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
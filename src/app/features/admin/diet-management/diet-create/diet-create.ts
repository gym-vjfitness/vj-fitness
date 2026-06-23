import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { GYM_EMOJI_LIBRARY } from './../../../../shared/emoji-dictionary';
import { CreateDietPlanDto, DietPlan } from '../../../../models/diet-plan.dto';
import { DietService } from '../../../../services/diet-service';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';

@Component({
  selector: 'app-diet-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './diet-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './diet-create.scss',
})
export class DietCreate implements OnInit {
  private fb = inject(FormBuilder);
  dietService = inject(DietService);
  dialogService = inject(DialogService);
  toastService = inject(ToastService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  dietForm!: FormGroup;

  // --- Dynamic State for Update ---
  isEditMode = false;
  editingDietId: string | null = null;
  isLoading = signal<boolean>(false);

  // Save initial state to check if user actually changed anything
  initialFormState: string | null = null;

  // Static cache to preserve fetched data across tab switches!
  static dietDetailsCache = new Map<string, DietPlan>();

  // State
  activeDayIndex = 0;
  readonly daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Tag Inputs State
  recommendedInput = '';
  restrictedInput = '';

  // Icon Picker State
  isIconPickerOpen = false;
  iconSearchQuery = '';
  activeIconTarget = { mealIndex: -1, itemIndex: -1 };
  filteredIcons = [...GYM_EMOJI_LIBRARY];

  ngOnInit() {
    // 1. Initialize Blank Form
    this.dietForm = this.fb.group({
      title: ['', Validators.required],
      generalNotes: [''],
      restrictedFoods: [[]],
      recommendedFoods: [[]],
      weeklySchedule: this.fb.array(
        this.daysOfWeek.map(day => this.fb.group({
          dayName: [day],
          dayNotes: [''],
          meals: this.fb.array([])
        }))
      )
    });

    // 2. Check Route Params for ID (Edit Mode)
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.editingDietId = id;
        this.loadDietData(id);
      }
    });
  }

  // --- Fetch & Cache Logic ---
  async loadDietData(id: string) {
    this.isLoading.set(true);
    try {
      let plan: DietPlan;

      // Look in the shared Admin Memory Cache
      const cache = this.dietService.adminDietCache.get(id);

      if (cache) {
        plan = cache.data; // Use memory state
      } else {
        plan = await this.dietService.getDietPlanDetailsById(id);
        this.dietService.adminDietCache.set(id, { data: plan, timestamp: Date.now() });
      }

      this.populateFormWithExistingData(plan);
      this.initialFormState = JSON.stringify(this.dietForm.value);

    } catch (error) {
      console.error('Error loading diet plan:', error);
      this.toastService.danger('Failed to load Diet Plan details.');
      this.router.navigate(['admin/diet']); // Kick them back to management if fetch fails
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Populate Data Logic ---
  private populateFormWithExistingData(plan: DietPlan) {
    this.dietForm.patchValue({
      title: plan.title || '',
      generalNotes: plan.general_notes || '',
      restrictedFoods: plan.restricted_foods || [],
      recommendedFoods: plan.recommended_foods || []
    });

    if (plan.weekly_schedule && Array.isArray(plan.weekly_schedule)) {
      plan.weekly_schedule.forEach((incomingDay: any, index: number) => {
        if (index < 7) {
          const dayGroup = this.weeklySchedule.at(index) as FormGroup;
          dayGroup.patchValue({ dayNotes: incomingDay.dayNotes || '' });

          const mealsArray = dayGroup.get('meals') as FormArray;
          mealsArray.clear();

          if (incomingDay.meals && Array.isArray(incomingDay.meals)) {
            incomingDay.meals.forEach((incomingMeal: any) => {

              const itemFormGroups = (incomingMeal.items || []).map((item: any) => {
                return this.fb.group({
                  food: [item.food || '', Validators.required],
                  icon: [item.icon || '🥗']
                });
              });

              mealsArray.push(this.fb.group({
                mealName: [incomingMeal.mealName || '', Validators.required],
                items: this.fb.array(itemFormGroups)
              }));
            });
          }
        }
      });
    }
  }

  // --- Getters ---
  get weeklySchedule(): FormArray { return this.dietForm.get('weeklySchedule') as FormArray; }
  getMeals(dayIndex: number): FormArray { return this.weeklySchedule.at(dayIndex).get('meals') as FormArray; }
  getItems(dayIndex: number, mealIndex: number): FormArray { return this.getMeals(dayIndex).at(mealIndex).get('items') as FormArray; }
  getActiveDayGroup(): FormGroup { return this.weeklySchedule.at(this.activeDayIndex) as FormGroup; }

  // --- Tag Logic (Badges) ---
  addFoodTag(type: 'recommended' | 'restricted', event?: Event) {
    if (event) event.preventDefault();

    if (type === 'recommended') {
      const val = this.recommendedInput.trim();
      if (val) {
        const current = this.dietForm.get('recommendedFoods')?.value || [];
        this.dietForm.get('recommendedFoods')?.setValue([...current, val]);
        this.recommendedInput = '';
      }
    } else {
      const val = this.restrictedInput.trim();
      if (val) {
        const current = this.dietForm.get('restrictedFoods')?.value || [];
        this.dietForm.get('restrictedFoods')?.setValue([...current, val]);
        this.restrictedInput = '';
      }
    }
  }

  removeFoodTag(type: 'recommended' | 'restricted', index: number) {
    if (type === 'recommended') {
      const current = [...this.dietForm.get('recommendedFoods')?.value];
      current.splice(index, 1);
      this.dietForm.get('recommendedFoods')?.setValue(current);
    } else {
      const current = [...this.dietForm.get('restrictedFoods')?.value];
      current.splice(index, 1);
      this.dietForm.get('restrictedFoods')?.setValue(current);
    }
  }

  // --- Core Actions ---
  setActiveDay(index: number) { this.activeDayIndex = index; }

  addMeal() {
    this.getMeals(this.activeDayIndex).push(this.fb.group({ mealName: ['', Validators.required], items: this.fb.array([]) }));
  }
  removeMeal(mealIndex: number) { this.getMeals(this.activeDayIndex).removeAt(mealIndex); }

  addFoodItem(mealIndex: number) {
    this.getItems(this.activeDayIndex, mealIndex).push(this.fb.group({ food: ['', Validators.required], icon: ['🥗'] }));
  }
  removeFoodItem(mealIndex: number, itemIndex: number) { this.getItems(this.activeDayIndex, mealIndex).removeAt(itemIndex); }

  // --- Modal Logic ---
  openIconPicker(mealIndex: number, itemIndex: number) {
    this.activeIconTarget = { mealIndex, itemIndex };
    this.isIconPickerOpen = true;
    this.iconSearchQuery = '';
    this.filteredIcons = [...GYM_EMOJI_LIBRARY];
  }

  filterIcons() {
    const query = this.iconSearchQuery.toLowerCase().trim();
    this.filteredIcons = query
      ? GYM_EMOJI_LIBRARY.filter(item => item.name.toLowerCase().includes(query))
      : [...GYM_EMOJI_LIBRARY];
  }

  selectIcon(icon: string) {
    this.getItems(this.activeDayIndex, this.activeIconTarget.mealIndex).at(this.activeIconTarget.itemIndex).get('icon')?.setValue(icon);
    this.isIconPickerOpen = false;
  }

  // --- Bulk Actions & UX ---
  copyToAllDays() {
    const sourceMeals = this.getMeals(this.activeDayIndex).value;
    this.weeklySchedule.controls.forEach((dayCtrl, idx) => {
      if (idx === this.activeDayIndex) return;
      const targetMeals = dayCtrl.get('meals') as FormArray;
      targetMeals.clear();
      sourceMeals.forEach((meal: any) => {
        targetMeals.push(this.fb.group({
          mealName: [meal.mealName, Validators.required],
          items: this.fb.array(meal.items.map((item: any) => this.fb.group({ food: [item.food, Validators.required], icon: [item.icon] })))
        }));
      });
    });
    this.toastService.info(`✨ Copied to all days!`);
  }

  clearOtherDays() {
    this.weeklySchedule.controls.forEach((dayCtrl, idx) => {
      if (idx !== this.activeDayIndex) (dayCtrl.get('meals') as FormArray).clear();
    });
    this.toastService.danger(`🧹 Cleared other days.`);
  }

  async saveDietPlan() {
    // 1. Validate Form
    if (this.dietForm.invalid) {
      this.toastService.danger('⚠️ Please fill out all required fields.');
      this.dietForm.markAllAsTouched();
      return;
    }

    const formValue = this.dietForm.value;
    const currentFormState = JSON.stringify(formValue);

    // 2. Unchanged State Protection
    if (this.isEditMode && this.initialFormState === currentFormState) {
      this.toastService.info('No changes were made to the diet plan.');
      return;
    }

    const backendPayload: CreateDietPlanDto = {
      title: formValue.title,
      general_notes: formValue.generalNotes || null,
      restricted_foods: formValue.restrictedFoods,
      recommended_foods: formValue.recommendedFoods,
      weekly_schedule: formValue.weeklySchedule
    };

    try {
      if (this.isEditMode && this.editingDietId) {

        // 3. Warning Mode Confirmation Dialog
        const confirmed = await this.dialogService.open({
          title: `Update Diet Plan`,
          message: `Are you sure you want to update "${formValue.title}"? Your changes will be saved.`,
          mode: 'warning',
          confirmText: `Update`,
          cancelText: 'Cancel'
        });

        if (confirmed) {
          await this.dietService.updateDietPlan(this.editingDietId, backendPayload);
          this.toastService.success('Diet plan updated successfully!');

          // REMOVE STALE DATA FROM CACHES
          this.dietService.adminDietCache.delete(this.editingDietId);
          if (this.dietService.listState) this.dietService.listState.set(null); // Wipe list cache too

          this.router.navigate(['admin/diet']);
        }

      } else {
        await this.dietService.createDietPlan(backendPayload);
        this.toastService.success('Diet plan saved successfully!');
        if (this.dietService.listState) this.dietService.listState.set(null);
        this.router.navigate(['admin/diet']);
      }
    } catch (error) {
      console.error(error);
      this.toastService.danger('Failed to save diet plan.');
    }
  }
}
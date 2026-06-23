import { Component, OnInit, HostListener, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule,
  AbstractControl, ValidationErrors, ValidatorFn
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GymPlanService } from '../../../../services/gym-plan-service';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';
import { StorageService } from '../../../../services/storage-service';
import { SupabaseService } from '../../../../services/supabase-service';

// --- Custom Validators ---
export function uniqueDurationValidator(): ValidatorFn {
  return (formArray: AbstractControl): ValidationErrors | null => {
    if (!(formArray instanceof FormArray)) return null;
    const durations = formArray.controls
      .map(c => c.get('duration_in_days')?.value)
      .filter(val => val !== null && val !== '');
    return durations.some((val, i) => durations.indexOf(val) !== i) ? { duplicateDuration: true } : null;
  };
}

export function uniqueFeatureValidator(): ValidatorFn {
  return (formArray: AbstractControl): ValidationErrors | null => {
    if (!(formArray instanceof FormArray)) return null;
    const features = formArray.controls
      .map(c => c.get('name')?.value?.trim().toLowerCase())
      .filter(val => val !== null && val !== '');
    return features.some((val, i) => features.indexOf(val) !== i) ? { duplicateFeature: true } : null;
  };
}

@Component({
  selector: 'app-plan-create',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-create.html'
})
export class PlanCreate implements OnInit {
  private fb = inject(FormBuilder);
  private planService = inject(GymPlanService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private storageService = inject(StorageService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  // UI States
  isLoading = signal(false);
  isFetchingData = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Edit Mode States
  isEditMode = signal<boolean>(false);
  editPlanId = signal<string | null>(null);

  // Custom Dropdown State
  openDropdownIndex = signal<number | null>(null);

  // Premium Dropdown Options (Matching Reference Image Layout)
  readonly durationOptions = [
    { label: '1 Month', days: 30 },
    { label: '2 Months', days: 60 },
    { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '9 Months', days: 270 },
    { label: '1 Year', days: 365 }
  ];

  planForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(250)]],
    features: this.fb.array([], { validators: uniqueFeatureValidator() }),
    prices: this.fb.array([], { validators: uniqueDurationValidator() })
  });

  // Getters
  get pricesArray(): FormArray { return this.planForm.get('prices') as FormArray; }
  get featuresArray(): FormArray { return this.planForm.get('features') as FormArray; }
  get pricesControls(): AbstractControl[] { return this.pricesArray.controls; }
  get featuresControls(): AbstractControl[] { return this.featuresArray.controls; }
  get hasDuplicatePrices() { return this.planForm.get('prices')?.hasError('duplicateDuration'); }
  get hasDuplicateFeatures() { return this.planForm.get('features')?.hasError('duplicateFeature'); }

  ngOnInit() {
    // Determine if we are Creating or Editing based on the Route URL
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.editPlanId.set(id);
        this.loadPlanData(id);
      } else {
        // Initialize Empty Form for Create Mode
        this.addFeature();
        this.addPriceOption();
      }
    });
  }

  // Fetch Existing Data for Update Mode
  async loadPlanData(id: string) {
    this.isFetchingData.set(true);
    const cacheKey = `plan_details_${id}`;
    
    try {
      let planData: any = null;

      // 1. Try to fetch from Local Storage First
      try {
        const cachedPlan = await this.storageService.getItem<any>(cacheKey);
        if (cachedPlan) {
          planData = cachedPlan;
        }
      } catch (cacheError) {
        console.warn('Failed to read from local storage:', cacheError);
      }

      // 2. Fallback to API if not in cache
      if (!planData) {
        planData = await this.planService.getPlanById(id);
        
        // Save fetched data to Local Storage for future tab switches
        try {
          await this.storageService.setItem(cacheKey, planData);
        } catch (cacheError) {
          console.warn('Failed to save to local storage:', cacheError);
        }
      }

      // 3. Patch Form Values
      this.planForm.patchValue({
        name: planData.name,
        description: planData.description
      });

      // Clear empty default arrays before patching
      this.featuresArray.clear();
      this.pricesArray.clear();

      if (planData.plan_features && planData.plan_features.length > 0) {
        planData.plan_features.forEach((feature: any) => {
          this.featuresArray.push(this.fb.group({ name: [feature.name, Validators.required] }));
        });
      } else {
        this.addFeature();
      }

      if (planData.plan_prices && planData.plan_prices.length > 0) {
        planData.plan_prices.forEach((price: any) => {
          const group = this.createPriceGroup(price.duration_in_days, price.price, price.name);
          this.pricesArray.push(group);
        });
      } else {
        this.addPriceOption();
      }

      // --- CRITICAL FIX: Mark the form as pristine (unchanged) after loading data ---
      this.planForm.markAsPristine();

    } catch (error) {
      this.toastService.error('Failed to load plan details.');
      this.router.navigate([`/${this.role}/gym-plan`]);
    } finally {
      this.isFetchingData.set(false);
    }
  }

  // --- Feature Methods ---
  private createFeatureGroup(): FormGroup { return this.fb.group({ name: ['', Validators.required] }); }
  addFeature() { 
    this.featuresArray.push(this.createFeatureGroup()); 
    this.planForm.markAsDirty(); // Manually mark dirty when adding
  }
  removeFeature(index: number) {
    if (this.featuresControls.length > 1) {
      this.featuresArray.removeAt(index);
      this.planForm.markAsDirty(); // Manually mark dirty when removing
    }
  }

  // --- Price Methods ---
  private createPriceGroup(selectedDays: number = 30, priceVal: number | null = null, nameVal: string | null = null): FormGroup {
    if (!nameVal) {
      const option = this.durationOptions.find(opt => opt.days === selectedDays);
      nameVal = option ? option.label : String(selectedDays);
    }

    return this.fb.group({
      name: [nameVal, Validators.required],
      duration_in_days: [selectedDays, [Validators.required, Validators.min(1)]],
      price: [priceVal, [Validators.required, Validators.min(0)]],
    });
  }

  addPriceOption() {
    this.pricesArray.push(this.createPriceGroup());
    this.planForm.markAsDirty(); // Manually mark dirty when adding
    this.closeDropdown();
  }

  removePriceOption(index: number) {
    if (this.pricesControls.length > 1) {
      this.pricesArray.removeAt(index);
      this.planForm.markAsDirty(); // Manually mark dirty when removing
      this.closeDropdown();
    }
  }

  // --- Premium Custom Dropdown Logic ---
  toggleDropdown(index: number) {
    this.openDropdownIndex.update(current => current === index ? null : index);
  }

  closeDropdown() {
    this.openDropdownIndex.set(null);
  }

  selectDuration(option: { label: string, days: number }, priceIndex: number) {
    const priceGroup = this.pricesArray.at(priceIndex);
    if (priceGroup) {
      priceGroup.patchValue({
        duration_in_days: option.days,
        name: option.label
      });
      // PatchValue automatically marks the form as dirty
    }
    this.closeDropdown();
  }

  getSelectedDurationLabel(priceIndex: number): string {
    const priceGroup = this.pricesArray.at(priceIndex);
    if (!priceGroup) return 'Select Duration';
    const days = priceGroup.get('duration_in_days')?.value;
    const option = this.durationOptions.find(opt => opt.days === days);
    return option ? option.label : 'Select Duration';
  }

  // --- Navigation ---
  goBack() {
    this.router.navigate([`/${this.role}/gym-plan`]);
  }

  // --- Submission (Handles BOTH Create and Update) ---
  async onSubmit() {
    // 1. Block submission if there are validation errors
    if (this.planForm.invalid || this.hasDuplicatePrices || this.hasDuplicateFeatures) {
      this.planForm.markAllAsTouched();
      return;
    }

    // 2. Logic specifically for Edit Mode
    if (this.isEditMode()) {
      
      // CRITICAL FIX: If nothing was changed, don't run the API
      if (this.planForm.pristine) {
        this.toastService.info('No changes were made to the plan.');
        this.router.navigate([`/${this.role}/gym-plan`]);
        return; // Exit out entirely
      }

      // If changes WERE made, ask for confirmation
      const confirmed = await this.dialogService.open({
        title: `Confirm Update`,
        message: `Are you sure you want to apply these changes to the subscription plan?`,
        mode: 'warning',
        confirmText: `Update Plan`,
        cancelText: 'Cancel'
      });

      if (!confirmed) {
        return; // Exit if admin cancels the dialog
      }
    }

    // 3. Process the Submission
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.closeDropdown();

    try {
      const formValue = this.planForm.getRawValue();
      const pricesPayload = formValue.prices;

      if (this.isEditMode() && this.editPlanId()) {
        // UPDATE Existing Plan
        await this.planService.updatePlanFull(
          this.editPlanId()!,
          { name: formValue.name, description: formValue.description },
          pricesPayload,
          formValue.features
        );

        // CLEAR CACHE: Ensure old details are wiped out locally so next visit fetches fresh data
        try {
          await this.storageService.removeItem(`plan_details_${this.editPlanId()}`);
        } catch (cacheError) {
          console.warn('Failed to clear cache on update:', cacheError);
        }

        this.toastService.success('Plan updated successfully!');
        this.router.navigate([`/${this.role}/gym-plan`]);
      } else {
        // CREATE New Plan
        await this.planService.createPlanFull(
          { name: formValue.name, description: formValue.description },
          pricesPayload,
          formValue.features
        );
        this.toastService.success('Plan created successfully!');
        
        // Reset state for new entry
        this.planForm.reset();
        this.pricesArray.clear();
        this.pricesArray.push(this.createPriceGroup());
        this.featuresArray.clear();
        this.featuresArray.push(this.createFeatureGroup());

        this.router.navigate([`/${this.role}/gym-plan`]);
      }
    } catch (error: any) {
      this.toastService.error(error.message || 'Failed to save plan.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
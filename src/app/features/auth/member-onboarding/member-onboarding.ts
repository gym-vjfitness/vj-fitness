import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MemberDto } from '../../../models/member.dto';
import { SupabaseService } from '../../../services/supabase-service';
import { Router } from '@angular/router';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service';

@Component({
  selector: 'app-member-onboarding',

  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-onboarding.html',
})
export class MemberOnboarding {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  onboardingForm!: FormGroup;
  isSubmitting = signal(false);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  profileId = computed(() => this.supabaseService.currentUser()?.id)

  // --- STATE ---
  heightVal = signal(170); // cm
  weightVal = signal(75);  // kg

  // --- CONFIGURATION ---
  bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  fitnessGoals = [
  {
    id: "fat_loss",
    label: "Fat Loss",
    desc: "Get Lean",
    icon: "🔥🏃"
  },
  {
    id: "weight_gain",
    label: "Weight Gain",
    desc: "Gain Healthy Weight",
    icon: "🥗📈"
  },
  {
    id: "muscle_building",
    label: "Muscle Building",
    desc: "Build Strength",
    icon: "🏋️💪"
  },
  {
    id: "body_fitness",
    label: "Body Fitness",
    desc: "Stay Healthy",
    icon: "🧘⚡"
  }
];

  // --- VISUAL COMPUTATION ---
  // Calculates the % width of the progress bar
  heightPercent = computed(() => {
    const min = 120, max = 220;
    const pct = ((this.heightVal() - min) / (max - min)) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  });

  weightPercent = computed(() => {
    const min = 40, max = 150;
    const pct = ((this.weightVal() - min) / (max - min)) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  });


  ngOnInit() {
    this.onboardingForm = this.fb.group({
      height: [170, Validators.required],
      weight: [75, Validators.required],
      blood_group: ['', Validators.required],
      fitness_goal: ['', Validators.required],
      medical_conditions: [''],
      injuries_history: ['']
    });
  }

  // --- ACTIONS ---

  updateHeight(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    this.heightVal.set(val);
    this.onboardingForm.patchValue({ height: val }, { emitEvent: false });
  }

  updateWeight(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    this.weightVal.set(val);
    this.onboardingForm.patchValue({ weight: val }, { emitEvent: false });
  }

  setSelection(field: string, val: string) {
    this.onboardingForm.patchValue({ [field]: val });
  }

  async onSubmit() {
    this.isSubmitting.set(true);
    if (this.onboardingForm.invalid) {
      return;
    }

    const formValue = this.onboardingForm.value;

    const memberPayload: MemberDto = {
      profile_id: this.profileId(),
      height_cm: formValue.height,
      weight_kg: formValue.weight,
      blood_group: formValue.blood_group,
      fitness_goal: formValue.fitness_goal,
      medical_conditions: formValue.medical_conditions,
      injuries_history: formValue.injuries_history
    };
    console.log(memberPayload);

    try {
      const { data, error } = await this.supabaseService.client
        .from('members')
        .insert(memberPayload)
        .select() // 👈 IMPORTANT: This returns the inserted row immediately
        .single(); // 👈 Use this if you are inserting 1 row and want an object back (not an array)

      if (error) {
        console.error('Supabase Insert Error:', error);
        throw error; // Re-throw so the component knows it failed
      }

      if (this.supabaseService.currentUser()?.new_user == true) {
        const { error: profileError } = await this.supabaseService.client
          .from('profiles')
          .update({ new_user: false, is_active: false })
          .eq('id', memberPayload.profile_id);

        if (profileError) {
          console.error('Profile update error, new_user failed to update after member creation:', error);
          throw error; // Re-throw so the component knows it failed
        }

        this.toastService.success("Profile created successfully");
      }

      await this.supabaseService.refreshUserProfile();
      this.router.navigate(['member/dashboard']);

    } catch (err) {
      console.log(err);
    } finally {
      this.isSubmitting.set(false);
    }


  }

  async logout() {

    const confirmed = await this.dialogService.open({
      title: `Loging Out`,
      message: `Are you sure you want to logout?`,
      mode: 'warning',
      confirmText: 'logout',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    this.supabaseService.logout();
  }
}
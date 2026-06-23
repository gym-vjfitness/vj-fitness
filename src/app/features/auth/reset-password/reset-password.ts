import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase-service';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service'; // Assumed correct path based on your prompt

// Custom Cross-Field Validator for Password Matching
export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const newPassword = control.get('newPassword');
  const confirmPassword = control.get('confirmPassword');

  if (!newPassword || !confirmPassword) return null;

  // Do not overwrite other validation errors on confirmPassword (like 'required')
  if (confirmPassword.errors && !confirmPassword.errors['mismatch']) {
    return null;
  }

  if (newPassword.value !== confirmPassword.value) {
    confirmPassword.setErrors({ mismatch: true });
    return { mismatch: true };
  } else {
    confirmPassword.setErrors(null);
    return null;
  }
};

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  hideOldPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  isSubmitting = signal(false);

  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);

  resetForm: FormGroup = this.fb.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  isInvalid(field: string): boolean {
    const control = this.resetForm.get(field);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  isValid(field: string): boolean {
    const control = this.resetForm.get(field);
    return control ? (control.valid && control.dirty) : false;
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.resetForm.get(field);
    return control ? (control.hasError(errorType) && (control.dirty || control.touched)) : false;
  }

  async onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    // Explicit User Confirmation via DialogService
    const confirmed = await this.dialogService.open({
      title: `Update Password`,
      message: `Confirm password update. You will need to sign in again.`,
      mode: 'warning',
      confirmText: 'Update Password',
      cancelText: 'Cancel'
    });

    if (!confirmed) {
      return; // Stop execution if user cancels
    }

    this.isSubmitting.set(true);
    const { oldPassword, newPassword } = this.resetForm.getRawValue();

    try {
      await this.supabaseService.updatePasswordWithVerification(oldPassword, newPassword);
      
      this.toastService.success('Password updated successfully!');
      this.resetForm.reset();
      this.supabaseService.logout();

    } catch (error: any) {
      console.error('Password Reset Failed:', error.message);
      this.toastService.danger(error.message || 'Failed to update password. Please check your old password.');
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
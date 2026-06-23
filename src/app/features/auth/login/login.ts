import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase-service';
import { ToastService } from '../../../services/toast-service'; // Added ToastService for user feedback

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.scss',
})
export class Login {
  hidePassword = true;
  isSubmitting = signal(false);

  supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService); // Injected to prevent the "hanged" feeling

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  isInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  isValid(field: string): boolean {
    const control = this.loginForm.get(field);
    return control ? (control.valid && control.dirty) : false;
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.loginForm.get(field);
    return control ? (control.hasError(errorType) && (control.dirty || control.touched)) : false;
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { email, password } = this.loginForm.getRawValue();

    try {
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error; 

      const { error: signOutError } = await this.supabaseService.client.auth.signOut({ scope: 'others' });
      
      if (signOutError) {
        console.error('Failed to log out other devices:', signOutError.message);
      } else {
        console.log('Successfully logged in and cleared older sessions.');
      }

      // This handles your LocalStorage cleanly
      await this.supabaseService.initializeAuth();

      // Cleanly extract user to avoid multiple function calls
      const user = this.supabaseService.currentUser();
      
      this.toastService.success('Login successful!');

      if(user?.user_role === 'member' && user?.temp_pass === true){
         this.router.navigate(['/auth/reset-password']);
        return;
      }


      if (user?.user_role === 'member' && user?.new_user === true) {
        this.router.navigate(['/auth/member-onboarding']);
        return;
      }
      
      // FIXED: Added '/' for Absolute Routing
      this.router.navigate([`/${user?.user_role}/dashboard`]);

    } catch (error: any) {
      console.error('Login Failed:', error.message);
      // FIXED: Shows error to user so the app doesn't feel frozen
      this.toastService.danger(error.message || 'Login failed. Please check your credentials.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
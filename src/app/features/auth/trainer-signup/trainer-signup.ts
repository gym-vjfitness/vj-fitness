import { Component, OnInit, signal, inject, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase-service'; 
import { UserMetadata } from '../../../models/user.model'; 
import { ToastService } from '../../../services/toast-service';

@Component({
  selector: 'app-trainer-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './trainer-signup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './trainer-signup.scss',
})
export class TrainerSignup implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  showPassword = false;
  private toastService = inject(ToastService);
  signupForm: FormGroup;
  isSubmitting = signal(false);

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  
  showGenderMenu = false;
  genders = ['Male', 'Female', 'Other'];

  showDatePicker = false;
  calendarView: 'year' | 'month' | 'day' = 'year';
  
  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  
  years: number[] = [];
  months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  daysInMonth: number[] = [];
  blankDays: number[] = [];
  selectedDateStr: string = '';

  constructor() {
    this.signupForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3), Validators.pattern('^[a-zA-Z\\s]+$')]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]], 
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      date_of_birth: ['', [Validators.required]],
      gender: ['', [Validators.required]],
      address: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    const currentY = new Date().getFullYear();
    const maxYear = currentY - 4;
    const minYear = currentY - 71;

    for (let i = maxYear; i >= minYear; i--) {
      this.years.push(i);
    }
  }

  @HostListener('document:click')
  closePopups() {
    this.showDatePicker = false;
    this.showGenderMenu = false;
  }

  isInvalid(field: string): boolean {
    const control = this.signupForm.get(field);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }
  
  isValid(field: string): boolean {
    const control = this.signupForm.get(field);
    return control ? (control.valid && control.dirty) : false;
  }

  hasError(field: string, errorType: string): boolean {
    const control = this.signupForm.get(field);
    return control ? (control.hasError(errorType) && (control.dirty || control.touched)) : false;
  }

  onNumberInput(event: Event, field: string, maxLength: number) {
    const input = event.target as HTMLInputElement;
    let sanitized = input.value.replace(/\D/g, ''); 
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    this.signupForm.get(field)?.setValue(sanitized, { emitEvent: false });
  }

  toggleGenderMenu(event: Event) {
    event.stopPropagation();
    this.showGenderMenu = !this.showGenderMenu;
    this.showDatePicker = false;
  }

  selectGender(gender: string) {
    this.signupForm.get('gender')?.setValue(gender);
    this.signupForm.get('gender')?.markAsDirty();
    this.showGenderMenu = false;
  }

  openDatePicker(event: Event) {
    event.stopPropagation();
    this.showDatePicker = !this.showDatePicker;
    this.showGenderMenu = false;
    this.calendarView = this.selectedYear ? 'day' : 'year'; 
  }

  selectYear(year: number) {
    this.selectedYear = year;
    this.calendarView = 'month';
  }

  selectMonth(monthIndex: number) {
    this.selectedMonth = monthIndex;
    this.generateDaysGrid(this.selectedYear!, this.selectedMonth);
    this.calendarView = 'day';
  }

  generateDaysGrid(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    this.blankDays = Array(firstDay).fill(0);
    this.daysInMonth = Array.from({length: days}, (_, i) => i + 1);
  }

  selectDay(day: number) {
    const formattedMonth = (this.selectedMonth! + 1).toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    
    this.signupForm.get('date_of_birth')?.setValue(`${this.selectedYear}-${formattedMonth}-${formattedDay}`);
    this.signupForm.get('date_of_birth')?.markAsDirty();
    
    this.selectedDateStr = `${formattedDay} ${this.months[this.selectedMonth!]} ${this.selectedYear}`;
    this.showDatePicker = false;
  }

  goBackInCalendar() {
    if (this.calendarView === 'day') this.calendarView = 'month';
    else if (this.calendarView === 'month') this.calendarView = 'year';
  }

  async onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }
    
    this.isSubmitting.set(true); 
    const formValues = this.signupForm.value;

    const metadata: UserMetadata = {
      full_name: formValues.full_name,
      phone: formValues.phone,
      user_role: 'trainer',
      gender: formValues.gender,
      date_of_birth: formValues.date_of_birth,
      address: formValues.address,
      avatar_url: null,
      is_active: true,
      new_user: false
    };

    try {
      const { data, error } = await this.supabase.client.auth.signUp({
        email: formValues.email,
        password: formValues.password, 
        options: {
          data: metadata 
        }
      });

      if (error) throw error;

      this.toastService.success('Trainer Account Created successfully');
      this.router.navigate(['auth/login']); 

    } catch (error: any) {
      console.error('Trainer Signup Error:', error.message);
      this.toastService.error(error.message || 'Failed trainer account creation');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

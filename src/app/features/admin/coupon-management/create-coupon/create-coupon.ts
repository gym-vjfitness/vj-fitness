import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CouponService } from '../../../../services/coupon-service';
import { CouponDTO } from '../../../../models/coupon.model';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';
import { SupabaseService } from '../../../../services/supabase-service';

function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('valid_from')?.value;
  const end = group.get('valid_until')?.value;
  if (start && end && new Date(end) <= new Date(start)) return { invalidDateRange: true };
  return null;
}

@Component({
  selector: 'app-create-coupon',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-coupon.html',
})
export class CreateCoupon implements OnInit {
  private fb = inject(FormBuilder);
  private couponService = inject(CouponService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
     role = this.supabaseService.currentUser()?.user_role || 'member';

  couponForm!: FormGroup;
  isSubmitting = signal(false);
  activeType = signal<'percent' | 'fixed'>('percent');
  editId = signal<string | null>(null);

  // Tracks form in real-time for ATM Card Preview
  formValues = signal<any>({});
  private initialPayloadString: string = '';

  activePicker = signal<'start' | 'end' | null>(null);
  currentMonth = signal<Date>(new Date());
  calendarDays = computed(() => this.generateCalendar(this.currentMonth()));

  async ngOnInit() {
    this.couponForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9]+$')]],
      discount_type: ['percent', Validators.required],
      discount_value: [null, [Validators.required, Validators.min(1)]],
      max_discount: [null, [Validators.min(1)]],
      max_usage: [null, [Validators.min(1)]],
      valid_from: [null, Validators.required], 
      valid_until: [null],
    }, { validators: dateRangeValidator });

    this.couponForm.valueChanges.subscribe(val => {
      this.formValues.set(val);
    });

    this.couponForm.get('discount_type')?.valueChanges.subscribe((type) => {
      this.activeType.set(type);
      const valCtrl = this.couponForm.get('discount_value');
      const maxCtrl = this.couponForm.get('max_discount');
      
      if (type === 'percent') {
        valCtrl?.setValidators([Validators.required, Validators.min(1), Validators.max(100)]);
      } else {
        valCtrl?.setValidators([Validators.required, Validators.min(1)]);
        maxCtrl?.setValue(null);
      }
      
      valCtrl?.updateValueAndValidity();
      maxCtrl?.updateValueAndValidity();
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      await this.loadCouponData(id);
    } else {
       this.formValues.set(this.couponForm.value);
    }
  }

  async loadCouponData(id: string) {
    try {
      const data = await this.couponService.getCouponById(id);
      this.activeType.set(data.discount_type);
      
      this.couponForm.patchValue({
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_discount: data.max_discount,
        max_usage: data.max_usage,
        valid_from: data.valid_from ? new Date(data.valid_from) : null,
        valid_until: data.valid_until ? new Date(data.valid_until) : null,
      });

      this.initialPayloadString = JSON.stringify(this.buildPayload());
      this.formValues.set(this.couponForm.value);
    } catch (error) {
      this.toastService.error('Authorization Failed');
      this.router.navigate([`/${this.role}/setting/coupon`]);
    }
  }

  setDiscountType(type: 'percent' | 'fixed') {
    this.couponForm.get('discount_type')?.setValue(type);
  }

  // ==========================================
  // THE FIX: Strict Input Interceptor
  // ==========================================
  forceUppercase(event: Event) {
    const input = event.target as HTMLInputElement;
    let cursor = input.selectionStart;

    // 1. Instantly strip any character that is NOT a letter or a number
    const sanitized = input.value.replace(/[^a-zA-Z0-9]/g, '');

    // 2. Force it to uppercase
    const finalValue = sanitized.toUpperCase();

    // 3. Adjust the cursor position if we deleted an illegal character
    if (input.value !== finalValue && cursor !== null) {
      cursor = Math.max(0, cursor - (input.value.length - finalValue.length));
    }

    // 4. Overwrite the HTML input visually AND update the Angular form state
    input.value = finalValue;
    this.couponForm.get('code')?.setValue(finalValue, { emitEvent: true });

    // 5. Put the cursor back where it belongs
    input.setSelectionRange(cursor, cursor); 
  }

  openPicker(type: 'start' | 'end') {
    this.activePicker.set(type);
    const currentValue = type === 'start' ? this.couponForm.value.valid_from : this.couponForm.value.valid_until;
    this.currentMonth.set(currentValue ? new Date(currentValue) : new Date());
  }

  closePicker() { this.activePicker.set(null); }

  changeMonth(delta: number) {
    const newDate = new Date(this.currentMonth());
    newDate.setMonth(newDate.getMonth() + delta);
    this.currentMonth.set(newDate);
  }

  selectDate(date: Date) {
    const controlName = this.activePicker() === 'start' ? 'valid_from' : 'valid_until';
    const strictDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    this.couponForm.get(controlName)?.setValue(strictDate);
    this.closePicker();
  }

  clearEndDate() {
    this.couponForm.get('valid_until')?.setValue(null);
    this.closePicker();
  }

  private generateCalendar(date: Date): (Date | null)[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }

  isSameDate(d1: Date | null, d2: Date | null): boolean {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
  }

  get isDateRangeInvalid() { return this.couponForm.errors?.['invalidDateRange']; }
  
  isFieldInvalid(field: string): boolean {
    const control = this.couponForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  getErrorMessage(field: string): string {
    const control = this.couponForm.get(field);
    if (!control || !control.errors) return '';
    
    if (control.errors['required']) return 'REQUIRED';
    if (control.errors['pattern']) return 'LETTERS & NUMBERS ONLY';
    if (control.errors['min']) return 'MUST BE GREATER THAN 0';
    if (control.errors['max']) return 'MAXIMUM IS 100%';
    if (control.errors['unique']) return 'CODE ALREADY EXISTS';
    
    return 'INVALID';
  }

private getISTTimestamp(dateValue: any, isEndOfDay: boolean = false): string | null {
    if (!dateValue) return null;
    
    // Safely parse the value whether it's a string from HTML or a Date object
    const d = new Date(dateValue);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    const datePart = `${year}-${month}-${day}`;
    
    // Force the exact time boundaries for the coupon
    const timePart = isEndOfDay ? '23:59:59' : '00:00:00';
    
    // Append the +05:30 timezone offset
    return `${datePart}T${timePart}+05:30`;
  }

  private buildPayload(): Partial<CouponDTO> {
    const val = this.couponForm.value;
    
    return {
      code: val.code.toUpperCase(),
      discount_type: val.discount_type,
      discount_value: val.discount_value,
      max_discount: val.discount_type === 'percent' ? val.max_discount : null,
      max_usage: val.max_usage || null,
      
      // ✅ Set 'valid_from' to exactly 00:00:00 IST
      valid_from: this.getISTTimestamp(val.valid_from, false),
      
      // ✅ Set 'valid_until' to exactly 23:59:59 IST (True for end of day)
      valid_until: this.getISTTimestamp(val.valid_until, true),
    };
  }

  async onSubmit() {
    if (this.couponForm.invalid) {
      this.couponForm.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();

    if (this.editId()) {
      if (JSON.stringify(payload) === this.initialPayloadString) {
        this.router.navigate([`/${this.role}/setting/coupon`]);
        return;
      }
      const confirmed = await this.dialogService.open({
        title: 'Apply Changes?',
        message: 'This will instantly update the coupon pass for all users.',
        mode: 'warning',
        confirmText: 'Update',
        cancelText: 'Cancel'
      });
      if (!confirmed) return;
    }

    this.isSubmitting.set(true);
    try {
      if (this.editId()) {
        await this.couponService.updateCoupon(this.editId()!, payload);
        this.toastService.success('Credentials Updated');
      } else {
        await this.couponService.createCoupon(payload as CouponDTO);
        this.toastService.success('Coupon Issued');
      }
      this.router.navigate([`/${this.role}/setting/coupon`]);
    } catch (e: any) {
      this.toastService.error(e?.code === '23505' ? 'Code Conflict' : 'Auth Error');
      if(e?.code === '23505') this.couponForm.get('code')?.setErrors({ unique: true });
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
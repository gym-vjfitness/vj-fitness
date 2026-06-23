import { Component, OnInit, inject, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../../../services/notification-service';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';
import { CreateAnnouncementDto } from '../../../../models/notification.model';
import { SupabaseService } from '../../../../services/supabase-service';

interface DropdownOption {
  value: string;
  label: string;
  iconPath: string;
  colorClass: string;
}

@Component({
  selector: 'app-create-notification',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-notification.html',
})
export class CreateNotification implements OnInit {
  notificationForm!: FormGroup;
  
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  isEditMode = signal(false);
  editingId = signal<string | null>(null);
  isLoading = signal(false);
  isFetchingData = signal(false);

  isTypeDropdownOpen = signal(false);
  isPriorityDropdownOpen = signal(false);
  isCategoryDropdownOpen = signal(false);

  types: DropdownOption[] = [
    { value: 'holiday', label: 'HOLIDAY', iconPath: 'M5 3v4M19 3v4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', colorClass: 'text-warning' },
    { value: 'advertisement', label: 'ADVERTISEMENT', iconPath: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', colorClass: 'text-info' }
  ];

  priorities: DropdownOption[] = [
    { value: 'low', label: 'LOW', iconPath: 'M5 13l4 4L19 7', colorClass: 'text-success' },
    { value: 'high', label: 'HIGH', iconPath: 'M13 10V3L4 14h7v7l9-11h-7z', colorClass: 'text-danger' }
  ];

  categories: DropdownOption[] = [
    { value: 'coupon', label: 'COUPON', iconPath: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', colorClass: 'text-accent' },
    { value: 'offer', label: 'OFFER', iconPath: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7', colorClass: 'text-primary' },
    { value: 'notice', label: 'Notice', iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', colorClass: 'text-secondary' }
  ];

  showDatePicker = signal<boolean>(false);
  calendarMonth = signal<number>(new Date().getMonth());
  calendarYear = signal<number>(new Date().getFullYear());
  startDate = signal<Date | null>(null);
  endDate = signal<Date | null>(null);
  months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  calendarDays = computed(() => {
    const year = this.calendarYear(); 
    const month = this.calendarMonth();
    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i < daysInMonth + 1; i++) days.push(new Date(year, month, i));
    return days;
  });

  ngOnInit() {
    this.notificationForm = this.fb.group({
      type: ['advertisement', Validators.required],
      title: ['', Validators.required],
      content: [''],
      category: ['offer', Validators.required],
      start_date: ['', Validators.required],
      expiry_date: ['', Validators.required],
      priority: ['low', Validators.required]
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.editingId.set(id);
        this.loadNotificationData(id);
      }
    });
  }

  async loadNotificationData(id: string) {
    this.isFetchingData.set(true);
    try {
      const data = await this.notificationService.getNotificationById(id);
      this.notificationForm.patchValue(data);
      
      if (data.start_date) this.startDate.set(new Date(data.start_date));
      if (data.expiry_date) this.endDate.set(new Date(data.expiry_date));
      if (data.start_date) {
        this.calendarMonth.set(this.startDate()!.getMonth());
        this.calendarYear.set(this.startDate()!.getFullYear());
      }

      this.notificationForm.markAsPristine();
    } catch (error) {
      this.toastService.error('Failed to load details.');
      this.goBack();
    } finally {
      this.isFetchingData.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.isTypeDropdownOpen.set(false);
      this.isPriorityDropdownOpen.set(false);
      this.isCategoryDropdownOpen.set(false);
    }
  }

  toggleDropdown(dropdown: 'type' | 'priority' | 'category', event: Event) {
    event.stopPropagation();
    this.showDatePicker.set(false); 
    if (dropdown === 'type') {
      this.isTypeDropdownOpen.update(v => !v);
      this.isPriorityDropdownOpen.set(false);
      this.isCategoryDropdownOpen.set(false);
    } else if (dropdown === 'priority') {
      this.isPriorityDropdownOpen.update(v => !v);
      this.isTypeDropdownOpen.set(false);
      this.isCategoryDropdownOpen.set(false);
    } else {
      this.isCategoryDropdownOpen.update(v => !v);
      this.isTypeDropdownOpen.set(false);
      this.isPriorityDropdownOpen.set(false);
    }
  }

  selectOption(controlName: string, value: string, event: Event) {
    event.stopPropagation();
    this.notificationForm.get(controlName)?.setValue(value);
    this.notificationForm.markAsDirty();
    this.isTypeDropdownOpen.set(false);
    this.isPriorityDropdownOpen.set(false);
    this.isCategoryDropdownOpen.set(false);
  }

  toggleDatePicker(event: Event) {
    event.stopPropagation();
    this.showDatePicker.update(v => !v);
    this.isTypeDropdownOpen.set(false);
    this.isPriorityDropdownOpen.set(false);
    this.isCategoryDropdownOpen.set(false);
  }

  prevMonth(event: Event) { 
    event.stopPropagation();
    this.calendarMonth() === 0 ? (this.calendarMonth.set(11), this.calendarYear.update(y=>y-1)) : this.calendarMonth.update(m=>m-1); 
  }
  
  nextMonth(event: Event) { 
    event.stopPropagation();
    this.calendarMonth() === 11 ? (this.calendarMonth.set(0), this.calendarYear.update(y=>y+1)) : this.calendarMonth.update(m=>m+1); 
  }

  // --- STRICT DATE LOGIC ---
  isDateDisabled(date: Date | null): boolean {
    if (!date) return true;
    
    // Strip times completely for accurate comparison
    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const compareDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // 1. MUST NOT BE TODAY OR PAST (Strictly Future)
    if (compareDay.getTime() <= todayDay.getTime()-1) return true;

    // 2. LIMIT TO 2 MONTHS (approx 60 days) FROM TODAY
    const diffFromToday = Math.ceil((compareDay.getTime() - todayDay.getTime()) / (1000 * 60 * 60 * 24));
    if (diffFromToday > 60) return true;

    // 3. IF START DATE IS SELECTED -> ENFORCE END DATE RULES
    if (this.startDate() && !this.endDate()) {
      const start = this.startDate()!;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      
      // End date cannot be before start date
      if (compareDay.getTime() < startDay.getTime()) return true;
      
      // MAX 7 DAYS DIFFERENCE AT ANY COST
      const diffFromStart = Math.ceil((compareDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
      if (diffFromStart > 7) return true; 
    }
    
    return false;
  }

  formatLocalYYYYMMDD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  selectDate(date: Date | null, event: Event) {
    event.stopPropagation();
    if (!date || this.isDateDisabled(date)) return;
    
    if (!this.startDate() || (this.startDate() && this.endDate())) {
      this.startDate.set(date); 
      this.endDate.set(null);
      this.notificationForm.patchValue({ start_date: this.formatLocalYYYYMMDD(date), expiry_date: '' });
      this.notificationForm.markAsDirty();
    } 
    else if (this.startDate() && !this.endDate()) {
      this.endDate.set(date); 
      this.notificationForm.patchValue({ expiry_date: this.formatLocalYYYYMMDD(date) });
      this.notificationForm.markAsDirty();
      this.showDatePicker.set(false); 
    }
  }

  clearDateSelection(event: Event) {
    event.stopPropagation(); 
    this.startDate.set(null); 
    this.endDate.set(null);
    this.notificationForm.patchValue({ start_date: '', expiry_date: '' });
    this.notificationForm.markAsDirty();
  }

  isDateSelected(date: Date | null): boolean { return !!date && ((this.startDate()?.getTime() === date.getTime()) || (this.endDate()?.getTime() === date.getTime())); }
  isInRange(date: Date | null): boolean { return !!date && !!this.startDate() && !!this.endDate() && date > this.startDate()! && date < this.endDate()!; }

  goBack() { this.router.navigate([`/${this.role}/notification`]); }

  async saveNotification() {
    if (this.notificationForm.invalid) {
      this.toastService.error('Please complete all required fields correctly.');
      this.notificationForm.markAllAsTouched();
      return;
    }

    const payload: CreateAnnouncementDto = this.notificationForm.value;

    try {
      if (this.isEditMode() && this.editingId()) {
        if (this.notificationForm.pristine) {
          this.toastService.info('No changes were made.');
          this.goBack();
          return;
        }

        const confirmed = await this.dialogService.open({
          title: `Update Announcement`,
          message: `Are you sure you want to apply these changes?`,
          mode: 'warning',
          confirmText: `Save Changes`,
          cancelText: 'Cancel'
        });

        if (confirmed) {
          this.isLoading.set(true);
          await this.notificationService.updateNotification(this.editingId()!, payload);
          this.toastService.success('Announcement updated successfully!');
          this.goBack();
        }
      } else {
        this.isLoading.set(true);
        await this.notificationService.createNotification(payload);
        this.toastService.success('Announcement created successfully!');
        this.goBack();
      }
    } catch (error) {
      this.toastService.error('Failed to save announcement.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
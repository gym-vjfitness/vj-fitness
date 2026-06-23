import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserSubscriptionService } from '../../../services/user-subscription-service';
import { SupabaseService } from '../../../services/supabase-service';
import { FormatedDateUtils } from '../../../shared/formated-date.utils';

export interface MinimalSubscriptionMeta {
  id: string;
  purchased_price: number;
  profiles: { full_name: string };
}

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription-management.html',
})
export class SubscriptionManagement implements OnInit {
  private subscriptionService = inject(UserSubscriptionService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  subscriptions = signal<MinimalSubscriptionMeta[]>([]);
  isLoading = signal<boolean>(true);

  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  totalCount = signal<number>(0);
  pageSize = 10;

  searchInput = signal<string>('');
  searchTerm = signal<string>('');
  
  selectedStatus = signal<string>('PENDING'); 
  isStatusDropdownOpen = signal<boolean>(false);
  
  // Added "Expires in 7 Days" state
  isExpiresIn7DaysActive = signal<boolean>(false);

  // Updated CANCELLED icon & added EXPIRED
  statusOptions = [
    { value: 'PENDING', label: 'PENDING', iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-warning' },
    { value: 'ACTIVE', label: 'ACTIVE', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-success' },
    { value: 'PAUSED', label: 'PAUSED', iconPath: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-info' },
    { value: 'REJECTED', label: 'REJECTED', iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-danger' },
    { value: 'CANCELLED', label: 'CANCELLED', iconPath: 'M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 0L5.636 18.364', color: 'text-muted' },
    { value: 'EXPIRED', label: 'EXPIRED', iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'text-muted' },
  ];

  showDatePicker = signal<boolean>(false);
  calendarMonth = signal<number>(new Date().getMonth());
  calendarYear = signal<number>(new Date().getFullYear());
  startDate = signal<Date | null>(null);
  endDate = signal<Date | null>(null);

  startIndex = computed(() => this.totalCount() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1);
  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize, this.totalCount()));
  
  calendarDays = computed(() => {
    const year = this.calendarYear(); const month = this.calendarMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i < daysInMonth + 1; i++) days.push(new Date(year, month, i));
    return days;
  });

  months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  ngOnInit() { 
    const saved = this.subscriptionService.savedFilterState;
    if (saved) {
      this.searchInput.set(saved.searchInput);
      this.searchTerm.set(saved.searchTerm);
      this.selectedStatus.set(saved.selectedStatus);
      this.startDate.set(saved.startDate ? new Date(saved.startDate) : null);
      this.endDate.set(saved.endDate ? new Date(saved.endDate) : null);
      this.currentPage.set(saved.currentPage);
      this.isExpiresIn7DaysActive.set(saved.isExpiresIn7DaysActive || false);
    }
    this.loadData(); 
  }

  private getISTTimestamp(dateValue: any, isEndOfDay: boolean = false): string | null {
    return FormatedDateUtils.getISTTimestampBoundary(dateValue, isEndOfDay);
  }

  saveState() {
    this.subscriptionService.savedFilterState = {
      searchInput: this.searchInput(),
      searchTerm: this.searchTerm(),
      selectedStatus: this.selectedStatus(),
      startDate: this.getISTTimestamp(this.startDate(), false),
      endDate: this.getISTTimestamp(this.endDate(), true),
      currentPage: this.currentPage(),
      isExpiresIn7DaysActive: this.isExpiresIn7DaysActive()
    };
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const startIso = this.getISTTimestamp(this.startDate(), false) || '';
      const endIso = this.getISTTimestamp(this.endDate(), true) || '';
      
      const result = await this.subscriptionService.getSubscriptionsMeta(
        this.currentPage(), 
        this.pageSize, 
        this.searchTerm(), 
        this.selectedStatus(), 
        startIso, 
        endIso,
        this.isExpiresIn7DaysActive()
      );
      this.subscriptions.set(result.data);
      this.totalCount.set(result.count);
      this.totalPages.set(Math.ceil(result.count / this.pageSize) || 1);
      
      this.saveState();
    } catch (error) { 
      console.error(error); 
    } finally { 
      this.isLoading.set(false); 
    }
  }

  onSearchInput(event: any) { this.searchInput.set(event.target.value); }
  executeSearch() { this.searchTerm.set(this.searchInput()); this.currentPage.set(1); this.loadData(); }
  
  clearSearch() { 
    this.searchInput.set(''); 
    if (this.searchTerm().length > 0) { 
      this.searchTerm.set(''); 
      this.currentPage.set(1); 
      this.loadData(); 
    } 
  }

  // Toggle "Expires in 7 days" Logic
  toggleExpiresIn7Days() {
    const newState = !this.isExpiresIn7DaysActive();
    this.isExpiresIn7DaysActive.set(newState);
    
    if (newState) {
      this.selectedStatus.set('ACTIVE');
      this.startDate.set(null);
      this.endDate.set(null);
    }
    
    this.currentPage.set(1);
    this.loadData();
  }

  toggleStatusDropdown() { 
    this.isStatusDropdownOpen.set(!this.isStatusDropdownOpen()); 
    this.showDatePicker.set(false);
  }
  
  selectStatus(statusValue: string) {
    this.selectedStatus.set(statusValue);
    this.isStatusDropdownOpen.set(false);
    this.isExpiresIn7DaysActive.set(false); // Disable toggle on manipulation
    this.currentPage.set(1);
    this.loadData();
  }

  toggleDatePicker() { 
    this.showDatePicker.set(!this.showDatePicker()); 
    this.isStatusDropdownOpen.set(false);
  }
  
  closeModals() { 
    this.showDatePicker.set(false); 
    this.isStatusDropdownOpen.set(false); 
  }
  
  prevMonth() { this.calendarMonth() === 0 ? (this.calendarMonth.set(11), this.calendarYear.update(y=>y-1)) : this.calendarMonth.update(m=>m-1); }
  nextMonth() { this.calendarMonth() === 11 ? (this.calendarMonth.set(0), this.calendarYear.update(y=>y+1)) : this.calendarMonth.update(m=>m+1); }

  isDateDisabled(date: Date | null): boolean {
    if (!date) return true;
    
    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const compareDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (compareDay > todayDay) return true;

    if (this.startDate() && !this.endDate()) {
      const start = this.startDate()!;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      
      if (compareDay < startDay) return true;
      
      const diffTime = compareDay.getTime() - startDay.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 30) return true; 
    }
    
    return false;
  }

  selectDate(date: Date | null) {
    if (!date || this.isDateDisabled(date)) return;
    this.isExpiresIn7DaysActive.set(false); // Disable toggle on manipulation
    
    if (!this.startDate() || (this.startDate() && this.endDate())) {
      this.startDate.set(date); this.endDate.set(null);
    } else if (this.startDate() && !this.endDate()) {
      this.endDate.set(date); 
      this.showDatePicker.set(false); 
      this.currentPage.set(1); 
      this.loadData();
    }
  }

  clearDateSelection(event?: Event) {
    if (event) event.stopPropagation(); 
    this.isExpiresIn7DaysActive.set(false); // Disable toggle on manipulation
    this.startDate.set(null); this.endDate.set(null);
    this.currentPage.set(1); this.loadData();
  }

  isDateSelected(date: Date | null): boolean { return !!date && ((this.startDate()?.getTime() === date.getTime()) || (this.endDate()?.getTime() === date.getTime())); }
  isInRange(date: Date | null): boolean { return !!date && !!this.startDate() && !!this.endDate() && date > this.startDate()! && date < this.endDate()!; }

  nextPage() { if (this.currentPage() < this.totalPages()) { this.currentPage.update(p => p + 1); this.loadData(); } }
  prevPage() { if (this.currentPage() > 1) { this.currentPage.update(p => p - 1); this.loadData(); } }

  getStatusClass(status: string): string {
    const base = 'text-[10px] sm:text-[11px] font-black uppercase tracking-widest leading-none ';
    switch (status) {
      case 'ACTIVE': return base + 'text-success';
      case 'PENDING': return base + 'text-warning';
      case 'PAUSED': return base + 'text-info';
      case 'REJECTED': return base + 'text-danger';
      default: return base + 'text-muted'; // CANCELLED and EXPIRED fall under muted
    }
  }
}
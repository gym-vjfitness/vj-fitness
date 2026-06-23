import { Component, OnInit, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../../services/toast-service';
import { AttendanceHistoryService } from '../../../services/attendance-history-service';

@Component({
  selector: 'app-attendace-history',
  standalone: true,
  imports: [CommonModule, FormsModule,DatePipe],
  templateUrl: './attendace-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './attendace-history.scss',
})
export class AttendaceHistory implements OnInit {
  public historyService = inject(AttendanceHistoryService);
  public toastService = inject(ToastService);

  dailySearchInput = signal<string>('');
  memberSearchInput = signal<string>('');
  memberSearchResults = signal<any[]>([]);
  isSearchingMembers = signal<boolean>(false);

  isCalendarOpen = false;
  calendarTarget: 'daily' | 'start' | 'end' | null = null;
  calendarDate = new Date(); 
  calendarDays: (number | null)[] = [];
  weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  readonly todayDate = new Date();
  readonly minAllowedDate = new Date(this.todayDate.getTime() - 60 * 24 * 60 * 60 * 1000); 

  dailyTotalPages = computed(() => Math.max(1, Math.ceil(this.historyService.dailyTotal() / this.historyService.dailyPageSize())));
  dailyHasNext = computed(() => this.historyService.dailyPage() < this.dailyTotalPages());
  dailyHasPrev = computed(() => this.historyService.dailyPage() > 1);
  dailyStartIndex = computed(() => this.historyService.dailyTotal() === 0 ? 0 : (this.historyService.dailyPage() - 1) * this.historyService.dailyPageSize() + 1);
  dailyEndIndex = computed(() => Math.min(this.historyService.dailyPage() * this.historyService.dailyPageSize(), this.historyService.dailyTotal()));

  memberTotalPages = computed(() => Math.max(1, Math.ceil(this.historyService.memberTotal() / this.historyService.memberPageSize())));
  memberHasNext = computed(() => this.historyService.memberPage() < this.memberTotalPages());
  memberHasPrev = computed(() => this.historyService.memberPage() > 1);
  memberStartIndex = computed(() => this.historyService.memberTotal() === 0 ? 0 : (this.historyService.memberPage() - 1) * this.historyService.memberPageSize() + 1);
  memberEndIndex = computed(() => Math.min(this.historyService.memberPage() * this.historyService.memberPageSize(), this.historyService.memberTotal()));

  ngOnInit() {
    this.dailySearchInput.set(this.historyService.dailySearch());
    if (!this.historyService.dailyHasLoaded()) {
      this.historyService.fetchDailyAttendance();
    }
  }

  setTab(tab: 'daily' | 'member') {
    this.historyService.activeTab.set(tab);
    if (tab === 'member' && this.historyService.selectedMemberId() && !this.historyService.memberHasLoaded()) {
      this.triggerMemberHistoryRefresh();
    }
  }

  performDailySearch() {
    this.historyService.dailySearch.set(this.dailySearchInput().trim());
    this.historyService.dailyPage.set(1);
    this.historyService.fetchDailyAttendance();
  }

  clearDailySearch() {
    this.dailySearchInput.set('');
    if (this.historyService.dailySearch() !== '') {
      this.historyService.dailySearch.set('');
      this.historyService.dailyPage.set(1);
      this.historyService.fetchDailyAttendance();
    }
  }

  dailyNextPage() { if (this.dailyHasNext()) { this.historyService.dailyPage.update(p => p + 1); this.historyService.fetchDailyAttendance(); } }
  dailyPrevPage() { if (this.dailyHasPrev()) { this.historyService.dailyPage.update(p => p - 1); this.historyService.fetchDailyAttendance(); } }

  async performMemberSearch() {
    const term = this.memberSearchInput().trim();
    if (term.length < 1) return;
    
    this.isSearchingMembers.set(true);
    const results = await this.historyService.searchProfiles(term);
    this.memberSearchResults.set(results);
    this.isSearchingMembers.set(false);
  }

  selectMember(member: any) {
    this.memberSearchInput.set('');
    this.memberSearchResults.set([]);
    this.historyService.selectedMemberId.set(member.id);
    this.historyService.selectedMemberName.set(member.full_name);
    
    // FIX: Force dates to reset to TODAY every time a new member is selected
    const today = this.historyService.getTodayDateString();
    this.historyService.memberStartDate.set(today);
    this.historyService.memberEndDate.set(today);
    
    this.historyService.memberPage.set(1);
    this.triggerMemberHistoryRefresh();
  }

  clearSelectedMember() {
    this.historyService.selectedMemberId.set(null);
    this.historyService.selectedMemberName.set('');
    this.historyService.memberData.set([]);
    this.historyService.memberTotal.set(0);
    this.memberSearchInput.set('');
    this.memberSearchResults.set([]);
  }

  triggerMemberHistoryRefresh() {
    if (!this.historyService.selectedMemberId()) return;

    const start = this.historyService.memberStartDate();
    const end = this.historyService.memberEndDate();

    if (!start) {
      this.toastService.warning('Please select a valid Start Date.');
      return;
    }
    if (!end) {
      this.toastService.warning('Please select a valid End Date.');
      return;
    }
    if (start > end) {
      this.toastService.danger('Invalid Range: End Date cannot be earlier than Start Date.');
      return; 
    }

    this.historyService.memberPage.set(1);
    this.historyService.fetchMemberHistory();
  }

  memberNextPage() { if (this.memberHasNext()) { this.historyService.memberPage.update(p => p + 1); this.historyService.fetchMemberHistory(); } }
  memberPrevPage() { if (this.memberHasPrev()) { this.historyService.memberPage.update(p => p - 1); this.historyService.fetchMemberHistory(); } }

  // ==================== CALENDAR SYSTEM ====================
  openCalendar(target: 'daily' | 'start' | 'end') {
    this.calendarTarget = target;
    let dateStr = '';
    if (target === 'daily') dateStr = this.historyService.dailyDate();
    if (target === 'start') dateStr = this.historyService.memberStartDate();
    if (target === 'end') dateStr = this.historyService.memberEndDate();

    this.calendarDate = new Date(dateStr);
    this.generateCalendarGrid();
    this.isCalendarOpen = true;
  }

  closeCalendar() {
    this.isCalendarOpen = false;
    this.calendarTarget = null;
  }

  changeMonth(offset: number) {
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + offset, 1);
    this.generateCalendarGrid();
  }

  generateCalendarGrid() {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.calendarDays = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];
  }

 isDisabledDate(day: number | null): boolean {
    if (day === null) return true;
    
    // Construct the date being checked
    const checkDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth(), day);
    const tzOffset = checkDate.getTimezoneOffset() * 60000;
    const localCheckStr = new Date(checkDate.getTime() - tzOffset).toISOString().split('T')[0];
    
    // BASE LIMITS: No future dates, no dates older than 60 days
    const todayStr = new Date(this.todayDate.getTime() - tzOffset).toISOString().split('T')[0];
    const minStr = new Date(this.minAllowedDate.getTime() - tzOffset).toISOString().split('T')[0];

    if (localCheckStr > todayStr || localCheckStr < minStr) return true;

    // START DATE: Kept exactly as your original logic
    if (this.calendarTarget === 'start') {
      const endStr = this.historyService.memberEndDate();
      if (endStr && localCheckStr > endStr) return true; 
    }
    
    // END DATE: Enforces the 10-day maximum limit after Start Date
    if (this.calendarTarget === 'end') {
      const startStr = this.historyService.memberStartDate();
      if (startStr) {
        // 1. Cannot be earlier than Start Date
        if (localCheckStr < startStr) return true; 

        // 2. Cannot be more than 10 days after Start Date
        const [sYear, sMonth, sDay] = startStr.split('-').map(Number);
        const maxEndDate = new Date(sYear, sMonth - 1, sDay + 10);
        const maxEndTzOffset = maxEndDate.getTimezoneOffset() * 60000;
        const maxEndDateStr = new Date(maxEndDate.getTime() - maxEndTzOffset).toISOString().split('T')[0];

        if (localCheckStr > maxEndDateStr) return true; 
      }
    }

    return false;
  }

  selectDate(day: number | null) {
    if (this.isDisabledDate(day)) return; 
    
    const selectedDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth(), day as number);
    const tzOffset = selectedDate.getTimezoneOffset() * 60000;
    const formattedDate = (new Date(selectedDate.getTime() - tzOffset)).toISOString().split('T')[0];

    if (this.calendarTarget === 'daily') {
      this.historyService.dailyDate.set(formattedDate);
      this.historyService.dailyPage.set(1);
      this.historyService.fetchDailyAttendance();
    } else if (this.calendarTarget === 'start') {
      this.historyService.memberStartDate.set(formattedDate);
      this.triggerMemberHistoryRefresh(); 
    } else if (this.calendarTarget === 'end') {
      this.historyService.memberEndDate.set(formattedDate);
      this.triggerMemberHistoryRefresh(); 
    }

    this.closeCalendar();
  }

  isSelectedDate(day: number | null): boolean {
    if (day === null || !this.calendarTarget) return false;
    let targetStr = '';
    if (this.calendarTarget === 'daily') targetStr = this.historyService.dailyDate();
    if (this.calendarTarget === 'start') targetStr = this.historyService.memberStartDate();
    if (this.calendarTarget === 'end') targetStr = this.historyService.memberEndDate();

    if (!targetStr) return false;
    const [tYear, tMonth, tDay] = targetStr.split('-').map(Number);
    return this.calendarDate.getFullYear() === tYear && this.calendarDate.getMonth() + 1 === tMonth && day === tDay;
  }

 

  formatDateUI(dateStr: string): string {
    if (!dateStr) return 'Select Date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
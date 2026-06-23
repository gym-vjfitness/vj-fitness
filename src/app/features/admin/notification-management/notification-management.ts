import { Component, OnInit, inject, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from '../../../services/notification-service';
import { ToastService } from '../../../services/toast-service';
import { DialogService } from '../../../services/dialog-service';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-notification-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './notification-management.scss',
})
export class NotificationManagement implements OnInit {
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  notifications = this.notificationService.notifications;
  totalItems = this.notificationService.totalItems;
  currentPage = this.notificationService.currentPage;
  pageSize = this.notificationService.pageSize;
  searchTerm = this.notificationService.searchTerm;
  searchInput = this.notificationService.searchInput;
  selectedType = this.notificationService.selectedType;

  isLoading = signal<boolean>(true);
  isFilterDropdownOpen = signal<boolean>(false);
  openMenuId = signal<string | null>(null);

  filterTypes = [
    { name: 'All Announcements', colorClass: 'text-foreground bg-surface', path: 'M4 6h16M4 12h16M4 18h16' },
    { name: 'holiday', colorClass: 'text-warning bg-warning/10', path: 'M5 3v4M19 3v4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { name: 'advertisement', colorClass: 'text-info bg-info/10', path: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' }
  ];

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  hasNextPage = computed(() => this.currentPage() < this.totalPages());
  hasPrevPage = computed(() => this.currentPage() > 1);

  startIndex = computed(() => this.totalItems() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1);
  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalItems()));

  ngOnInit() {
    if (!this.notificationService.hasLoaded()) {
      this.loadNotifications();
    } else {
      this.isLoading.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-dropdown')) this.isFilterDropdownOpen.set(false);
    if (!target.closest('.action-menu')) this.closeMenu();
  }

  async loadNotifications() {
    this.isLoading.set(true);
    try {
      const response = await this.notificationService.getNotifications(
        this.currentPage(),
        this.pageSize(),
        this.searchTerm(),
        this.selectedType() === 'All Announcements' ? '' : this.selectedType()
      );
      this.notifications.set(response.data);
      this.totalItems.set(response.count);
      this.notificationService.hasLoaded.set(true);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      this.toastService.error('Failed to load notifications.');
    } finally {
      this.isLoading.set(false);
    }
  }

  performSearch() {
    this.searchTerm.set(this.searchInput());
    this.currentPage.set(1);
    this.loadNotifications();
  }

  clearSearch() {
    this.searchInput.set('');
    if (this.searchTerm() !== '') {
      this.searchTerm.set('');
      this.currentPage.set(1);
      this.loadNotifications();
    }
  }

  toggleFilterDropdown(event: Event) {
    event.stopPropagation();
    this.isFilterDropdownOpen.update(v => !v);
  }

  selectFilter(typeName: string, event: Event) {
    event.stopPropagation();
    this.selectedType.set(typeName === 'All Announcements' ? '' : typeName);
    this.isFilterDropdownOpen.set(false);
    this.currentPage.set(1);
    this.loadNotifications();
  }

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId.update(current => current === id ? null : id);
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  goToCreate() {
    this.router.navigate([`/${this.role}/notification/create`]);
  }

  editNotification(id: string) {
    this.closeMenu();
    this.router.navigate([`/${this.role}/notification/update`, id]);
  }

  async deleteNotification(id: string) {
    this.closeMenu();
    const confirmed = await this.dialogService.open({
      title: 'Delete Announcement',
      message: 'Are you sure you want to delete this? It will be removed from all users.',
      mode: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        await this.notificationService.deleteNotification(id);
        this.toastService.success('Announcement deleted successfully!');
        this.loadNotifications();
      } catch (err) {
        this.toastService.error('Failed to delete announcement.');
      }
    }
  }

  goToNextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
      this.loadNotifications();
    }
  }

  goToPrevPage() {
    if (this.hasPrevPage()) {
      this.currentPage.update(p => p - 1);
      this.loadNotifications();
    }
  }
}
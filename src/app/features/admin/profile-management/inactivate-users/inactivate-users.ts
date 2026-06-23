import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService } from '../../../../services/profile-service';
import { ProfileShortInfoDto } from '../../../../models/user.model';
import { DialogService } from '../../../../services/dialog-service';
import { ToastService } from '../../../../services/toast-service';
import { SupabaseService } from '../../../../services/supabase-service';

@Component({
  selector: 'app-inactivate-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inactivate-users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './inactivate-users.scss',
})
export class InactivateUsers {
  members = signal<ProfileShortInfoDto[]>([]);
  isLoading = signal<boolean>(false);

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);

  searchQuery = signal<string>('');
  activeMenuId = signal<string | null>(null);
  expandedMemberId = signal<string | null>(null);

  selectedMemberIds = signal<Set<string>>(new Set<string>());

  isAllSelected = computed(() => {
    const list = this.members();
    return list.length > 0 && list.every(m => this.selectedMemberIds().has(m.id));
  });

  isIndeterminate = computed(() => {
    const list = this.members();
    const selectedCount = list.filter(m => this.selectedMemberIds().has(m.id)).length;
    return selectedCount > 0 && selectedCount < list.length;
  });

  hasSelection = computed(() => this.selectedMemberIds().size > 0);

  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));
  hasNextPage = computed(() => this.currentPage() * this.pageSize() < this.totalCount());
  hasPrevPage = computed(() => this.currentPage() > 1);

  displayedCount = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalCount()));
  startCount = computed(() => (this.currentPage() - 1) * this.pageSize() + (this.totalCount() > 0 ? 1 : 0));

  private profileService = inject(ProfileService);
  private router = inject(Router);
  dialogService = inject(DialogService);
  toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);

   role = this.supabaseService.currentUser()?.user_role || 'member';

  ngOnInit() {
    // Attempt to load previously viewed state
    const state = this.profileService.getInactiveState();
    if (state.loaded) {
      this.currentPage.set(state.page);
      this.searchQuery.set(state.search);
      this.members.set(state.data);
      this.totalCount.set(state.count);
    } else {
      this.fetchMembers();
    }
  }

  navigateToActive() {
    this.router.navigate([`/${this.role}/members`]);
  }

  toggleAllSelection() {
    if (this.isAllSelected()) {
      this.selectedMemberIds.set(new Set());
    } else {
      const allIds = this.members().map(m => m.id);
      this.selectedMemberIds.set(new Set(allIds));
    }
  }

  toggleMemberSelection(id: string, event: Event) {
    event.stopPropagation();
    const currentSelection = new Set(this.selectedMemberIds());
    if (currentSelection.has(id)) {
      currentSelection.delete(id);
    } else {
      currentSelection.add(id);
    }
    this.selectedMemberIds.set(currentSelection);
  }

  async deleteSelected() {
    const idsToDelete = Array.from(this.selectedMemberIds());
    if (idsToDelete.length === 0) return;

    const confirmed = await this.dialogService.open({
      title: 'Delete Users',
      message: `Are you sure you want to permanently delete ${idsToDelete.length} user(s)? This action cannot be undone and will remove all their health and attendance records.`,
      mode: 'delete',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      this.isLoading.set(true);
      try {
        await this.profileService.deleteMembers(idsToDelete);
        this.toastService.success(`Successfully deleted ${idsToDelete.length} user(s).`);
        this.selectedMemberIds.set(new Set());
        
        // Refresh local UI using updated cache instead of hitting API
        const state = this.profileService.getInactiveState();
        this.members.set(state.data);
        this.totalCount.set(state.count);

        if (state.data.length === 0 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
          this.fetchMembers();
        }
      } catch (error) {
        this.toastService.error('Failed to delete users. Please try again.');
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async deleteSingle(id: string) {
    this.closeMenu();

    const confirmed = await this.dialogService.open({
      title: 'Delete User',
      message: 'Are you sure you want to permanently delete this user? All associated records will be destroyed.',
      mode: 'delete',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      this.isLoading.set(true);
      try {
        await this.profileService.deleteMembers([id]);
        this.toastService.success('User deleted successfully.');
        
        const currentSelection = new Set(this.selectedMemberIds());
        currentSelection.delete(id);
        this.selectedMemberIds.set(currentSelection);

        // Refresh local UI using updated cache instead of hitting API
        const state = this.profileService.getInactiveState();
        this.members.set(state.data);
        this.totalCount.set(state.count);

        if (state.data.length === 0 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
          this.fetchMembers();
        }
      } catch (error) {
        this.toastService.error('Failed to delete user.');
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  toggleExpand(id: string) {
    this.expandedMemberId.update(current => (current === id ? null : id));
  }

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.activeMenuId.update(current => (current === id ? null : id));
  }

  closeMenu() {
    this.activeMenuId.set(null);
  }

  onSearch(query: string) {
    this.searchQuery.set(query);
    this.currentPage.set(1);
    this.fetchMembers();
  }

  nextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update(page => page + 1);
      this.fetchMembers();
    }
  }

  prevPage() {
    if (this.hasPrevPage()) {
      this.currentPage.update(page => page - 1);
      this.fetchMembers();
    }
  }

  async fetchMembers() {
    this.isLoading.set(true);
    this.selectedMemberIds.set(new Set()); 
    
    try {
      const result = await this.profileService.getMembers(this.currentPage(), this.pageSize(), this.searchQuery(), false);
      this.members.set(result.data);
      this.totalCount.set(result.count);
    } catch (error) {
      console.error('Error fetching inactive members:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async changeActiveStatus(userId: string, isActive: boolean) {
    const confirmed = await this.dialogService.open({
      title: `Notice`,
      message: `Allow this user to access their account again?`,
      mode: 'warning',
      confirmText: `Allow`,
      cancelText: 'Cancel'
    });

    if (confirmed) {
      await this.profileService.updateMemberActiveStatus(userId, isActive);
      this.toastService.success('User Activated successfully!');
      
      const state = this.profileService.getInactiveState();
      this.members.set(state.data);
      this.totalCount.set(state.count);

      if (state.data.length === 0 && this.currentPage() > 1) {
        this.currentPage.update(p => p - 1);
        this.fetchMembers();
      }
    }
  }

  clearSearch(inputElement: HTMLInputElement) {
    inputElement.value = '';
    if (this.searchQuery() !== '') {
      this.searchQuery.set('');
      this.currentPage.set(1);
      this.fetchMembers();
    }
  }
}
import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ProfileService } from '../../../services/profile-service';
import { ProfileShortInfoDto } from '../../../models/user.model';
import { DialogService } from '../../../services/dialog-service';
import { ToastService } from '../../../services/toast-service';
import { UserResetService } from '../../../services/user-reset-service';
import { SupabaseService } from '../../../services/supabase-service';

@Component({
  selector: 'app-profile-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './profile-management.scss',
})
export class ProfileManagement {
  members = signal<ProfileShortInfoDto[]>([]);
  isLoading = signal<boolean>(false);

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);

  searchQuery = signal<string>('');
  activeMenuId = signal<string | null>(null);
  expandedMemberId = signal<string | null>(null);

  resetInProgressId = signal<string | null>(null);

  /**
   * Stores the latest generated temp password per user.
   * This is what allows the UI to show the password chip beside the reset button.
   */
  tempPasswords = signal<Record<string, string>>({});

  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));
  hasNextPage = computed(() => this.currentPage() * this.pageSize() < this.totalCount());
  hasPrevPage = computed(() => this.currentPage() > 1);

  displayedCount = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalCount()));
  startCount = computed(() => (this.currentPage() - 1) * this.pageSize() + (this.totalCount() > 0 ? 1 : 0));

  private profileService = inject(ProfileService);
  private userResetService = inject(UserResetService);
  private router = inject(Router);
  dialogService = inject(DialogService);
  toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);
   role = this.supabaseService.currentUser()?.user_role || 'member';

  ngOnInit() {
    const state = this.profileService.getActiveState();

    if (state.loaded) {
      this.currentPage.set(state.page);
      this.searchQuery.set(state.search);
      this.members.set(state.data);
      this.totalCount.set(state.count);
    } else {
      this.fetchMembers();
    }
  }

  navigateToInactive() {
    this.router.navigate([`/${this.role}/members/inactive`]);
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

    try {
      const result = await this.profileService.getMembers(
        this.currentPage(),
        this.pageSize(),
        this.searchQuery(),
        true
      );

      this.members.set(result.data);
      this.totalCount.set(result.count);
    } catch (error) {
      console.error('Error fetching members:', error);
      this.toastService.error('Failed to load members.');
    } finally {
      this.isLoading.set(false);
    }
  }

  viewDetails(profileInfo: ProfileShortInfoDto) {
    this.closeMenu();

    this.router.navigate([`${this.role}/members/details`, profileInfo.id], {
      state: { profileInfo },
    });
  }

  openOfflineCheckout(user: ProfileShortInfoDto) {
    this.closeMenu();

    this.router.navigate([`/${this.role}/offline-checkout`], {
      state: {
        profileId: user.id,
        userName: user.full_name,
      },
    });
  }

  async changeActiveStatus(userId: string, isActive: boolean) {
    const confirmed = await this.dialogService.open({
      title: isActive ? 'Activate user?' : 'Deactivate user?',
      message: isActive
        ? 'Do you want to activate this user account?'
        : 'Do you want to deactivate this user account?',
      mode: 'warning',
      confirmText: isActive ? 'Activate' : 'Deactivate',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    try {
      await this.profileService.updateMemberActiveStatus(userId, isActive);
      this.toastService.success(
        isActive ? 'User activated successfully!' : 'User deactivated successfully!'
      );

      const state = this.profileService.getActiveState();
      this.members.set(state.data);
      this.totalCount.set(state.count);

      if (state.data.length === 0 && this.currentPage() > 1) {
        this.currentPage.update(p => p - 1);
        this.fetchMembers();
      }
    } catch (error) {
      console.error('Error changing active status:', error);
      this.toastService.error('Could not update user status.');
    }
  }

  async resetPassword(member: ProfileShortInfoDto, event?: Event) {
    event?.stopPropagation();

    if (this.resetInProgressId() === member.id) return;

    const confirmed = await this.dialogService.open({
      title: 'Reset password?',
      message: `Create a temporary password for ${member.full_name || member.email || 'this member'}?`,
      mode: 'warning',
      confirmText: 'Reset',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    this.resetInProgressId.set(member.id);

    try {
      const tempPassword = await this.userResetService.resetMemberPassword(member.id);

      this.tempPasswords.update(current => ({
        ...current,
        [member.id]: tempPassword,
      }));

      this.toastService.success('Temporary password generated successfully.');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      this.toastService.error(
        error?.message || 'Failed to reset password.'
      );
    } finally {
      this.resetInProgressId.set(null);
    }
  }

  getTempPassword(memberId: string): string | null {
    return this.tempPasswords()[memberId] ?? null;
  }

  hasTempPassword(memberId: string): boolean {
    return !!this.tempPasswords()[memberId];
  }

  async copyTempPassword(memberId: string) {
    const tempPassword = this.getTempPassword(memberId);

    if (!tempPassword) {
      this.toastService.error('No temporary password available to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(tempPassword);
      this.toastService.success('Temporary password copied.');
    } catch {
      this.toastService.error('Could not copy password to clipboard.');
    }
  }

  sendWhatsApp(member: ProfileShortInfoDto) {
    const tempPassword = this.getTempPassword(member.id);

    if (!tempPassword) {
      this.toastService.error('Generate a temporary password first.');
      return;
    }

    if (!member.phone) {
      this.toastService.error('No phone number found for this user.');
      return;
    }

    const message = this.userResetService.buildResetMessage(member, tempPassword);
    const opened = this.userResetService.openWhatsApp(member.phone, message);

    if (!opened) {
      this.toastService.error('Could not open WhatsApp.');
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
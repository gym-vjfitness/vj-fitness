import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { UserDeadlineService } from '../../../services/user-deadline-service';

@Component({
  selector: 'app-user-deadline-dialog',
  standalone: true,
  templateUrl: './user-deadline-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './user-deadline-dialog.scss',
})
export class UserDeadlineDialog {
  deadlineService = inject(UserDeadlineService);
  private router = inject(Router);

  activeIndex = 0;

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const scrollLeft = element.scrollLeft;
    const cardWidth = element.offsetWidth;
    this.activeIndex = Math.round(scrollLeft / cardWidth);
  }

  close() {
    this.deadlineService.closeDialog();
  }

  // Changed to async to handle the API call
  async goToPayment(card: any) {
    const isLockedOut = this.deadlineService.isLockedOut();

    // 1. LOCKOUT SCENARIO: Access Revoked (0 days left / un-closable dialog)
    if (isLockedOut) {
      console.log('User is locked out. Deactivating profile...');
      
      // Make the API call to mark is_active as false
      const success = await this.deadlineService.deactivateUserProfile();
      
      if (success) {
        console.log('Profile successfully deactivated.');
      } else {
        console.error('Failed to deactivate profile, proceeding to payment anyway.');
      }

      // Close dialog and route to plans upon success (or fallback if error occurs so they aren't stuck)
      this.deadlineService.showDialog.set(false);
      this.router.navigate(['/member/plans']);
      
      return; // Exit here so it doesn't run the normal routing logic below
    }

    // 2. NORMAL WARNING SCENARIO: 
    // MUST CLOSE DIALOG: We have to close the dialog when routing
    this.deadlineService.showDialog.set(false);

    // ROUTING LOGIC:
    if (card?.type === 'expiry') {
      console.log('Navigating to plans (Expired)');
      this.router.navigate(['/member/plans']);
    } 
    else if (card?.type === 'due') {
      console.log('Navigating to billing installment (Pending Installment)');
      this.router.navigate(['/member/billing-installment']);
    } 
    else {
      this.router.navigate(['/member/plans']);
    }
  }
}
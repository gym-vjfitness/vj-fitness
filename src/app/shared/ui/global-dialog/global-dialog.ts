import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../../services/dialog-service';

@Component({
  selector: 'app-global-dialog',
  imports: [CommonModule],
  templateUrl: './global-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './global-dialog.scss',
})
export class GlobalDialog {
  dialogService = inject(DialogService);
  
  // Controls the exit animation class
  isClosing = signal<boolean>(false);

  handleAction(result: boolean) {
    // 1. Trigger the closing animation
    this.isClosing.set(true);
    
    // 2. Wait for the animation to finish (200ms matches our SCSS)
    setTimeout(() => {
      this.dialogService.close(result);
      this.dialogService.isOpen.set(false);
      this.isClosing.set(false);
    }, 200);
  }
}
import { Injectable, signal } from '@angular/core';

// ✅ Added 'warning' to the type
export type DialogMode = 'normal' | 'delete' | 'warning';

export interface DialogConfig {
  title: string;
  message: string;
  mode?: DialogMode;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  // Signals to hold dialog state
  isOpen = signal<boolean>(false);
  config = signal<DialogConfig | null>(null);
  
  // Store the promise resolve function
  private resolveFn: ((value: boolean) => void) | null = null;

  /**
   * Opens the dialog and returns a Promise that resolves to true (confirm) or false (cancel)
   */
  open(config: DialogConfig): Promise<boolean> {
    this.config.set({
      mode: 'normal',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      ...config
    });
    
    this.isOpen.set(true);
    
    return new Promise<boolean>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  /**
   * Called by the dialog component when an action is taken
   */
  close(result: boolean) {
    if (this.resolveFn) {
      this.resolveFn(result);
      this.resolveFn = null;
    }
    // Note: isOpen is set to false inside the component AFTER the exit animation finishes
  }
}
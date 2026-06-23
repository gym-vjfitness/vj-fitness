import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'danger';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'info', duration: number = 3500) {
    // FIX: Using Date & Math for a universally safe unique ID on HTTP network testing
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Add to the START of the array so it appears at the very top
    this.toasts.update((current) => [{ id, message, type }, ...current]);

    // Auto-remove
    setTimeout(() => {
      this.remove(id);
    }, duration);
  }

  remove(id: string) {
    this.toasts.update((current) => current.filter(t => t.id !== id));
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error'); }
  danger(message: string) { this.show(message, 'danger'); }
  warning(message: string) { this.show(message, 'warning'); }
  info(message: string) { this.show(message, 'info'); }
}
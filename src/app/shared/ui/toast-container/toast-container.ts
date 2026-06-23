import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ToastService, ToastType } from '../../../services/toast-service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-toast-container',
  imports: [NgClass],
  templateUrl: './toast-container.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
toastService = inject(ToastService);

  getIconColor(type: ToastType): string {
    switch (type) {
      case 'success': return 'text-success';
      case 'error': return 'text-danger';
      case 'danger': return 'text-danger';
      case 'warning': return 'text-warning';
      case 'info': default: return 'text-info';
    }
  }
}

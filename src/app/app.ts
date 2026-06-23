import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from "./shared/ui/toast-container/toast-container";
import { GlobalDialog } from "./shared/ui/global-dialog/global-dialog";
import { UserSettingService } from './services/user-setting-service';

import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, GlobalDialog],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('VJ-FITNESS');
  private themeSync = inject(UserSettingService);

  private readonly swUpdate = inject(SwUpdate);

  constructor() {
    // Keep your existing code inside the constructor
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          takeUntilDestroyed()
        )
        .subscribe(() => {
          window.location.reload();
        });
    }
  }
}

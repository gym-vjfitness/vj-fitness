import { Component, signal, computed, OnDestroy, AfterViewInit, ViewChild, ElementRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import QRCodeStyling from 'qr-code-styling';
import * as CryptoJS from 'crypto-js';

@Component({
  selector: 'app-admin-qr-desk',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-qr-desk.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-qr-desk.scss',
})
export class AdminQrDesk implements AfterViewInit, OnDestroy {
  @ViewChild('qrContainer', { static: false }) qrContainer!: ElementRef;
  @ViewChild('fullscreenArea', { static: false }) fullscreenArea!: ElementRef;

  gymId = 'GYM_12345';
  private readonly SECRET_KEY = 'YOUR_SUPER_SECRET_GYM_KEY';

  private readonly MAX_TIME = 30;
  refreshCountdown = signal<number>(this.MAX_TIME);
  isUpdating = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);

  isDangerTime = computed(() => this.refreshCountdown() <= 10);

  private qrCodeInstance!: QRCodeStyling;
  private timerInterval: any;

  ngAfterViewInit() {
    this.initializeQr();
    this.startRefreshTimer();
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  onFullscreenChange() {
    this.isFullscreen.set(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
  }

  toggleFullScreen() {
    const elem = this.fullscreenArea.nativeElement;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err: any) => console.error(`Fullscreen failed: ${err.message}`));
      } else if (elem.webkitRequestFullscreen) {
        (elem.webkitRequestFullscreen as any)();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        ((document as any).webkitExitFullscreen as any)();
      }
    }
  }

  private getCssVar(varName: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  private initializeQr() {
    this.qrCodeInstance = new QRCodeStyling({
      width: 1000, 
      height: 1000, 
      type: "svg",
      margin: 0,
      data: this.getPayload(),
      image: "/assets/gym_logo.png",
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "Q" 
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
        imageSize: 0.12
      },
      dotsOptions: {
        color: '#111827',
        type: "square"
      },
      cornersSquareOptions: {
        color: '#111827',
        type: "square"
      },
      cornersDotOptions: {
        color: '#111827',
        type: "square"
      },
      backgroundOptions: {
        color: "#ffffff"
      }
    });

    this.qrCodeInstance.append(this.qrContainer.nativeElement);
  }

  private getPayload(): string {
    const rawData = JSON.stringify({ gymId: this.gymId, timestamp: Date.now() });
    return CryptoJS.AES.encrypt(rawData, this.SECRET_KEY).toString();
  }

  private startRefreshTimer() {
    this.timerInterval = setInterval(() => {
      const current = this.refreshCountdown();

      if (current <= 1) {
        this.isUpdating.set(true); 

        setTimeout(() => {
          this.qrCodeInstance.update({
            data: this.getPayload(),
            dotsOptions: { color: '#111827' },
            cornersSquareOptions: { color: '#111827' },
            cornersDotOptions: { color: '#111827' }
          });

          this.refreshCountdown.set(this.MAX_TIME);
          setTimeout(() => this.isUpdating.set(false), 150); 
        }, 300);

      } else {
        this.refreshCountdown.set(current - 1);
      }
    }, 1000);
  }
}
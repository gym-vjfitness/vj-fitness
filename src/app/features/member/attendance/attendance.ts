import { Component, signal, computed, inject, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../services/supabase-service';
import { CreateAttendanceDto } from '../../../models/attendance.dto';
import { AttendanceTrackingService } from '../../../services/attendance-tracking-service';
import { StorageService } from '../../../services/storage-service';
import { RouterLink } from "@angular/router";
import { LocationVerificationService } from '../../../services/location-verification-service';
import { ToastService } from '../../../services/toast-service';
import * as CryptoJS from 'crypto-js';
import { SettingService } from '../../../services/setting-service';
import QrScanner from 'qr-scanner';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './attendance.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './attendance.scss',
})
export class Attendance implements OnInit, OnDestroy {
  // CHANGED: static: true ensures the video tag is ALWAYS ready for the scanner
  @ViewChild('videoElement', { static: true }) videoElement!: ElementRef<HTMLVideoElement>;

  supabaseService = inject(SupabaseService);
  attendanceTrackingService = inject(AttendanceTrackingService);
  locationService = inject(LocationVerificationService);
  toastService = inject(ToastService);
  storageService = inject(StorageService);
  settingService = inject(SettingService);

  private readonly SECRET_KEY = environment.SECRET_KEY;

  isLoading = signal<boolean>(false);
  loadingMessage = signal<string>('');
  showLocationTroubleshoot = signal<boolean>(false);
  showCheckoutToast = signal<boolean>(false);

  // Premium Coin State
  coinBalance = signal<number>(0);
  displayCoinBalance = signal<number | string>(0);
  isCoinRefreshing = signal<boolean>(false);
  coinRefreshCooldown = signal<number>(0);

  showFlyingCoins = signal<boolean>(false);
  coinArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  walletBump = signal<boolean>(false);

  isCoinRefreshDisabled = computed(() => this.coinRefreshCooldown() > 0 || this.isCoinRefreshing() || this.showFlyingCoins());
  private coinInterval: any;
  private scrambleInterval: any;

  gymId = environment.gymId;
  
  gymLatitude = signal<number | null>(null);
  gymLongitude = signal<number | null>(null);

  isGymLocationValid = computed(() => {
    const lat = this.gymLatitude();
    const lng = this.gymLongitude();
    return lat != null && lng != null && lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
  });

  currentAttendanceId = signal<string | null>(null);
  isCheckedIn = computed(() => !!this.currentAttendanceId());

  cooldownRemaining = signal<number>(0);
  isCooldown = computed(() => this.cooldownRemaining() > 0);
  formattedCooldown = computed(() => {
    const total = this.cooldownRemaining();
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  });
  private cooldownInterval: any;

  holdProgress = signal<number>(0);
  isHolding = signal<boolean>(false);
  private holdInterval: any;

  isScannerOpen = signal<boolean>(false);
  isCameraLoading = signal<boolean>(false);
  
  private qrScanner: any = null;
  private isProcessingScan = false;

  ngOnInit() {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.currentAttendanceId.set(localStorage.getItem('currentAttendanceId'));

      const cachedBalance = localStorage.getItem('cachedCoinBalance');
      if (cachedBalance) {
        const val = parseInt(cachedBalance, 10);
        this.coinBalance.set(val);
        this.displayCoinBalance.set(val);
      }

      this.checkActiveLocks();
      this.checkCoinRefreshLock();
      this.syncActiveSession();
      this.getGymLocation();
    }
  }

  private async getGymLocation() {
    try {
      const gymLocation = await this.settingService.getLocation();
      if (gymLocation && gymLocation.length >= 2) {
        this.gymLatitude.set(gymLocation[0] || null);
        this.gymLongitude.set(gymLocation[1] || null);
      } else {
        this.gymLatitude.set(null);
        this.gymLongitude.set(null);
      }
    } catch (e) {
      console.error("Failed to load gym location", e);
      this.gymLatitude.set(null);
      this.gymLongitude.set(null);
    }
  }

  private async syncActiveSession() {
    try {
      const user = this.supabaseService.currentUser();
      if (!user?.id) return;

      const activeSessionId = await this.attendanceTrackingService.getActiveSession(user.id);

      if (activeSessionId) {
        this.currentAttendanceId.set(activeSessionId);
        localStorage.setItem('currentAttendanceId', activeSessionId);
      } else if (this.currentAttendanceId()) {
        this.currentAttendanceId.set(null);
        localStorage.removeItem('currentAttendanceId');
      }
    } catch (e) {
      console.error("Failed to sync session state", e);
    }
  }

  ngOnDestroy() {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    if (this.holdInterval) clearInterval(this.holdInterval);
    if (this.coinInterval) clearInterval(this.coinInterval);
    if (this.scrambleInterval) clearInterval(this.scrambleInterval);
    this.closeScanner();
  }

  private async updateLocalAttendanceCache(recordPayload: any) {
    const user = this.supabaseService.currentUser();
    if (!user?.id) return;

    const cacheKey = `attendance_30d_${user.id}`;
    let localData: any[] = await this.storageService.getItem(cacheKey) || [];

    const now = new Date();
    const dateInIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    dateInIST.setDate(dateInIST.getDate() - 30);
    const pad = (n: number) => String(n).padStart(2, '0');
    const limitDateStr = `${dateInIST.getFullYear()}-${pad(dateInIST.getMonth() + 1)}-${pad(dateInIST.getDate())}`;

    const existingIndex = localData.findIndex(r => r.id === recordPayload.id);

    if (existingIndex > -1) {
      localData[existingIndex] = { ...localData[existingIndex], ...recordPayload };
    } else {
      localData.push(recordPayload);
    }

    localData = localData.filter(r => r.attendance_date >= limitDateStr);
    localData.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());

    await this.storageService.setItem(cacheKey, localData);
  }

  private runCasinoScramble(targetValue: number) {
    if (this.scrambleInterval) clearInterval(this.scrambleInterval);

    let iterations = 0;
    const maxIterations = 50;

    this.scrambleInterval = setInterval(() => {
      const randomGarbage = Math.floor(Math.random() * 99).toString().padStart(2, '0');
      this.displayCoinBalance.set(randomGarbage);

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(this.scrambleInterval);
        this.displayCoinBalance.set(targetValue);

        this.walletBump.set(true);
        if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => this.walletBump.set(false), 200);
      }
    }, 50);
  }

  async refreshCoins(isManualClick: boolean = false) {
    if (isManualClick && this.coinRefreshCooldown() > 0) return;
    this.isCoinRefreshing.set(true);
    try {
      const user = this.supabaseService.currentUser();
      if (!user?.id) return;
      const freshBalance = await this.attendanceTrackingService.fetchCoinBalance(user.id);
      if (freshBalance !== this.coinBalance() || isManualClick) {
        this.runCasinoScramble(freshBalance);
      }
      this.coinBalance.set(freshBalance);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cachedCoinBalance', freshBalance.toString());
        if (isManualClick) {
          localStorage.setItem('lastCoinRefreshTime', Date.now().toString());
          this.startCoinRefreshTimer(10 * 60);
        }
      }
    } finally {
      this.isCoinRefreshing.set(false);
    }
  }

  private triggerFlyingCoinReward(newBalance: number) {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 50, 50, 100, 150]);
    }
    this.showFlyingCoins.set(true);
    setTimeout(() => {
      this.showFlyingCoins.set(false);
      this.walletBump.set(true);
      this.runCasinoScramble(newBalance);
      this.coinBalance.set(newBalance);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cachedCoinBalance', newBalance.toString());
      }
      setTimeout(() => this.walletBump.set(false), 200);
    }, 2600);
  }

  private checkCoinRefreshLock() {
    const lastRefresh = localStorage.getItem('lastCoinRefreshTime');
    if (lastRefresh) {
      const elapsed = Date.now() - parseInt(lastRefresh, 10);
      const lockMs = 10 * 60 * 1000;
      if (elapsed < lockMs) {
        this.startCoinRefreshTimer(Math.ceil((lockMs - elapsed) / 1000));
      }
    }
  }

  private startCoinRefreshTimer(seconds: number) {
    this.coinRefreshCooldown.set(seconds);
    if (this.coinInterval) clearInterval(this.coinInterval);
    this.coinInterval = setInterval(() => {
      const current = this.coinRefreshCooldown();
      if (current <= 1) {
        this.coinRefreshCooldown.set(0);
        clearInterval(this.coinInterval);
      } else {
        this.coinRefreshCooldown.set(current - 1);
      }
    }, 1000);
  }

  closeLocationTroubleshoot() {
    this.showLocationTroubleshoot.set(false);
  }

  private checkActiveLocks() {
    const now = Date.now();
    const isCheckedIn = this.isCheckedIn();
    const lockKey = isCheckedIn ? 'lastCheckInTime' : 'lastCheckOutTime';
    // CHANGED: 20 minutes (in ms) if checked in, 8 hours (in ms) if checked out
    const lockMs = isCheckedIn ? (20 * 60 * 1000) : (8 * 60 * 60 * 1000);

    const lastStr = localStorage.getItem(lockKey);
    if (lastStr) {
      const elapsed = now - parseInt(lastStr, 10);
      if (elapsed < lockMs) {
        this.startCooldownTimer(Math.ceil((lockMs - elapsed) / 1000));
      } else {
        localStorage.removeItem(lockKey);
      }
    }
  }

  private triggerLock(type: 'checkIn' | 'checkOut') {
    const lockKey = type === 'checkIn' ? 'lastCheckInTime' : 'lastCheckOutTime';
    localStorage.setItem(lockKey, Date.now().toString());
    // CHANGED: 20 minutes (in seconds) for checkIn, 8 hours (in seconds) for checkOut
    const cooldownSeconds = type === 'checkIn' ? (20 * 60) : (8 * 60 * 60);
    this.startCooldownTimer(cooldownSeconds);
  }

  private startCooldownTimer(seconds: number) {
    this.cooldownRemaining.set(seconds);
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);

    this.cooldownInterval = setInterval(() => {
      const current = this.cooldownRemaining();
      if (current <= 1) {
        this.cooldownRemaining.set(0);
        clearInterval(this.cooldownInterval);
        localStorage.removeItem(this.isCheckedIn() ? 'lastCheckInTime' : 'lastCheckOutTime');
      } else {
        this.cooldownRemaining.set(current - 1);
      }
    }, 1000);
  }

  async toggleScanner() {
    if (!this.isGymLocationValid()) {
      this.toastService.error('Gym location is missing. Cannot use scanner.');
      return;
    }

    if (this.isScannerOpen()) {
      await this.closeScanner();
    } else {
      this.showLocationTroubleshoot.set(false);
      this.isScannerOpen.set(true);
      this.isCameraLoading.set(true);

      // No more setTimeout needed! The DOM is guaranteed ready because we use [class.hidden]
      try {
        if (!this.videoElement || !this.videoElement.nativeElement) {
          throw new Error("Video element not found in DOM");
        }

        this.qrScanner = new QrScanner(
          this.videoElement.nativeElement,
          (result) => this.handleQrScan(result.data),
          {
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: false,
            preferredCamera: 'environment', // Force back camera for mobile
            maxScansPerSecond: 25
          }
        );

        await this.qrScanner.start();
        this.isCameraLoading.set(false);
      } catch (err) {
        console.error("Camera error:", err);
        this.isCameraLoading.set(false);
        // Provide clear feedback if it's an HTTP/HTTPS security block
        if (String(err).includes('Camera not found') || String(err).includes('permission')) {
            this.toastService.error('Camera blocked. Make sure you are using HTTPS.');
        } else {
            this.toastService.error('Failed to access camera.');
        }
        this.closeScanner();
      }
    }
  }

  async closeScanner() {
    if (this.qrScanner) {
      try {
        this.qrScanner.stop();
        this.qrScanner.destroy();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      this.qrScanner = null;
    }
    this.isScannerOpen.set(false);
  }

  async handleQrScan(decodedText: string) {
    if (!this.isGymLocationValid() || this.isProcessingScan) return;
    if (!decodedText) return;

    this.isProcessingScan = true;

    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    await this.closeScanner();

    try {
      const bytes = CryptoJS.AES.decrypt(decodedText, this.SECRET_KEY);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedData) throw new Error('Decryption failed');

      const qrData = JSON.parse(decryptedData);

      if (qrData.gymId !== this.gymId) {
        this.toastService.error('Invalid QR Code for this gym.');
        this.isProcessingScan = false;
        return;
      }

      const qrAgeInSeconds = (Date.now() - qrData.timestamp) / 1000;

      if (qrAgeInSeconds > 30) {
        this.toastService.error('QR Code expired! Scan the screen again.');
        this.isProcessingScan = false;
        return;
      }

      this.isLoading.set(true);
      this.loadingMessage.set('QR verified. Processing...');

      if (this.isCheckedIn()) {
        await this.logOut();
      } else {
        await this.logIn();
      }
    } catch (e) {
      this.toastService.error('Unrecognized or invalid QR Code.');
    } finally {
      this.isProcessingScan = false;
    }
  }

  onHoldStart(event: Event) {
    if (!this.isGymLocationValid()) {
      this.toastService.error('Gym location is missing. Cannot mark attendance.');
      return;
    }
    if (this.isLoading() || this.isCooldown()) return;
    this.isHolding.set(true);
    this.holdProgress.set(0);

    this.holdInterval = setInterval(() => {
      this.holdProgress.update(p => {
        if (p >= 100) {
          this.onHoldComplete();
          return 100;
        }
        return p + 2;
      });
    }, 30);
  }

  onHoldEnd() {
    if (!this.isHolding()) return;
    clearInterval(this.holdInterval);
    this.isHolding.set(false);
    if (this.holdProgress() < 100) this.holdProgress.set(0);
  }

  private async onHoldComplete() {
    clearInterval(this.holdInterval);
    this.isHolding.set(false);

    this.isLoading.set(true);
    this.loadingMessage.set('Verifying location...');

    const locationResult = await this.locationService.verifyGymPresence(this.gymLatitude()!, this.gymLongitude()!, 60);

    if (!locationResult.success) {
      this.isLoading.set(false);
      this.holdProgress.set(0);
      if (locationResult.errorType === 'APPROXIMATE' || locationResult.errorType === 'DENIED') {
        this.showLocationTroubleshoot.set(true);
      } else {
        this.toastService.error(locationResult.message || 'Location error');
      }
      return;
    }

    this.loadingMessage.set('Processing attendance...');
    this.isCheckedIn() ? await this.logOut() : await this.logIn();
    setTimeout(() => this.holdProgress.set(0), 1000);
  }

  async logIn() {
    try {
      const user = this.supabaseService.currentUser();
      const dt = this.attendanceCatching();

      const payload: CreateAttendanceDto = {
        profile_id: user?.id || '', attendance_date: dt.currentDate,
        check_in_time: dt.currentTimestamp, check_out_time: null,
        marked_by: user?.id, marked_by_role: user?.user_role,
      };

      const [newId] = await Promise.all([
        this.attendanceTrackingService.loginTime(payload),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      if (typeof window !== 'undefined') {
        localStorage.removeItem("lastCheckOutTime");
      }

      this.currentAttendanceId.set(newId as string);

      await this.updateLocalAttendanceCache({
        id: newId as string,
        attendance_date: dt.currentDate,
        check_in_time: dt.currentTimestamp.substring(0, 19),
        check_out_time: null
      });

      this.toastService.success('Attendance Marked');
      this.triggerLock('checkIn');

    } catch (error: any) {
      if (error.message && error.message.includes('session expired')) {
        this.toastService.error('You logged in another device');
        return;
      } else if (error.message && error.message.includes('COOLDOWN_ACTIVE')) {
        this.toastService.error('You must wait for 8 hrs before starting a new session.');
      } else if (error.message && error.message.includes('SESSION_ALREADY_ACTIVE')) {
        this.toastService.error('Syncing session from your other device...');
        const user = this.supabaseService.currentUser();
        if (user?.id) {
          const activeId = await this.attendanceTrackingService.getActiveSession(user.id);
          if (activeId) {
            this.currentAttendanceId.set(activeId);
            if (typeof window !== 'undefined') {
              localStorage.setItem('currentAttendanceId', activeId);
            }
            this.toastService.success('Session synced! You can now end your session.');
          }
        }
      } else {
        this.toastService.error('Attendance Not Marked');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async logOut() {
    try {
      const user = this.supabaseService.currentUser();
      const dt = this.attendanceCatching();
      const currentId = this.currentAttendanceId();

      if (!currentId) throw new Error("No active session found");

      const previousBalance = this.coinBalance();

      const payload: Partial<CreateAttendanceDto> = {
        check_out_time: dt.currentTimestamp,
      };

      await Promise.all([
        this.attendanceTrackingService.logoutTime(payload, currentId),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      if (typeof window !== 'undefined') {
        localStorage.removeItem("lastCheckInTime");
      }

      await this.updateLocalAttendanceCache({
        id: currentId,
        check_out_time: dt.currentTimestamp.substring(0, 19)
      });

      this.currentAttendanceId.set(null);
      this.triggerLock('checkOut');

      this.showCheckoutToast.set(true);
      setTimeout(() => this.showCheckoutToast.set(false), 4000);

      setTimeout(async () => {
        if (!user?.id) return;

        const freshBalance = await this.attendanceTrackingService.fetchCoinBalance(user.id);

        if (freshBalance > previousBalance) {
          this.triggerFlyingCoinReward(freshBalance);
        } else {
          this.coinBalance.set(freshBalance);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cachedCoinBalance', freshBalance.toString());
          }
        }
      }, 600);

    } catch (error: any) {
      if (error.message && error.message.includes('session expired')) {
        this.toastService.error('You logged in another device');
        return;
      } else if (error.message && error.message.includes('MINIMUM_TIME_NOT_MET')) {
        this.toastService.error('You must work out at least for 20 min to check out!');
      } else {
        this.toastService.error('Check-out failed');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  attendanceCatching() {
    const now = new Date();
    const dateInIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const pad = (n: number) => String(n).padStart(2, '0');
    const currentDate = `${dateInIST.getFullYear()}-${pad(dateInIST.getMonth() + 1)}-${pad(dateInIST.getDate())}`;
    const currentTime = `${pad(dateInIST.getHours())}:${pad(dateInIST.getMinutes())}:${pad(dateInIST.getSeconds())}`;
    return {
      currentDate,
      currentTime,
      currentTimestamp: `${currentDate}T${currentTime}+05:30`
    };
  }
}
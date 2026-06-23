import { Component, ElementRef, OnInit, ViewChild, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import QRCodeStyling from 'qr-code-styling';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SettingService } from '../../../../services/setting-service';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';

@Component({
  selector: 'app-manage-upi',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './manage-upi.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './manage-upi.scss',
})
export class ManageUpi implements OnInit {
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef;

  private fb = inject(FormBuilder);
  private settingService = inject(SettingService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);

  // State Signals
  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);

  upiForm: FormGroup;
  private qrCode!: QRCodeStyling;

  constructor() {
    this.upiForm = this.fb.group({
      upiId: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/)]],
      accountName: ['', [Validators.required, Validators.minLength(3)]]
    });

    // Listen to form changes and update QR code smoothly
    this.upiForm.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((values) => {
        this.updateQRPreview(values.upiId, values.accountName);
      });
  }

  async ngOnInit() {
    this.initQRCode();
    await this.loadSettings();
  }

  private initQRCode() {
    this.qrCode = new QRCodeStyling({
      width: 280, 
      height: 280,
      type: "svg",
      data: "upi://pay?pa=&pn=",
      margin: 0,
      image: "assets/gym_logo_transperant.png", 
      dotsOptions: {
        color: "var(--primary)",
        type: "dots"
      },
      cornersSquareOptions: {
        color: "var(--foreground)",
        type: "dot"
      },
      backgroundOptions: {
        color: "var(--background)"
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5, 
        imageSize: 0.4, 
      }
    });
  }

  private async loadSettings() {
    this.isLoading.set(true);
    
    // This will now resolve instantly if switching tabs, avoiding the API call
    const data = await this.settingService.getSettings();

    if (data) {
      this.upiForm.patchValue({
        upiId: data.admin_upi_id,
        accountName: data.bank_account_name
      }, { emitEvent: true }); 
    }

    this.isLoading.set(false);
    
    setTimeout(() => {
      if (this.qrCanvas) {
        this.qrCode.append(this.qrCanvas.nativeElement);
      }
    }, 10);
  }

  private updateQRPreview(upiId: string, accountName: string) {
    if (!this.qrCode) return;

    const safeUpi = encodeURIComponent(upiId || '');
    const safeName = encodeURIComponent(accountName || '');
    const upiString = `upi://pay?pa=${safeUpi}&pn=${safeName}&cu=INR`;

    this.qrCode.update({ data: upiString });
  }

  async saveSettings() {
    if (this.upiForm.invalid) {
      this.upiForm.markAllAsTouched();
      return;
    }

    const confirmed = await this.dialogService.open({
      title: `Update`,
      message: `This action will update sensitive financial information (UPI ID). Are you sure you want to proceed?`,
      mode: 'warning',
      confirmText: `Update`,
      cancelText: 'Cancel'
    });

    if (!confirmed) { return; }

    this.isSaving.set(true);
    const formValues = this.upiForm.value;

    try {
      await this.settingService.upsertSettings({
        admin_upi_id: formValues.upiId,
        bank_account_name: formValues.accountName,
        updated_at: new Date().toISOString()
      });
      this.toastService.success("Payment Details Updated successfully!");
    } catch (error) {
      this.toastService.error('Failed to save settings. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
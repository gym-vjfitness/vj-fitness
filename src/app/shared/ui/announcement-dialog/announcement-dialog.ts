import { Component, inject, signal, effect, untracked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberAnnouncementService } from '../../../services/member-announcement-service';
import { Announcement } from '../../../models/notification.model';

interface ThemeConfig {
  type: string;
  badgeText: string;
  badgeIcon: string;
  glowClass: string;
  topGlowClass: string; 
  titleClass: string;
  boxClass: string;
  btnClass: string;     
  boxIconClass: string;
  svgIcon: string; 
}

@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './announcement-dialog.scss' 
})
export class AnnouncementDialog {
  public announcementService = inject(MemberAnnouncementService);

  isVisible = this.announcementService.isDialogVisible;
  localQueue = signal<Announcement[]>([]);
  currentIndex = signal<number>(0); 

  // Physics & Anti-Flicker State
  startX = 0;
  currentX = 0;
  dragDeltaX = signal<number>(0);
  isDragging = signal<boolean>(false);
  
  flyOutIndex = signal<number>(-1);
  flyOutDirection = signal<'left' | 'right' | 'up'>('left');
  isAnimating = signal<boolean>(false);
  isReadyToAnimate = signal<boolean>(false);

  constructor() {
    // MODERN ANGULAR BEST PRACTICE: 
    // We listen to the signals, but use untracked() to update local state 
    // to prevent "Writing to signals in effect" compiler warnings.
    effect(() => {
      const visible = this.isVisible();
      const ads = this.announcementService.activeAnnouncements();

      untracked(() => {
        if (visible) {
          if (ads.length > 0 && this.localQueue().length === 0) {
            
            // --- STRICT SORTING ENGINE ---
            // Guarantees Notices and Holidays always come first
            const sortedAds = [...ads].sort((a, b) => {
              // 1. Identify if item is a Notice/Holiday
              const catA = a.category?.toLowerCase() || '';
              const catB = b.category?.toLowerCase() || '';
              
              const aIsNotice = a.type === 'holiday' || catA === 'notice' || catA === 'standard';
              const bIsNotice = b.type === 'holiday' || catB === 'notice' || catB === 'standard';

              // Rule 1: Notices bypass Advertisements
              if (aIsNotice && !bIsNotice) return -1;
              if (!aIsNotice && bIsNotice) return 1;

              // Rule 2: High priority bypasses Low priority
              const aIsHigh = a.priority === 'high';
              const bIsHigh = b.priority === 'high';

              if (aIsHigh && !bIsHigh) return -1;
              if (!aIsHigh && bIsHigh) return 1;

              return 0; // Keep original order if tied
            });

            this.localQueue.set(sortedAds);
            this.currentIndex.set(0);
            setTimeout(() => this.isReadyToAnimate.set(true), 50);
          }
        } else {
          this.localQueue.set([]);
          this.isReadyToAnimate.set(false);
        }
      });
    });
  }

  getTheme(ad: Announcement): ThemeConfig {
    const cat = ad.category?.toLowerCase() || '';
    
    // 🎫 1. COUPON (Warning / Gold) 
    if (cat === 'coupon') return {
      type: 'coupon',
      badgeText: 'Coupon Code',
      badgeIcon: 'M15 5v2m0 4v2m0 4v2M5 8a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2a2 2 0 000-4V8z',
      glowClass: 'bg-warning',
      topGlowClass: 'shadow-[0_0_40px] shadow-warning/30', 
      titleClass: 'text-warning',
      boxClass: 'border-warning/30 bg-warning/5',
      btnClass: 'border-2 border-warning text-warning hover:bg-warning hover:text-warning-fg',
      boxIconClass: 'text-warning bg-surface border-warning/30',
      svgIcon: 'coupon'
    };

    // 🎁 2. OFFER (Accent / Purple) 
    if (cat === 'offer') return {
      type: 'offer',
      badgeText: 'Exclusive Offer',
      badgeIcon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
      glowClass: 'bg-accent',
      topGlowClass: 'shadow-[0_0_40px] shadow-accent/30',
      titleClass: 'text-accent',
      boxClass: 'border-accent/30 bg-accent/5',
      btnClass: 'border-2 border-accent text-accent hover:bg-accent hover:text-accent-fg',
      boxIconClass: 'text-accent bg-surface border-accent/30',
      svgIcon: 'offer'
    };

    // 🚨 3. URGENT (Danger / Red) 
    if (ad.priority === 'high') return {
      type: 'urgent',
      badgeText: 'Urgent Notice',
      badgeIcon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      glowClass: 'bg-danger',
      topGlowClass: 'shadow-[0_0_40px] shadow-danger/30',
      titleClass: 'text-danger', 
      boxClass: 'border-danger/30 bg-danger/5',
      btnClass: 'border-2 border-danger text-danger hover:bg-danger hover:text-danger-fg',
      boxIconClass: 'text-danger bg-surface border-danger/30',
      svgIcon: 'urgent'
    };
    
    // 🔵 4. STANDARD (Primary / Blue) 
    const isHoliday = ad.type === 'holiday';
    return {
      type: 'standard',
      badgeText: isHoliday ? 'Holiday Notice' : 'Announcement',
      badgeIcon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      glowClass: 'bg-primary',
      topGlowClass: 'shadow-[0_0_40px] shadow-primary/30',
      titleClass: 'text-primary',
      boxClass: 'border-primary/30 bg-primary/5',
      btnClass: 'border-2 border-primary text-primary hover:bg-primary hover:text-primary-fg',
      boxIconClass: 'text-primary bg-surface border-primary/30',
      svgIcon: 'standard'
    }; 
  }

  onDragStart(event: TouchEvent | MouseEvent, index: number) {
    if (this.isAnimating() || this.getVisualIndex(index) !== 0 || this.localQueue().length === 1) return;
    this.isDragging.set(true);
    this.startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  }

  onDragMove(event: TouchEvent | MouseEvent, index: number) {
    if (!this.isDragging() || this.getVisualIndex(index) !== 0) return;
    this.currentX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    this.dragDeltaX.set(this.currentX - this.startX);
  }

  onDragEnd(index: number) {
    if (!this.isDragging() || this.getVisualIndex(index) !== 0) return;
    this.isDragging.set(false);
    const delta = this.dragDeltaX();
    
    if (Math.abs(delta) > 80) {
      this.executeFlyout(index, delta > 0 ? 'right' : 'left', false);
    } else {
      this.dragDeltaX.set(0);
    }
  }

  acknowledgeCard(index: number) {
    if (this.isAnimating()) return;
    const card = this.localQueue()[index];
    this.announcementService.acknowledgeAnnouncement(card.id!);
    this.executeFlyout(index, 'right', true);
  }

  private executeFlyout(index: number, direction: 'left' | 'right' | 'up', remove: boolean) {
    this.isAnimating.set(true);
    this.flyOutIndex.set(index);
    this.flyOutDirection.set(direction);

    setTimeout(() => {
      if (remove) {
        const newQueue = [...this.localQueue()];
        newQueue.splice(index, 1);
        this.localQueue.set(newQueue);
        if (newQueue.length === 0) this.closeDialog();
      } else {
        this.currentIndex.update(i => (i + 1) % this.localQueue().length);
      }
      
      this.dragDeltaX.set(0);
      this.flyOutIndex.set(-1);
      this.isAnimating.set(false);
    }, 400);
  }

  closeDialog() {
    this.isAnimating.set(false);
    this.isReadyToAnimate.set(false);
    this.announcementService.closeMasterDialog();
  }

  getVisualIndex(actualIndex: number): number {
    const len = this.localQueue().length;
    if (len === 0) return 0;
    return (actualIndex - this.currentIndex() + len) % len;
  }

  getCardStyle(actualIndex: number) {
    const baseStyle: any = {
      '-webkit-mask-image': '-webkit-radial-gradient(white, black)',
      'backface-visibility': 'hidden'
    };

    if (!this.isReadyToAnimate()) {
      return { ...baseStyle, transform: 'translate3d(0, 100px, -100px) scale(0.85)', zIndex: 0, opacity: 0 };
    }

    if (this.flyOutIndex() === actualIndex) {
      const dir = this.flyOutDirection();
      let transform = '';
      if (dir === 'left') transform = 'translate3d(-150%, 5%, 0) rotateZ(-12deg) rotateY(-20deg)';
      if (dir === 'right') transform = 'translate3d(150%, 5%, 0) rotateZ(12deg) rotateY(20deg)';
      
      return {
        ...baseStyle,
        transform,
        zIndex: 60,
        opacity: 0,
        transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out'
      };
    }

    const diff = this.getVisualIndex(actualIndex);
    const isTop = diff === 0;

    if (isTop) {
      const dx = this.dragDeltaX();
      const rotateZ = dx * 0.03;
      const rotateY = dx * 0.08; 
      
      return {
        ...baseStyle, 
        transform: `translate3d(${dx}px, 0, 0) rotateZ(${rotateZ}deg) rotateY(${rotateY}deg)`, 
        zIndex: 50, 
        opacity: 1,
        transition: this.isDragging() ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        cursor: this.localQueue().length > 1 ? (this.isDragging() ? 'grabbing' : 'grab') : 'default'
      };
    }

    if (diff > 2) return { ...baseStyle, transform: 'translate3d(0, 40px, -100px) scale(0.9)', zIndex: 0, opacity: 0 };

    const tilts = [0, 4, -2]; 
    const rotation = tilts[diff] || 0;
    const scale = 1 - (diff * 0.04); 
    const translateY = diff * 20; 

    return {
      ...baseStyle, 
      opacity: 1, 
      transform: `translate3d(0, ${translateY}px, 0) scale(${scale}) rotateZ(${rotation}deg)`,
      zIndex: 50 - diff, 
      transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)', 
      pointerEvents: 'none' 
    };
  }
}
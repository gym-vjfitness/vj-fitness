import { Component, input, output, OnInit, OnDestroy, signal, ElementRef, ViewChild, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './video-player.scss',
})
export class VideoPlayer implements OnInit, OnDestroy {
  videoUrl = input.required<string>();
  gymName = input<string>('ELITE GYM');
  closeModal = output<void>();

  @ViewChild('playerContainer', { static: true }) playerContainer!: ElementRef;

  private player: any;
  private progressInterval: any;

  // UI State Signals
  isLoading = signal(true);
  isPlaying = signal(false);
  isMuted = signal(false);
  progress = signal(0);
  duration = signal(0);
  isDragging = signal(false);

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.initYouTubeAPI();
  }

  ngOnDestroy() {
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
    }
    clearInterval(this.progressInterval);
  }

  // --- Haptic Feedback for Mobile ---
  triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate(40); // Crisp 40ms vibration
    }
  }

  private initYouTubeAPI() {
    const url = this.videoUrl();
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      this.isLoading.set(false);
      return;
    }

    const win = window as any;
    if (!win['YT']) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      win['onYouTubeIframeAPIReady'] = () => this.createPlayer(videoId);
    } else {
      this.createPlayer(videoId);
    }
  }

  private createPlayer(videoId: string) {
    const win = window as any;
    this.player = new win.YT.Player(this.playerContainer.nativeElement, {
      videoId: videoId,
      playerVars: { 
        controls: 0,          
        disablekb: 1,         
        modestbranding: 1,    
        rel: 0,               
        showinfo: 0,          
        playsinline: 1,       
        autoplay: 1,
        fs: 0,                
        iv_load_policy: 3,    
        vq: 'hd1080'          
      },
      events: {
        onReady: (event: any) => {
          this.ngZone.run(() => {
            this.isLoading.set(false);
            this.duration.set(event.target.getDuration());
            this.player.playVideo(); 
          });
        },
        onStateChange: (event: any) => {
          this.ngZone.run(() => {
            const YT = win.YT;
            const state = event.data;
            
            // FIX: Ignore BUFFERING completely to stop the flicker
            if (state === YT.PlayerState.PLAYING) {
              this.isPlaying.set(true);
              this.duration.set(this.player.getDuration());
              this.startProgressBar();
            } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
              this.isPlaying.set(false);
            }
          });
        }
      }
    });
  }

  // --- Flawless Center Play/Pause ---
  togglePlay(event?: Event) {
    if (event) {
      event.preventDefault(); // Stop double-firing on touch screens
      event.stopPropagation();
    }
    
    this.triggerHaptic();

    if (!this.player || typeof this.player.getPlayerState !== 'function') return;
    
    // FIX: Optimistic UI Update. Instantly change the UI, *then* tell YouTube.
    if (this.isPlaying()) {
      this.isPlaying.set(false); 
      this.player.pauseVideo();
    } else {
      this.isPlaying.set(true); 
      this.player.playVideo();
    }
  }

  toggleMute(event: Event) {
    event.stopPropagation();
    this.triggerHaptic();
    if (!this.player) return;
    
    if (this.isMuted()) {
      this.player.unMute();
      this.isMuted.set(false);
    } else {
      this.player.mute();
      this.isMuted.set(true);
    }
  }

  onClose() {
    this.triggerHaptic();
    this.closeModal.emit();
  }

  // --- Smooth Dragging ---
  onDragStart(event: Event) {
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDrag(event: Event) {
    event.stopPropagation();
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.progress.set(val);
  }

  onDragEnd(event: Event) {
    event.stopPropagation();
    this.isDragging.set(false);
    const val = parseFloat((event.target as HTMLInputElement).value);
    
    if (this.player && typeof this.player.seekTo === 'function') {
      this.player.seekTo(val, true);
    }
  }

  startProgressBar() {
    this.ngZone.runOutsideAngular(() => {
      clearInterval(this.progressInterval);
      this.progressInterval = setInterval(() => {
        if (this.player && this.isPlaying() && !this.isDragging()) {
          const currentTime = this.player.getCurrentTime();
          this.ngZone.run(() => {
            this.progress.set(currentTime);
          });
        }
      }, 100); 
    });
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  get progressPercentage(): string {
    if (!this.duration()) return '0%';
    return `${(this.progress() / this.duration()) * 100}%`;
  }
}
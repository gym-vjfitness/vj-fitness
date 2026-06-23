import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingService } from '../../../../services/setting-service';
import * as L from 'leaflet';
import { ToastService } from '../../../../services/toast-service';
import { DialogService } from '../../../../services/dialog-service';

@Component({
  selector: 'app-manage-location',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manage-location.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './manage-location.scss',
})
export class ManageLocation implements OnInit {
  private settingService = inject(SettingService);
  private toastService = inject(ToastService);
  private dialogService = inject(DialogService);

  private map: L.Map | undefined;
  private marker: L.Marker | undefined;

  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);
  isLocating = signal<boolean>(false);
  
  initialLocation = signal<[number, number] | null>(null);
  currentLocation = signal<[number, number] | null>(null);

  isNew = computed(() => this.initialLocation() === null);
  
  hasChanged = computed(() => {
    const initial = this.initialLocation();
    const current = this.currentLocation();
    
    if (!current) return false;
    if (!initial) return true;
    
    return initial[0] !== current[0] || initial[1] !== current[1];
  });

  async ngOnInit() {
    await this.loadLocationData();
    this.initMap();
  }

  async loadLocationData() {
    this.isLoading.set(true);
    const loc = await this.settingService.getLocation();
    
    if (loc) {
      this.initialLocation.set([Number(loc[0]), Number(loc[1])]);
      this.currentLocation.set([Number(loc[0]), Number(loc[1])]);
    }
    this.isLoading.set(false);
  }

  private createPremiumIcon() {
    return L.divIcon({
      className: 'red-selector-pin',
      html: `<div class="pin-pulse"></div><div class="pin-core"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10] 
    });
  }

  private initMap() {
    const defaultCoords: L.LatLngExpression = [20.5937, 78.9629];
    const initialZoom = this.initialLocation() ? 17 : 5;
    const startCoords = this.initialLocation() || defaultCoords;

    this.map = L.map('gym-map', {
      center: startCoords,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
    }).addTo(this.map);

    const premiumIcon = this.createPremiumIcon();

    if (this.initialLocation()) {
      const [lat, lng] = this.initialLocation()!;
      this.marker = L.marker([lat, lng], { icon: premiumIcon }).addTo(this.map);
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.currentLocation.set([lat, lng]);

      if (this.marker) {
        this.marker.setLatLng([lat, lng]);
      } else {
        this.marker = L.marker([lat, lng], { icon: premiumIcon }).addTo(this.map!);
      }
      
      this.map!.flyTo([lat, lng], this.map!.getZoom(), { duration: 0.4 }); 
    });
  }

  async saveLocation() {
    if (!this.hasChanged()) return;

    const confirmed = await this.dialogService.open({
      title: `warning`,
      message: this.isNew() ? 'Are you sure this is your gym location ?' : `Are you sure you want to change your gym location?`,
      mode: 'warning',
      confirmText: this.isNew() ? 'Yes, Confirm' : `Yes, change`,
      cancelText: this.isNew() ? 'Cancel' : 'Keep current location'
    });

    if(!confirmed) return;

    this.isSaving.set(true);
    try {
      const currentLoc = this.currentLocation()!;
      const exactLat = Number(currentLoc[0].toFixed(5));
      const exactLng = Number(currentLoc[1].toFixed(5));
      
      const parsedLocation: [number, number] = [exactLat, exactLng];

      await this.settingService.updateLocation(parsedLocation);
      
      this.initialLocation.set(parsedLocation);
      this.currentLocation.set(parsedLocation);
      this.toastService.success('Location updated successfully !');
    } catch (error) {
      console.error('Failed to save location', error);
      this.toastService.error('Failed to save location');
    } finally {
      this.isSaving.set(false);
    }
  }

  useCurrentDeviceLocation() {
    if (!navigator.geolocation || this.isLocating()) return;
    
    this.isLocating.set(true);
    
    // Warn the admin to turn on Wi-Fi while grabbing the initial map coordinates
    this.toastService.info('Acquiring precise location. Please ensure Wi-Fi is ON for better accuracy...');

    let bestPosition: GeolocationPosition | null = null;
    const timeoutMs = 8000; // 8-second warm up to get a good read for the map pin

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
      },
      (error) => {
        console.warn('GPS Watch Error:', error);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      this.isLocating.set(false);

      if (bestPosition) {
        if (bestPosition.coords.accuracy > 150) {
            this.toastService.error('Location acquired, but accuracy is low. Pin might be slightly off.');
        } else {
            this.toastService.success('Exact location found.');
        }

        const { latitude, longitude } = bestPosition.coords;
        this.currentLocation.set([latitude, longitude]);
        
        if (this.map) {
          this.map.flyTo([latitude, longitude], 18, { duration: 0.8 });
          
          if (this.marker) {
            this.marker.setLatLng([latitude, longitude]);
          } else {
            this.marker = L.marker([latitude, longitude], { icon: this.createPremiumIcon() }).addTo(this.map);
          }
        }
      } else {
        alert('Could not determine your exact location. Please ensure location services are enabled and you have a clear signal.');
      }
    }, timeoutMs);
  }
}
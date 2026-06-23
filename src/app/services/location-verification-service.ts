import { Injectable } from '@angular/core';

export interface LocationResult {
  success: boolean;
  errorType?: 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'APPROXIMATE' | 'TOO_FAR' | 'UNKNOWN';
  distance?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationVerificationService {

  // Expanded default geofence to 150 meters to account for real-world GPS drift near concrete buildings
  async verifyGymPresence(gymLat: number, gymLng: number, maxDistanceMeters: number = 150): Promise<LocationResult> {
    try {
      // 12-second warm-up time, targeting at least 50m accuracy
      const position = await this.getBestLocation(12000, 50);
      
      // Relaxed rejection threshold from 150m to 250m to account for poor indoor signals
      if (position.coords.accuracy > 250) {
        return { 
          success: false, 
          errorType: 'APPROXIMATE', 
          message: 'Your location is too weak. Please turn ON your Wi-Fi or move near a window.' 
        };
      }

      const distance = this.calculateDistance(position.coords.latitude, position.coords.longitude, gymLat, gymLng);

      if (distance <= maxDistanceMeters) {
        return { success: true, distance };
      } else if (distance > 500) {
        return { 
          success: false, 
          errorType: 'TOO_FAR', 
          distance, 
          message: 'You are too far away. Please check in from the gym premises.' 
        };
      } else {
        return { 
          success: false, 
          errorType: 'TOO_FAR', 
          distance, 
          message: `You are approximately ${Math.round(distance)}m away. Please move closer to the facility.` 
        };
      }

    } catch (error: any) {
      return this.handleSystemError(error);
    }
  }

  // The "Warm-Up" Technique: Watches location for a set time and resolves the most accurate reading
  private getBestLocation(timeoutMs: number = 10000, desiredAccuracy: number = 50): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject({ code: 0, message: 'Geolocation not supported' });
      }

      let bestPosition: GeolocationPosition | null = null;
      let watchId: number;
      let timeoutId: any;

      const cleanup = () => {
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // If this is our first reading, or if it's more accurate than the last one, keep it
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }
          
          // If we hit a very highly accurate reading early, we don't need to wait the full 10 seconds
          if (bestPosition.coords.accuracy <= desiredAccuracy) {
            cleanup();
            resolve(bestPosition);
          }
        },
        (error) => {
          // If an error occurs but we already managed to grab a decent position earlier, use it
          if (bestPosition) {
            cleanup();
            resolve(bestPosition);
          } else {
            cleanup();
            reject(error);
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
      );

      // Force stop after the timeout and return the best location we managed to find
      timeoutId = setTimeout(() => {
        cleanup();
        if (bestPosition) {
          resolve(bestPosition);
        } else {
          reject({ code: 3, message: 'Location request timed out.' });
        }
      }, timeoutMs);
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const deltaP = (lat2 - lat1) * Math.PI / 180;
    const deltaLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
  }

  private handleSystemError(error: any): LocationResult {
    switch (error.code) {
      case 1: return { success: false, errorType: 'DENIED', message: 'Location access was denied.' };
      case 2: return { success: false, errorType: 'UNAVAILABLE', message: 'Location is currently unavailable. Ensure GPS is on.' };
      case 3: return { success: false, errorType: 'TIMEOUT', message: 'Location request timed out. Try again.' };
      default: return { success: false, errorType: 'UNKNOWN', message: 'An unknown location error occurred.' };
    }
  }
}
import { Injectable } from '@angular/core';
// Using default import fixes the "not a function" bundler error
import localforage from 'localforage'; 

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  
  constructor() {
    localforage.config({
      name: 'GymAppDB',
      storeName: 'gym_data'
    });
  }

  async setItem(key: string, value: any): Promise<any> {
    return await localforage.setItem(key, value);
  }

  async getItem<T>(key: string): Promise<T | null> {
    return await localforage.getItem<T>(key);
  }

  async removeItem(key: string): Promise<void> {
    return await localforage.removeItem(key);
  }

  async clearAll(): Promise<void> {
    try {
      await localforage.clear();
      console.log('Database cleared successfully');
    } catch (err) {
      console.error('Error clearing IndexedDB', err);
    }
  }
}
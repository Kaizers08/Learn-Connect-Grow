import { Injectable } from '@angular/core';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseConfigService {
  private config: SupabaseConfig = {
    url: 'https://wblacddvxokokjcwnnrm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibGFjZGR2eG9rb2tqY3dubnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Njg1NDksImV4cCI6MjA5OTA0NDU0OX0.ioCaod21s8aFferMw3abRnys58ssCYjwGcXBlxjx8XA'
  };

  getSupabaseConfig(): SupabaseConfig {
    return this.config;
  }

  setSupabaseConfig(url: string, anonKey: string): void {
    this.config.url = url;
    this.config.anonKey = anonKey;
  }
}
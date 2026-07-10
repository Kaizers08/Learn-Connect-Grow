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
    anonKey: 'sb_publishable_eFmng2CY8rTKDgVGbf580g_ygpT_cTF'
  };

  getSupabaseConfig(): SupabaseConfig {
    return this.config;
  }

  setSupabaseConfig(url: string, anonKey: string): void {
    this.config.url = url;
    this.config.anonKey = anonKey;
  }
}
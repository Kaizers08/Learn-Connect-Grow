import { Injectable, signal } from '@angular/core';
import { UserRole } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  role = signal<UserRole | null>(null);
  fullName = signal<string>('');
}

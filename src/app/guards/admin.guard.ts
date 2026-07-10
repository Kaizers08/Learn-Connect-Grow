import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const adminGuard = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const isAdmin = await supabase.isAdmin();
  return isAdmin ? true : router.createUrlTree(['/login']);
};

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Redirects already-authenticated users away from public pages
 * (login, register, home) straight to /dashboard.
 */
export const noAuthGuard = async () => {
  const supabase = inject(SupabaseService);
  const router   = inject(Router);

  await supabase.ensureAuthReady();

  const status = await supabase.getRegistrationStatus();

  // If there's any active session, send them somewhere meaningful
  if (status !== 'none') {
    switch (status) {
      case 'role-pending':
        return router.createUrlTree(['/complete-profile']);
      case 'profile-pending':
        return router.createUrlTree(['/mentor-profile']);
      case 'documents-pending':
        return router.createUrlTree(['/mentor-documents']);
      case 'pending-approval':
        return router.createUrlTree(['/pending-approval']);
      case 'complete':
      default:
        return router.createUrlTree(['/dashboard']);
    }
  }

  // Not logged in — allow access to the public page
  return true;
};

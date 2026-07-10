import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { UserService } from '../services/user.service';

/**
 * Prevents access to /dashboard if the user hasn't completed registration.
 * Also redirects back to the correct incomplete step if they refresh mid-flow.
 */
export const authGuard = async () => {
  const supabase = inject(SupabaseService);
  const userService = inject(UserService);
  const router = inject(Router);

  const status = await supabase.getRegistrationStatus();

  switch (status) {
    case 'none':
      return router.createUrlTree(['/login']);
    case 'role-pending':
      return router.createUrlTree(['/complete-profile']);
    case 'profile-pending':
      // We need to know the role to redirect correctly
      const meta = await supabase.getCurrentUserMeta();
      userService.role.set(meta.role as any);
      if (meta.role === 'mentor') return router.createUrlTree(['/mentor-profile']);
      return router.createUrlTree(['/mentee-profile']);
    case 'documents-pending':
      return router.createUrlTree(['/mentor-documents']);
    case 'pending-approval':
      return router.createUrlTree(['/pending-approval']);
    case 'complete':
      const completeMeta = await supabase.getCurrentUserMeta();
      userService.role.set(completeMeta.role as any);
      return true;
    default:
      return router.createUrlTree(['/login']);
  }
};

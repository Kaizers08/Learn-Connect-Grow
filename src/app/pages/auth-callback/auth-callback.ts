import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-auth-callback',
  imports: [CommonModule],
  templateUrl: './auth-callback.html',
  styleUrl: './auth-callback.css'
})
export class AuthCallbackComponent implements OnInit {
  errorMsg = '';

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    try {
      // Supabase v2 automatically exchanges the code/token from the URL hash/params.
      // We just need to wait for the session to be established, then check status.
      await this.waitForSession();

      const isAdmin = await this.supabase.isAdmin();
      if (isAdmin) {
        this.router.navigate(['/admin']);
        return;
      }

      const status = await this.supabase.getRegistrationStatus();

      switch (status) {
        case 'role-pending':
          // New Google user — needs to pick a role and fill out profile
          this.router.navigate(['/complete-profile']);
          break;
        case 'profile-pending': {
          const meta = await this.supabase.getCurrentUserMeta();
          this.userService.role.set(meta.role as any);
          if (meta.role === 'mentor') {
            this.router.navigate(['/mentor-profile']);
          } else {
            this.router.navigate(['/mentee-profile']);
          }
          break;
        }
        case 'documents-pending':
          this.router.navigate(['/mentor-documents']);
          break;
        case 'pending-approval':
          this.router.navigate(['/pending-approval']);
          break;
        case 'complete': {
          const meta = await this.supabase.getCurrentUserMeta();
          this.userService.role.set(meta.role as any);
          this.router.navigate(['/dashboard']);
          break;
        }
        default:
          this.router.navigate(['/login']);
      }
    } catch (err: any) {
      console.error('Auth callback error:', err);
      this.errorMsg = err?.message || 'Authentication failed. Please try again.';
    }
  }

  /**
   * Waits up to 5 seconds for Supabase to establish the session from the
   * OAuth redirect (token exchange happens automatically in the background).
   */
  private async waitForSession(maxRetries = 10, delayMs = 500): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      const { data } = await this.supabase.getClient().auth.getSession();
      if (data.session) return;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error('Session could not be established. The link may have expired.');
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

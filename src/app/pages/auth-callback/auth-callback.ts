import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-auth-callback',
  template: `
    <div class="auth-callback">
      <p>Signing you in…</p>
    </div>
  `,
  styles: [`
    .auth-callback {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, sans-serif;
      color: #6b7280;
    }
  `],
})
export class AuthCallbackComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private userService = inject(UserService);
  private platformId = inject(PLATFORM_ID);

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    await this.supabase.ensureAuthReady();

    const { data } = await this.supabase.getClient().auth.getSession();
    if (!data.session) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    const meta = await this.supabase.getCurrentUserMeta();
    if (meta.role) {
      this.userService.role.set(meta.role as 'mentor' | 'mentee');
    }

    // If name not collected yet, try to get it from Google user_metadata automatically
    if (!meta.nameCollected) {
      const rawMeta = data.session.user.user_metadata ?? {};

      // Google provides name in `full_name` or `name`
      const googleName: string = rawMeta['full_name'] || rawMeta['name'] || '';

      if (googleName.trim()) {
        // Auto-save the Google name — user doesn't need to type it manually
        await this.supabase.updateUserMeta({
          full_name: googleName.trim(),
          name_collected: true
        });
        // Skip the name form, go straight to role selection
        await this.router.navigateByUrl('/complete-profile', { replaceUrl: true });
        return;
      }

      // Google didn't provide a name (rare) — fall back to the name form
      await this.router.navigate(['/register'], {
        queryParams: { step: 'name' },
        replaceUrl: true
      });
      return;
    }

    const target = await this.supabase.resolvePostAuthPath();
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}

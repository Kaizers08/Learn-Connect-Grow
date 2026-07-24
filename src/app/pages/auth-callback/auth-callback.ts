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

    // After Google OAuth only — name step before role selection
    if (!meta.nameCollected) {
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

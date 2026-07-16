import { Component, OnInit, inject } from '@angular/core';
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

  async ngOnInit() {
    await this.supabase.ensureAuthReady();

    const { data } = await this.supabase.getClient().auth.getSession();
    if (!data.session) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    const target = await this.supabase.resolvePostAuthPath();
    const meta = await this.supabase.getCurrentUserMeta();
    if (meta.role) {
      this.userService.role.set(meta.role as 'mentor' | 'mentee');
    }

    await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}

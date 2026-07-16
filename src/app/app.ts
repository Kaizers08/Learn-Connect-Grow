import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase.service';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private userService = inject(UserService);

  async ngOnInit() {
    if (typeof window === 'undefined') return;

    await this.supabase.ensureAuthReady();

    if (!this.supabase.hasOAuthCallbackInUrl()) return;

    const target = await this.supabase.resolvePostAuthPath();
    const meta = await this.supabase.getCurrentUserMeta();
    if (meta.role) {
      this.userService.role.set(meta.role as 'mentor' | 'mentee');
    }

    if (this.router.url !== target) {
      await this.router.navigateByUrl(target);
    }
  }
}

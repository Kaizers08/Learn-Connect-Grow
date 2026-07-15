import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  password = '';
  confirmPassword = '';
  showPassword = false;
  loading = false;
  error = '';
  success = false;
  sessionReady = false;
  linkInvalid = false;

  private authSub: { unsubscribe: () => void } | null = null;

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    // Supabase parses the recovery token from the URL and emits PASSWORD_RECOVERY.
    const { data } = this.supabase.getClient().auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        this.sessionReady = true;
      }
    });
    this.authSub = data.subscription;

    // Fallback: if a session already exists (token already processed), allow reset.
    const { data: sessionData } = await this.supabase.getClient().auth.getSession();
    if (sessionData.session) {
      this.sessionReady = true;
    }

    // Give the client a moment to process the URL hash before flagging invalid.
    setTimeout(async () => {
      const { data: check } = await this.supabase.getClient().auth.getSession();
      if (!check.session) {
        this.linkInvalid = true;
      }
    }, 2500);
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    this.error = '';

    if (!this.password || !this.confirmPassword) {
      this.error = 'Please fill in both password fields.';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    const { error } = await this.supabase.updatePassword(this.password);
    this.loading = false;

    if (error) {
      this.error = error.message || 'Could not update password. Please try again.';
      return;
    }

    this.success = true;
    setTimeout(() => this.router.navigate(['/login']), 2500);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

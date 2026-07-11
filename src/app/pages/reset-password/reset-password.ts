import { Component, OnInit } from '@angular/core';
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
export class ResetPasswordComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';
  showNew = false;
  showConfirm = false;
  loading = false;
  success = false;
  isExpired = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    // Supabase puts the recovery token in the URL hash.
    // When the user lands here from the email link, Supabase
    // automatically exchanges the token and creates a session.
    // We just verify the session exists; if not, the link is expired.
    const { data } = await this.supabase.getClient().auth.getSession();
    if (!data.session) {
      // Check if there's a hash with access_token (Supabase v2 PKCE flow)
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) {
        this.isExpired = true;
      }
    }
  }

  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.newPassword);
  }

  get hasNumber(): boolean {
    return /\d/.test(this.newPassword);
  }

  async onSubmit() {
    this.errorMsg = '';

    if (this.newPassword.length < 8) {
      this.errorMsg = 'Password must be at least 8 characters.';
      return;
    }
    if (!this.hasUppercase) {
      this.errorMsg = 'Password must contain at least one uppercase letter.';
      return;
    }
    if (!this.hasNumber) {
      this.errorMsg = 'Password must contain at least one number.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    const { error } = await this.supabase.updatePassword(this.newPassword);
    this.loading = false;

    if (error) {
      this.errorMsg = error.message || 'Failed to update password. The link may have expired.';
    } else {
      this.success = true;
      // Sign out so they log in fresh with new password
      await this.supabase.signOut();
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;

  // Forgot password modal state
  showForgotModal = false;
  resetEmail = '';
  resetEmailSent = false;
  resetLoading = false;
  resetError = '';

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private userService: UserService
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  openForgotPassword() {
    this.showForgotModal = true;
    this.resetEmail = this.email; // pre-fill with whatever they typed
    this.resetEmailSent = false;
    this.resetError = '';
  }

  closeForgotPassword() {
    this.showForgotModal = false;
    this.resetEmail = '';
    this.resetEmailSent = false;
    this.resetError = '';
    this.resetLoading = false;
  }

  async sendResetEmail() {
    if (!this.resetEmail || !this.resetEmail.includes('@')) {
      this.resetError = 'Please enter a valid email address.';
      return;
    }
    this.resetLoading = true;
    this.resetError = '';
    const { error } = await this.supabase.sendPasswordResetEmail(this.resetEmail);
    this.resetLoading = false;
    if (error) {
      this.resetError = error.message || 'Something went wrong. Please try again.';
    } else {
      this.resetEmailSent = true;
    }
  }

  async onSignIn() {
    if (!this.email || !this.password) {
      alert('Please enter your email and password.');
      return;
    }

    const { data, error } = await this.supabase.signIn(this.email, this.password);
    if (error) {
      console.error('Sign in failed:', error.message);
      alert(error.message);
      return;
    }

    // Check admin first using the active session
    const isAdmin = await this.supabase.isAdmin();
    if (isAdmin) {
      this.router.navigate(['/admin']);
      return;
    }

    // Not admin — check role from metadata
    const meta = await this.supabase.getCurrentUserMeta();
    const role = (meta.role as 'mentor' | 'mentee') ?? 'mentee';
    this.userService.role.set(role);
    this.router.navigate(['/dashboard']);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  async signInWithGoogle() {
    const { error } = await this.supabase.signInWithGoogle();
    if (error) {
      alert(error.message || 'Google sign-in failed. Please try again.');
    }
    // No navigation needed — Supabase redirects the browser to Google,
    // then Google redirects back to /auth/callback
  }
}

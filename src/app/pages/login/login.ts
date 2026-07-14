import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { UserService } from '../../services/user.service';
import { ChatbotComponent } from '../../components/chatbot/chatbot.component';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, ChatbotComponent],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private userService: UserService
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
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

  async onGoogleSignIn() {
    const { error } = await this.supabase.signInWithGoogle();
    if (error) {
      console.error('Google sign in failed:', error.message);
      alert(error.message);
    }
    // Google will redirect to the callback URL after authentication
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}

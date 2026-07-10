import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  firstName = '';
  middleName = '';
  lastName = '';
  email = '';
  password = '';
  showPassword = false;
  agree = false;

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onSignUp() {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      alert('Please fill in all required fields.');
      return;
    }

    const fullName = [this.firstName, this.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const { error } = await this.supabase.signUp(this.email, this.password, fullName);
    if (error) {
      console.error('Sign up failed:', error.message);
      alert(error.message);
      return;
    }

    this.router.navigate(['/complete-profile']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

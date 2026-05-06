import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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

  constructor(private router: Router) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSignUp() {
    this.router.navigate(['/complete-profile']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

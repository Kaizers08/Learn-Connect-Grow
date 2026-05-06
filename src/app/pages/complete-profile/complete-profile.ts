import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-complete-profile',
  imports: [CommonModule],
  templateUrl: './complete-profile.html',
  styleUrls: ['./complete-profile.css']
})
export class CompleteProfileComponent {
  selectedRole: 'mentee' | 'mentor' | null = null;

  constructor(private router: Router) {}

  selectRole(role: 'mentee' | 'mentor') {
    this.selectedRole = role;
  }

  onNext() {
    if (this.selectedRole) {
      this.router.navigate(['/dashboard']);
    }
  }
}

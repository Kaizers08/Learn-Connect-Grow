import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-complete-profile',
  imports: [CommonModule],
  templateUrl: './complete-profile.html',
  styleUrls: ['./complete-profile.css']
})
export class CompleteProfileComponent {
  selectedRole: 'mentee' | 'mentor' | null = null;
  isLoading = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private userService: UserService,
    private supabase: SupabaseService
  ) {}

  selectRole(role: 'mentee' | 'mentor') {
    this.selectedRole = role;
    this.errorMsg = '';
  }

  async onNext() {
    if (!this.selectedRole) {
      this.errorMsg = 'Please select a role first.';
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    try {
      console.log('Selected role:', this.selectedRole);
      
      // Update user metadata in Supabase
      const { error } = await this.supabase.updateUserMeta({ role: this.selectedRole });
      
      if (error) {
        console.error('Failed to update user metadata:', error);
        this.errorMsg = 'Failed to save your role. Please try again.';
        this.isLoading = false;
        return;
      }

      // Update local user service
      this.userService.role.set(this.selectedRole);
      
      console.log('Role saved successfully, navigating to profile page...');

      // Navigate to appropriate profile page
      if (this.selectedRole === 'mentee') {
        await this.router.navigate(['/mentee-profile']);
      } else if (this.selectedRole === 'mentor') {
        await this.router.navigate(['/mentor-profile']);
      }
    } catch (error) {
      console.error('Error in onNext:', error);
      this.errorMsg = 'An unexpected error occurred. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}

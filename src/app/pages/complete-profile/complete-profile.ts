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

  constructor(
    private router: Router,
    private userService: UserService,
    private supabase: SupabaseService
  ) {}

  selectRole(role: 'mentee' | 'mentor') {
    this.selectedRole = role;
  }

  async onNext() {
    if (this.selectedRole === 'mentee') {
      this.userService.role.set('mentee');
      await this.supabase.updateUserMeta({ role: 'mentee' });
      this.router.navigate(['/mentee-profile']);
    } else if (this.selectedRole === 'mentor') {
      this.userService.role.set('mentor');
      await this.supabase.updateUserMeta({ role: 'mentor' });
      this.router.navigate(['/mentor-profile']);
    }
  }
}

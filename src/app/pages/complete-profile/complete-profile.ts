import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-complete-profile',
  imports: [CommonModule],
  templateUrl: './complete-profile.html',
  styleUrls: ['./complete-profile.css']
})
export class CompleteProfileComponent implements OnInit {
   selectedRole: 'mentee' | 'mentor' | null = null;
   isLoading = false;
   errorMsg = '';
   showTermsModal = false;
   termsChecked = false;

  private platformId = inject(PLATFORM_ID);

  constructor(
    private router: Router,
    private userService: UserService,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    await this.supabase.ensureAuthReady();
    const meta = await this.supabase.getCurrentUserMeta();
    if (!meta.nameCollected) {
      // Incomplete Google signup — send back to name step only if they were mid-flow
      await this.router.navigate(['/register'], {
        queryParams: { step: 'name' },
        replaceUrl: true
      });
    }
  }

  selectRole(role: 'mentee' | 'mentor') {
    this.selectedRole = role;
    this.errorMsg = '';
  }

    async onNext() {
      if (!this.selectedRole) {
        this.errorMsg = 'Please select a role first.';
        return;
      }
      // Show Terms of Use modal before proceeding
      this.showTermsModal = true;
    }

    cancelTerms() {
      this.showTermsModal = false;
    }

    async acceptTerms() {
      if (!this.selectedRole) {
        this.errorMsg = 'Please select a role first.';
        return;
      }
      if (!this.termsChecked) {
        this.errorMsg = 'Please check the box to agree to the Terms of Use.';
        return;
      }
      this.showTermsModal = false;
      this.isLoading = true;
      this.errorMsg = '';

      try {
        const { error } = await this.supabase.updateUserMeta({ role: this.selectedRole });

        if (error) {
          console.error('Failed to update user metadata:', error);
          this.errorMsg = 'Failed to save your role. Please try again.';
          this.isLoading = false;
          return;
        }

        this.userService.role.set(this.selectedRole);

        if (this.selectedRole === 'mentee') {
          await this.router.navigate(['/mentee-profile'], { replaceUrl: true });
        } else if (this.selectedRole === 'mentor') {
          await this.router.navigate(['/mentor-profile'], { replaceUrl: true });
        }
      } catch (error) {
        console.error('Error in acceptTerms:', error);
        this.errorMsg = 'An unexpected error occurred. Please try again.';
      } finally {
        this.isLoading = false;
      }
    }
}

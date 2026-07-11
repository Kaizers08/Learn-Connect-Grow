import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-view.html',
  styleUrls: ['./profile-view.css']
})
export class ProfileViewComponent implements OnInit {
  userId: string = '';
  userType: 'mentor' | 'mentee' = 'mentor';
  profile: any = null;
  feedback: any[] = [];
  averageRating = 0;
  totalRatings = 0;
  isLoading = true;
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Reset state
    this.isLoading = true;
    this.profile = null;
    this.errorMsg = '';
    this.cdr.detectChanges();

    // Safety timeout - force hide loading after 10 seconds
    const safetyTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.warn('Loading timeout - forcing display');
        this.isLoading = false;
        if (!this.profile && !this.errorMsg) {
          this.errorMsg = 'Loading took too long. Please try again.';
        }
        this.cdr.detectChanges();
      }
    }, 10000);

    // Get user ID and type from route
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    this.userType = this.route.snapshot.url[0]?.path as 'mentor' | 'mentee' || 'mentor';

    if (!this.userId) {
      this.errorMsg = 'User ID not found';
      this.isLoading = false;
      clearTimeout(safetyTimeout);
      this.cdr.detectChanges();
      return;
    }

    try {
      await Promise.all([
        this.loadUserProfile(),
        this.loadUserFeedback()
      ]);
    } catch (error) {
      console.error('Error loading profile data:', error);
      if (!this.errorMsg) {
        this.errorMsg = 'Failed to load profile';
      }
    } finally {
      clearTimeout(safetyTimeout);
      this.isLoading = false;
      this.cdr.detectChanges(); // Force UI update
    }
  }

  async loadUserProfile() {
    try {
      const table = this.userType === 'mentor' ? 'mentor_profiles' : 'mentee_profiles';
      const { data } = await this.supabase.getClient()
        .from(table)
        .select('*')
        .eq('user_id', this.userId)
        .maybeSingle();

      if (data) {
        this.profile = data;
      } else {
        this.errorMsg = `${this.userType === 'mentor' ? 'Mentor' : 'Mentee'} not found`;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.errorMsg = 'Failed to load profile';
    }
  }

  async loadUserFeedback() {
    // Only mentors have feedback (mentees give feedback, don't receive it)
    if (this.userType !== 'mentor') {
      this.feedback = [];
      this.totalRatings = 0;
      this.averageRating = 0;
      return;
    }

    try {
      const { data, error } = await this.supabase.getClient()
        .from('feedback_submissions')
        .select('*')
        .eq('mentor_user_id', this.userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Feedback table not found or error loading feedback:', error);
        this.feedback = [];
        this.totalRatings = 0;
        this.averageRating = 0;
        return;
      }

      if (data && data.length > 0) {
        this.totalRatings = data.length;
        
        const totalRating = data.reduce((sum: number, fb: any) => sum + fb.rating, 0);
        this.averageRating = Math.round((totalRating / data.length) * 10) / 10;

        const menteeIds = [...new Set(data.map((fb: any) => fb.mentee_user_id))];
        
        const { data: mentees } = await this.supabase.getClient()
          .from('mentee_profiles')
          .select('user_id, full_name, profile_picture')
          .in('user_id', menteeIds);

        const menteeMap = new Map(
          (mentees || []).map((m: any) => [m.user_id, m])
        );

        this.feedback = data.map((fb: any) => {
          const mentee = menteeMap.get(fb.mentee_user_id);
          return {
            ...fb,
            mentee_name: mentee?.full_name || 'Anonymous',
            mentee_picture: mentee?.profile_picture || null
          };
        });
      } else {
        this.feedback = [];
        this.totalRatings = 0;
        this.averageRating = 0;
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      this.feedback = [];
      this.totalRatings = 0;
      this.averageRating = 0;
    }
  }

  getStars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isFilled(star: number, rating: number): boolean {
    return star <= Math.round(rating);
  }

  goBack() {
    window.history.back();
  }

  getUserInitials(): string {
    if (!this.profile || !this.profile.full_name) return '?';
    return this.profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getMenteeInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  get loadingMessage(): string {
    return this.userType === 'mentor' ? 'Loading mentor profile...' : 'Loading mentee profile...';
  }

  get userTypeLabel(): string {
    return this.userType === 'mentor' ? 'Mentor' : 'Mentee';
  }
}

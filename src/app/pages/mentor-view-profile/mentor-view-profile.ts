import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-mentor-view-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mentor-view-profile.html',
  styleUrls: ['./mentor-view-profile.css']
})
export class MentorViewProfileComponent implements OnInit {
  mentorId: string = '';
  mentor: any = null;
  feedback: any[] = [];
  averageRating = 0;
  totalRatings = 0;
  isLoading = true;
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    this.mentorId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.mentorId) {
      this.errorMsg = 'Mentor ID not found';
      this.isLoading = false;
      return;
    }

    try {
      // Load both in parallel for faster loading
      await Promise.all([
        this.loadMentorProfile(),
        this.loadMentorFeedback()
      ]);
    } catch (error) {
      console.error('Error loading mentor data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadMentorProfile() {
    try {
      const { data } = await this.supabase.getClient()
        .from('mentor_profiles')
        .select('*')
        .eq('user_id', this.mentorId)
        .maybeSingle();

      if (data) {
        this.mentor = data;
      } else {
        this.errorMsg = 'Mentor not found';
      }
    } catch (error) {
      console.error('Error loading mentor profile:', error);
      this.errorMsg = 'Failed to load mentor profile';
    }
  }

  async loadMentorFeedback() {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('feedback_submissions')
        .select('*')
        .eq('mentor_user_id', this.mentorId)
        .order('created_at', { ascending: false });

      // If table doesn't exist (404), just skip feedback loading
      if (error) {
        console.warn('Feedback table not found or error loading feedback:', error);
        this.feedback = [];
        this.totalRatings = 0;
        this.averageRating = 0;
        return;
      }

      if (data && data.length > 0) {
        this.totalRatings = data.length;
        
        // Calculate average rating first (fast)
        const totalRating = data.reduce((sum: number, fb: any) => sum + fb.rating, 0);
        this.averageRating = Math.round((totalRating / data.length) * 10) / 10;

        // Get all unique mentee IDs
        const menteeIds = [...new Set(data.map((fb: any) => fb.mentee_user_id))];
        
        // Fetch all mentee profiles in ONE query (much faster!)
        const { data: mentees } = await this.supabase.getClient()
          .from('mentee_profiles')
          .select('user_id, full_name, profile_picture')
          .in('user_id', menteeIds);

        // Create a map for quick lookup
        const menteeMap = new Map(
          (mentees || []).map((m: any) => [m.user_id, m])
        );

        // Combine feedback with mentee data
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
      // Don't show error to user, just skip feedback
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

  getMentorInitials(): string {
    if (!this.mentor || !this.mentor.full_name) return '?';
    return this.mentor.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getMenteeInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}

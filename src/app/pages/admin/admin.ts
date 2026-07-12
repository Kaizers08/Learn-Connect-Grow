import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit {

  activeNav: 'dashboard' | 'requests' | 'settings' = 'dashboard';
  loading = true;

  mentorCount = 0;
  menteeCount = 0;
  mentors: any[] = [];
  mentees: any[] = [];

  adminName = 'Admin';
  adminEmail = '';

  // Mentor request detail modal
  selectedMentor: any = null;
  showModal = false;

  // Settings
  adminCurrentPassword = '';
  adminNewPassword = '';
  adminConfirmPassword = '';
  showCurrentPass = false;
  showNewPass = false;
  showConfirmPass = false;
  settingsSaved = false;
  passwordError = '';

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    console.log('[AdminComponent] ngOnInit called');
    this.loadData();
    
    // Fallback: if still loading after 10 seconds, force it to false
    setTimeout(() => {
      if (this.loading) {
        console.error('[AdminComponent] Loading timeout - forcing loading to false');
        this.loading = false;
        this.cdr.detectChanges();
      }
    }, 10000);
  }

  private loadData() {
    console.log('[AdminComponent] loadData starting...');
    
    this.loading = true;
    this.cdr.markForCheck();
    
    Promise.all([
      this.loadAdminProfile(),
      this.loadPlatformData()
    ]).then(() => {
      console.log('[AdminComponent] All data loaded');
      this.loading = false;
      this.cdr.markForCheck();
    }).catch(error => {
      console.error('[AdminComponent] loadData error:', error);
      this.loading = false;
      this.cdr.markForCheck();
    });
  }
  
  private async loadPlatformData() {
    try {
      console.log('[AdminComponent] Starting platform data fetch...');
      
      const stats = await this.supabase.getPlatformStats();
      
      console.log('[AdminComponent] Stats received:', stats);
      
      this.mentors = stats.mentors || [];
      this.mentees = stats.mentees || [];
      this.mentorCount = stats.mentorCount || 0;
      this.menteeCount = stats.menteeCount || 0;
      
      console.log('[AdminComponent] Platform data loaded successfully');
      
    } catch (error) {
      console.error('[AdminComponent] Error loading platform data:', error);
      this.mentors = [];
      this.mentees = [];
      this.mentorCount = 0;
      this.menteeCount = 0;
    }
  }

  async loadAdminProfile() {
    try {
      const { data } = await this.supabase.getAdminProfile();
      if (data) {
        this.adminName = (data as any).email?.split('@')[0] || 'Admin';
        this.adminEmail = (data as any).email || '';
      }
    } catch (error) {
      console.error('[AdminComponent] Error loading admin profile:', error);
    }
  }

  async refresh() {
    try {
      this.loading = true;
      this.cdr.markForCheck();
      
      console.log('[AdminComponent] refresh() called');
      await this.loadPlatformData();
      
      this.loading = false;
      this.cdr.markForCheck();
      
    } catch (error) {
      console.error('[AdminComponent] Error in refresh:', error);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get pendingMentors() {
    return this.mentors.filter(m => m.status === 'pending' || !m.status);
  }

  get approvedMentors() {
    return this.mentors.filter(m => m.status === 'approved');
  }

  get rejectedMentors() {
    return this.mentors.filter(m => m.status === 'rejected');
  }

  openMentorModal(mentor: any) {
    this.selectedMentor = mentor;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.selectedMentor = null;
  }

  async approve(mentor: any) {
    await this.supabase.updateMentorStatus(mentor.user_id, 'approved');
    await this.refresh();
    if (this.selectedMentor?.user_id === mentor.user_id) {
      this.selectedMentor = this.mentors.find(m => m.user_id === mentor.user_id);
    }
  }

  async reject(mentor: any) {
    await this.supabase.updateMentorStatus(mentor.user_id, 'rejected');
    await this.refresh();
    if (this.selectedMentor?.user_id === mentor.user_id) {
      this.selectedMentor = this.mentors.find(m => m.user_id === mentor.user_id);
    }
  }

  isImage(data: string): boolean {
    return typeof data === 'string' && data.startsWith('data:image');
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getStatusClass(status: string): string {
    if (status === 'approved') return 'badge-approved';
    if (status === 'rejected') return 'badge-rejected';
    return 'badge-pending';
  }

  saveSettings() {
    this.settingsSaved = true;
    setTimeout(() => this.settingsSaved = false, 3000);
  }

  savePassword() {
    this.passwordError = '';
    if (!this.adminCurrentPassword) { this.passwordError = 'Current password is required.'; return; }
    if (this.adminNewPassword.length < 8) { this.passwordError = 'New password must be at least 8 characters.'; return; }
    if (this.adminNewPassword !== this.adminConfirmPassword) { this.passwordError = 'Passwords do not match.'; return; }
    this.settingsSaved = true;
    this.adminCurrentPassword = '';
    this.adminNewPassword = '';
    this.adminConfirmPassword = '';
    setTimeout(() => this.settingsSaved = false, 3000);
  }

  onLogout() {
    this.router.navigate(['/login']);
  }
}

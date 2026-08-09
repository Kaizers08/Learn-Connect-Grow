import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AdminSafeUrlPipe } from './admin-safe-url.pipe';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule, AdminSafeUrlPipe],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit {

  activeNav: 'dashboard' | 'requests' | 'feedback' | 'resources' | 'settings' = 'dashboard';
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

  // Feedback
  feedbackList: any[] = [];
  feedbackLoading = false;
  feedbackError = '';
  feedbackSearch = '';
  feedbackSortBy: 'newest' | 'oldest' | 'highest' | 'lowest' = 'newest';
  // Grouped by mentor
  mentorFeedbackGroups: { mentor: any; feedbacks: any[]; avgRating: number; total: number }[] = [];
  // Selected mentor for drawer
  selectedFeedbackMentor: { mentor: any; feedbacks: any[]; avgRating: number; total: number } | null = null;
  showFeedbackDrawer = false;

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

  async loadFeedback() {
    this.feedbackLoading = true;
    this.feedbackList = [];
    this.feedbackError = '';
    this.mentorFeedbackGroups = [];
    this.cdr.markForCheck();

    try {
      // Use already-loaded mentors, or fetch fresh
      let mentorProfiles: any[] = this.mentors.length ? this.mentors : [];
      if (!mentorProfiles.length) {
        const { data: mp } = await this.supabase.getClient()
          .from('mentor_profiles')
          .select('user_id, full_name, expertise, profile_picture');
        mentorProfiles = mp ?? [];
      }

      // Try bulk fetch first
      const { data, error } = await this.supabase.getAllFeedback();

      if (error) {
        // RLS blocked — fall back to per-mentor queries
        console.warn('[Admin:Feedback] Bulk query blocked, trying per-mentor fallback:', (error as any).message);
        await this.loadFeedbackPerMentor(mentorProfiles);
        return;
      }

      if (!data || data.length === 0) {
        this.feedbackLoading = false;
        this.cdr.markForCheck();
        return;
      }

      await this.enrichAndBuildFeedback(data as any[], mentorProfiles);

    } catch (e: any) {
      this.feedbackError = `Unexpected error: ${e?.message ?? e}`;
    }

    this.feedbackLoading = false;
    this.cdr.markForCheck();
  }

  private async loadFeedbackPerMentor(mentorProfiles: any[]) {
    const allFeedback: any[] = [];

    for (const mentor of mentorProfiles) {
      const { data } = await this.supabase.getClient()
        .from('feedback_submissions')
        .select('id, mentor_user_id, mentee_user_id, rating, feedback_text, created_at')
        .eq('mentor_user_id', mentor.user_id)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        allFeedback.push(...(data as any[]));
      }
    }

    if (allFeedback.length === 0) {
      this.feedbackLoading = false;
      this.cdr.markForCheck();
      return;
    }

    await this.enrichAndBuildFeedback(allFeedback, mentorProfiles);
  }

  private async enrichAndBuildFeedback(data: any[], mentorProfiles: any[]) {
    const menteeIds = [...new Set<string>(data.map((f: any) => f.mentee_user_id).filter(Boolean))];

    const { data: menteeData } = await this.supabase.getClient()
      .from('mentee_profiles')
      .select('user_id, full_name, profile_picture')
      .in('user_id', menteeIds);

    const mentorMap = new Map(mentorProfiles.map((m: any) => [m.user_id, m]));
    const menteeMap = new Map((menteeData ?? []).map((m: any) => [m.user_id, m]));

    this.feedbackList = data.map((fb: any) => ({
      ...fb,
      mentor: mentorMap.get(fb.mentor_user_id) ?? { full_name: 'Unknown Mentor', expertise: '' },
      mentee: menteeMap.get(fb.mentee_user_id) ?? { full_name: 'Unknown Mentee' }
    }));

    // Group by mentor
    const groupMap = new Map<string, { mentor: any; feedbacks: any[] }>();
    for (const fb of this.feedbackList) {
      const key = fb.mentor_user_id;
      if (!groupMap.has(key)) groupMap.set(key, { mentor: fb.mentor, feedbacks: [] });
      groupMap.get(key)!.feedbacks.push(fb);
    }

    this.mentorFeedbackGroups = [...groupMap.values()].map(g => {
      const total = g.feedbacks.length;
      const sum = g.feedbacks.reduce((acc, f) => acc + (f.rating ?? 0), 0);
      return {
        mentor: g.mentor,
        feedbacks: g.feedbacks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        avgRating: total ? Math.round((sum / total) * 10) / 10 : 0,
        total
      };
    }).sort((a, b) => b.total - a.total);

    this.feedbackLoading = false;
    this.cdr.markForCheck();
  }

  get filteredFeedback() {
    const q = this.feedbackSearch.toLowerCase();
    let list = q
      ? this.feedbackList.filter(fb =>
          fb.mentor?.full_name?.toLowerCase().includes(q) ||
          fb.mentee?.full_name?.toLowerCase().includes(q) ||
          fb.feedback_text?.toLowerCase().includes(q)
        )
      : [...this.feedbackList];

    switch (this.feedbackSortBy) {
      case 'oldest':  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'highest': list.sort((a, b) => b.rating - a.rating); break;
      case 'lowest':  list.sort((a, b) => a.rating - b.rating); break;
      default:        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    return list;
  }

  get feedbackAverageRating(): number {
    if (!this.feedbackList.length) return 0;
    const sum = this.feedbackList.reduce((acc, fb) => acc + (fb.rating ?? 0), 0);
    return Math.round((sum / this.feedbackList.length) * 10) / 10;
  }

  onNavFeedback() {
    this.activeNav = 'feedback';
    this.loadFeedback();
  }

  openFeedbackDrawer(group: any) {
    this.selectedFeedbackMentor = group;
    this.showFeedbackDrawer = true;
  }

  closeFeedbackDrawer() {
    this.showFeedbackDrawer = false;
    this.selectedFeedbackMentor = null;
  }

  get filteredMentorGroups() {
    const q = this.feedbackSearch.toLowerCase();
    return q
      ? this.mentorFeedbackGroups.filter(g =>
          g.mentor?.full_name?.toLowerCase().includes(q) ||
          g.mentor?.expertise?.toLowerCase().includes(q)
        )
      : this.mentorFeedbackGroups;
  }

  renderStars(rating: number): number[] {
    return [1, 2, 3, 4, 5];
  }

  // Resources
  resourcesLoading = false;
  resourcesError = '';
  resourceSearch = '';
  // All mentors with their materials grouped
  mentorResourceGroups: { mentor: any; materials: any[]; total: number }[] = [];
  // Selected mentor for drawer
  selectedResourceMentor: { mentor: any; materials: any[]; total: number } | null = null;
  showResourcesDrawer = false;

  async loadResources() {
    this.resourcesLoading = true;
    this.resourcesError = '';
    this.mentorResourceGroups = [];
    this.cdr.markForCheck();

    try {
      // Use already-loaded mentors list, or fetch fresh
      let mentorProfiles: any[] = this.mentors.length ? this.mentors : [];
      if (!mentorProfiles.length) {
        const { data: mp } = await this.supabase.getClient()
          .from('mentor_profiles')
          .select('user_id, full_name, expertise, profile_picture');
        mentorProfiles = mp ?? [];
      }

      if (!mentorProfiles.length) {
        this.resourcesLoading = false;
        this.cdr.markForCheck();
        return;
      }

      // Fetch materials for ALL mentors in one query using their IDs
      const mentorIds = mentorProfiles.map((m: any) => m.user_id).filter(Boolean);

      const { data, error } = await this.supabase.getClient()
        .from('learning_materials')
        .select('id, mentor_user_id, title, description, order_number, file_url, file_type, file_name, duration_minutes, created_at')
        .in('mentor_user_id', mentorIds)
        .order('order_number', { ascending: true });

      if (error) {
        // RLS blocked the bulk query — fall back to fetching per mentor
        console.warn('[Admin:Resources] Bulk query blocked, trying per-mentor fallback:', error.message);
        await this.loadResourcesPerMentor(mentorProfiles);
        return;
      }

      const materials = (data as any[]) ?? [];
      this.buildResourceGroups(materials, mentorProfiles);

    } catch (e: any) {
      this.resourcesError = `Unexpected error: ${e?.message ?? e}`;
    }

    this.resourcesLoading = false;
    this.cdr.markForCheck();
  }

  private async loadResourcesPerMentor(mentorProfiles: any[]) {
    // Fallback: query each mentor's materials individually
    // This works even with restrictive RLS since each mentor can read their own rows
    const groups: { mentor: any; materials: any[]; total: number }[] = [];

    for (const mentor of mentorProfiles) {
      const { data } = await this.supabase.getClient()
        .from('learning_materials')
        .select('id, mentor_user_id, title, description, order_number, file_url, file_type, file_name, duration_minutes, created_at')
        .eq('mentor_user_id', mentor.user_id)
        .order('order_number', { ascending: true });

      const materials = (data as any[]) ?? [];
      if (materials.length > 0) {
        groups.push({ mentor, materials, total: materials.length });
      }
    }

    this.mentorResourceGroups = groups.sort((a, b) => b.total - a.total);
    this.resourcesLoading = false;
    this.cdr.markForCheck();
  }

  private buildResourceGroups(materials: any[], mentorProfiles: any[]) {
    const mentorMap = new Map(mentorProfiles.map((m: any) => [m.user_id, m]));
    const groupMap = new Map<string, any[]>();

    for (const mat of materials) {
      if (!groupMap.has(mat.mentor_user_id)) groupMap.set(mat.mentor_user_id, []);
      groupMap.get(mat.mentor_user_id)!.push(mat);
    }

    this.mentorResourceGroups = [...groupMap.entries()]
      .map(([mentorId, mats]) => ({
        mentor: mentorMap.get(mentorId) ?? { full_name: 'Unknown Mentor', expertise: '' },
        materials: mats,
        total: mats.length
      }))
      .sort((a, b) => b.total - a.total);
  }

  get filteredResourceGroups() {
    const q = this.resourceSearch.toLowerCase();
    return q
      ? this.mentorResourceGroups.filter(g =>
          g.mentor?.full_name?.toLowerCase().includes(q) ||
          g.mentor?.expertise?.toLowerCase().includes(q)
        )
      : this.mentorResourceGroups;
  }

  get totalResourcesCount() {
    return this.mentorResourceGroups.reduce((sum, g) => sum + g.total, 0);
  }

  onNavResources() {
    this.activeNav = 'resources';
    this.loadResources();
  }

  openResourcesDrawer(group: any) {
    this.selectedResourceMentor = group;
    this.showResourcesDrawer = true;
  }

  closeResourcesDrawer() {
    this.showResourcesDrawer = false;
    this.selectedResourceMentor = null;
  }

  // File preview modal
  showFilePreview = false;
  previewMaterial: any = null;

  openFilePreview(material: any) {
    this.previewMaterial = material;
    this.showFilePreview = true;
  }

  closeFilePreview() {
    this.showFilePreview = false;
    this.previewMaterial = null;
  }

  getGoogleDocsViewerUrl(fileUrl: string): string {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  }

  getFileTypeIcon(fileType: string): string {
    switch (fileType) {
      case 'video':    return 'video';
      case 'pdf':      return 'pdf';
      case 'document': return 'doc';
      case 'image':    return 'img';
      default:         return 'file';
    }
  }

  getFileTypeLabel(fileType: string): string {
    switch (fileType) {
      case 'video':    return 'Video';
      case 'pdf':      return 'PDF';
      case 'document': return 'Document';
      case 'image':    return 'Image';
      default:         return 'File';
    }
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

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { UserService } from '../../services/user.service';

interface LearningMaterial {
  id: string;
  mentor_user_id: string;
  title: string;
  description: string;
  order_number: string;
  file_url: string;
  file_type: string;
  file_name: string;
  duration_minutes: number;
  created_at: string;
  completed?: boolean; // For mentee view
  /** ClamAV scan verdict: 'trusted' passed, 'blocked' rejected, 'unscanned' legacy. */
  scan_status?: 'trusted' | 'blocked' | 'unscanned' | string;
}

interface MenteeProgress {
  mentee_user_id: string;
  mentee_name: string;
  mentee_picture: string;
  total_materials: number;
  completed_materials: number;
  progress_percentage: number;
}

@Component({
  selector: 'app-learning-materials',
  imports: [CommonModule, FormsModule],
  templateUrl: './learning-materials.html',
  styleUrl: './learning-materials.css'
})
export class LearningMaterialsComponent implements OnInit {
  Math = Math; // Expose Math for template
  isMentor = false;
  currentUserId = '';
  mentorName = '';
  mentorPicture = '';
  
  // Materials list
  materials: LearningMaterial[] = [];
  
  // Upload modal
  showUploadModal = false;
  uploadTitle = '';
  uploadDescription = '';
  uploadOrderNumber = '';
  uploadFile: File | null = null;
  uploadFileName = '';
  uploadFileSize = 0; // File size in bytes
  uploadDuration: number | null = null;
  isUploading = false;

  // ClamAV virus scan state (mentor uploads only)
  uploadStage: 'idle' | 'uploading' | 'scanning' | 'saving' = 'idle';
  scanMessage = '';
  scanError = '';
  
  // Edit modal
  showEditModal = false;
  editingMaterial: LearningMaterial | null = null;
  editTitle = '';
  editDescription = '';
  editOrderNumber = '';
  editDuration: number | null = null;
  
  // Mentee progress view (for mentors)
  menteesProgress: MenteeProgress[] = [];
  
  // Mentee view
  selectedMentorId = '';
  availableMentors: any[] = [];

  constructor(
    private supabase: SupabaseService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    this.isMentor = this.userService.role() === 'mentor';
    this.currentUserId = await this.supabase.getCurrentUserId() || '';
    
    if (this.isMentor) {
      await this.loadMentorProfile();
      await this.loadMaterials();
      await this.loadMenteesProgress();
    } else {
      await this.loadConnectedMentors();
    }
  }

  async loadMentorProfile() {
    const { data } = await this.supabase.getClient()
      .from('mentor_profiles')
      .select('full_name, profile_picture')
      .eq('user_id', this.currentUserId)
      .maybeSingle();
    
    if (data) {
      this.mentorName = data.full_name || 'Mentor';
      this.mentorPicture = data.profile_picture || '';
    }
  }

  async loadConnectedMentors() {
    // Get all connected mentors
    const connections = await this.supabase.getMyConnections();
    const mentorIds = connections
      .filter((c: any) => c.mentee_user_id === this.currentUserId && c.status === 'connected')
      .map((c: any) => c.mentor_user_id);

    if (mentorIds.length === 0) {
      this.availableMentors = [];
      return;
    }

    const { data: mentors } = await this.supabase.getClient()
      .from('mentor_profiles')
      .select('user_id, full_name, profile_picture')
      .in('user_id', mentorIds);

    this.availableMentors = mentors || [];
    
    // Auto-select first mentor
    if (this.availableMentors.length > 0) {
      this.selectMentor(this.availableMentors[0].user_id);
    }
  }

  async selectMentor(mentorId: string) {
    this.selectedMentorId = mentorId;
    const mentor = this.availableMentors.find(m => m.user_id === mentorId);
    if (mentor) {
      this.mentorName = mentor.full_name || 'Mentor';
      this.mentorPicture = mentor.profile_picture || '';
    }
    await this.loadMaterialsForMentee();
  }

  async loadMaterials() {
    const { data } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.currentUserId)
      .order('order_number', { ascending: true });

    this.materials = data || [];
  }

  async loadMaterialsForMentee() {
    if (!this.selectedMentorId) return;

    // Load materials from selected mentor
    const { data: materialsData } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.selectedMentorId)
      .order('order_number', { ascending: true });

    // Load progress for this mentee
    const { data: progressData } = await this.supabase.getClient()
      .from('material_progress')
      .select('material_id, completed')
      .eq('mentee_user_id', this.currentUserId);

    const progressMap = new Map(
      (progressData || []).map((p: any) => [p.material_id, p.completed])
    );

    this.materials = (materialsData || []).map(m => ({
      ...m,
      completed: progressMap.get(m.id) || false
    }));
  }

  async loadMenteesProgress() {
    // Get all connected mentees
    const connections = await this.supabase.getMyConnections();
    const menteeIds = connections
      .filter((c: any) => c.mentor_user_id === this.currentUserId && c.status === 'connected')
      .map((c: any) => c.mentee_user_id);

    if (menteeIds.length === 0) {
      this.menteesProgress = [];
      return;
    }

    // Get mentee profiles
    const { data: mentees } = await this.supabase.getClient()
      .from('mentee_profiles')
      .select('user_id, full_name, profile_picture')
      .in('user_id', menteeIds);

    // Get total materials count
    const totalMaterials = this.materials.length;

    // Get progress for each mentee
    const progressPromises = (mentees || []).map(async (mentee: any) => {
      const { data: progress } = await this.supabase.getClient()
        .from('material_progress')
        .select('material_id, completed')
        .eq('mentee_user_id', mentee.user_id)
        .eq('completed', true);

      const completedCount = (progress || []).length;
      const percentage = totalMaterials > 0 
        ? Math.round((completedCount / totalMaterials) * 100) 
        : 0;

      return {
        mentee_user_id: mentee.user_id,
        mentee_name: mentee.full_name || 'Mentee',
        mentee_picture: mentee.profile_picture || '',
        total_materials: totalMaterials,
        completed_materials: completedCount,
        progress_percentage: percentage
      };
    });

    this.menteesProgress = await Promise.all(progressPromises);
  }

  openUploadModal() {
    this.showUploadModal = true;
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.uploadOrderNumber = this.getNextOrderNumber();
    this.uploadFile = null;
    this.uploadFileName = '';
    this.uploadFileSize = 0;
    this.uploadDuration = null;
    this.resetScanState();
  }

  closeUploadModal() {
    this.showUploadModal = false;
    this.uploadFile = null;
    this.resetScanState();
  }

  resetScanState() {
    this.uploadStage = 'idle';
    this.scanMessage = '';
    this.scanError = '';
  }

  /** Label of the Upload modal's submit button (reflects the current stage). */
  getUploadButtonLabel(): string {
    if (!this.isUploading) return 'Upload';
    if (this.uploadStage === 'scanning') return 'Scanning...';
    if (this.uploadStage === 'saving') return 'Saving...';
    return 'Uploading...';
  }

  /** Names the fields still blocking the Upload button, so it is never a mystery. */
  getMissingFields(): string[] {
    const missing: string[] = [];
    if (!this.uploadOrderNumber) missing.push('Order Number');
    if (!this.uploadTitle) missing.push('Title');
    if (!this.uploadFile) missing.push('File');
    return missing;
  }

  /** Badge text for a material's virus-scan result. */
  getScanStatusLabel(material: LearningMaterial): string {
    switch (material.scan_status) {
      case 'trusted': return 'Trusted';
      case 'blocked': return 'Blocked';
      default: return 'Unscanned';
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      // Check file size (50MB limit for free tier)
      const maxSize = 50 * 1024 * 1024; // 50MB in bytes
      if (file.size > maxSize) {
        alert(`⚠️ File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.\n\nTips:\n- Compress your video\n- Use lower resolution (720p)\n- Or upgrade to Supabase Pro for larger files`);
        (event.target as HTMLInputElement).value = ''; // Clear input
        return;
      }
      
      this.uploadFile = file;
      this.uploadFileName = file.name;
      this.uploadFileSize = file.size;
      this.resetScanState();
    }
  }

  getFileSizeLabel(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getNextOrderNumber(): string {
    if (this.materials.length === 0) return '1.1';
    
    const lastOrder = this.materials[this.materials.length - 1].order_number;
    const parts = lastOrder.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    
    return `${major}.${minor + 1}`;
  }

  async uploadMaterial() {
    if (!this.uploadTitle || !this.uploadFile || !this.uploadOrderNumber) {
      alert('Please fill in all required fields');
      return;
    }

    this.isUploading = true;
    this.resetScanState();

    let stagedPath = '';

    try {
      // ── 1. Stage the file in the PRIVATE quarantine bucket ──────────────
      // Never uploaded straight to the public bucket — an infected file must
      // not be downloadable before the scan verdict is in.
      this.uploadStage = 'uploading';
      this.scanMessage = 'Uploading file securely...';

      const staged = await this.supabase.stageLearningMaterial(this.currentUserId, this.uploadFile);
      if ('error' in staged) {
        // The most common cause is a missing storage policy: the upload needs the
        // "quarantine/<user-id>/..." path allowed in supabase/clamav-storage-setup.sql.
        const detail = staged.error || '';
        if (/row-level security|policy|permission|not allowed/i.test(detail)) {
          throw new Error(
            'Upload blocked by a storage permission rule.\n\n' +
            'Ask an administrator to apply the storage policies for this feature.\n\n' +
            `Details: ${detail}`
          );
        }
        throw new Error(detail || 'Could not upload the file.');
      }
      stagedPath = staged.path;

      // ── 2. Scan with ClamAV (Edge Function publishes only clean files) ──
      this.uploadStage = 'scanning';
      this.scanMessage = 'Scanning...';

      const scan = await this.supabase.scanLearningMaterial(
        stagedPath,
        this.uploadFile.type || 'application/octet-stream'
      );

      if (!scan.clean) {
        // Infected or scanner error. The Edge Function already deleted the
        // infected copy from quarantine; this is a safety-net cleanup.
        if (stagedPath) await this.supabase.removeStagedMaterial(stagedPath);

        // Generic message on purpose: the matched signature is only in the
        // scanner logs, never shown to the uploader.
        this.scanError = scan.error
          || 'Malicious file detected. The upload was rejected and the file was removed.';

        alert(`🛡️ ${this.scanError}`);
        return;
      }

      // ── 3. Only now: store the material record ──────────────────────────
      this.uploadStage = 'saving';
      this.scanMessage = 'Saving material...';

      let fileUrl = scan.publicUrl || '';
      if (!fileUrl && scan.path) {
        const { data } = this.supabase.getClient()
          .storage
          .from('learning-materials')
          .getPublicUrl(scan.path);
        fileUrl = data.publicUrl;
      }
      const fileExt = this.uploadFile.name.split('.').pop();
      const fileType = this.getFileType(fileExt || '');

      const { error: insertError } = await this.supabase.getClient()
        .from('learning_materials')
        .insert({
          mentor_user_id: this.currentUserId,
          title: this.uploadTitle,
          description: this.uploadDescription,
          order_number: this.uploadOrderNumber,
          file_url: fileUrl,
          file_type: fileType,
          file_name: this.uploadFile.name,
          duration_minutes: this.uploadDuration,
          // Only clean files reach this point; the Column defaults as a safety net.
          scan_status: 'trusted'
        });

      if (insertError) throw insertError;

      this.scanMessage = 'Scan passed - marked Trusted.';
      alert('✅ Material scanned and uploaded - marked Trusted.');
      this.closeUploadModal();
      await this.loadMaterials();
      await this.loadMenteesProgress();
    } catch (error) {
      console.error('Error uploading material:', error);

      // Staged copy is still sitting in the private bucket — clean it up.
      if (stagedPath) await this.supabase.removeStagedMaterial(stagedPath);

      this.scanError = error instanceof Error ? error.message : 'Failed to upload material. Please try again.';
      alert(`❌ ${this.scanError}`);
    } finally {
      this.isUploading = false;
      this.uploadStage = 'idle';
      this.scanMessage = '';
    }
  }

  getFileType(extension: string): string {
    const ext = extension.toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx', 'txt', 'ppt', 'pptx'].includes(ext)) return 'document';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    return 'file';
  }

  openEditModal(material: LearningMaterial) {
    this.editingMaterial = material;
    this.editTitle = material.title;
    this.editDescription = material.description;
    this.editOrderNumber = material.order_number;
    this.editDuration = material.duration_minutes;
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingMaterial = null;
  }

  async updateMaterial() {
    if (!this.editingMaterial || !this.editTitle || !this.editOrderNumber) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await this.supabase.getClient()
        .from('learning_materials')
        .update({
          title: this.editTitle,
          description: this.editDescription,
          order_number: this.editOrderNumber,
          duration_minutes: this.editDuration,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.editingMaterial.id);

      if (error) throw error;

      alert('✅ Material updated successfully!');
      this.closeEditModal();
      await this.loadMaterials();
    } catch (error) {
      console.error('Error updating material:', error);
      alert('❌ Failed to update material. Please try again.');
    }
  }

  async deleteMaterial(material: LearningMaterial) {
    if (!confirm(`Are you sure you want to delete "${material.title}"?`)) return;

    try {
      // Delete file from storage
      const filePath = material.file_url.split('/learning-materials/')[1];
      if (filePath) {
        await this.supabase.getClient()
          .storage
          .from('learning-materials')
          .remove([filePath]);
      }

      // Delete record
      const { error } = await this.supabase.getClient()
        .from('learning_materials')
        .delete()
        .eq('id', material.id);

      if (error) throw error;

      alert('✅ Material deleted successfully!');
      await this.loadMaterials();
      await this.loadMenteesProgress();
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('❌ Failed to delete material. Please try again.');
    }
  }

  async toggleCompletion(material: LearningMaterial) {
    if (this.isMentor) return; // Only mentees can mark as complete

    try {
      const newCompletedState = !material.completed;

      // Check if progress record exists
      const { data: existing } = await this.supabase.getClient()
        .from('material_progress')
        .select('id')
        .eq('mentee_user_id', this.currentUserId)
        .eq('material_id', material.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        await this.supabase.getClient()
          .from('material_progress')
          .update({
            completed: newCompletedState,
            completed_at: newCompletedState ? new Date().toISOString() : null
          })
          .eq('id', existing.id);
      } else {
        // Insert new
        await this.supabase.getClient()
          .from('material_progress')
          .insert({
            mentee_user_id: this.currentUserId,
            material_id: material.id,
            completed: newCompletedState,
            completed_at: newCompletedState ? new Date().toISOString() : null
          });
      }

      // Update local state
      material.completed = newCompletedState;
    } catch (error) {
      console.error('Error toggling completion:', error);
      alert('❌ Failed to update progress. Please try again.');
    }
  }

  getFileIcon(fileType: string): string {
    switch (fileType) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'document': return '📝';
      case 'image': return '🖼️';
      default: return '📎';
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getProgressColor(percentage: number): string {
    if (percentage >= 75) return '#10b981'; // green
    if (percentage >= 50) return '#3b82f6'; // blue
    if (percentage >= 25) return '#f59e0b'; // orange
    return '#ef4444'; // red
  }
}

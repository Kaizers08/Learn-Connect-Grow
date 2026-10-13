import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-mentor-documents',
  imports: [CommonModule, FormsModule],
  templateUrl: './mentor-documents.html',
  styleUrls: ['./mentor-documents.css']
})
export class MentorDocumentsComponent {
  // Diploma — optional
  diplomaFile: File | null = null;
  diplomaName = '';
  diplomaPreview: string | null = null;

  // Certifications — at least 1 required
  certFiles: { file: File; name: string; preview: string }[] = [];

  submitting = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  onDiplomaChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.diplomaFile = file;
    this.diplomaName = file.name;
    this.diplomaPreview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;
  }

  removeDiploma() {
    if (this.diplomaPreview) URL.revokeObjectURL(this.diplomaPreview);
    this.diplomaFile = null;
    this.diplomaName = '';
    this.diplomaPreview = null;
  }

  onCertificationChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    this.certFiles.push({ file, name: file.name, preview });
  }

  removeCertification(index: number) {
    const cert = this.certFiles[index];
    if (cert?.preview) URL.revokeObjectURL(cert.preview);
    this.certFiles = this.certFiles.filter((_, i) => i !== index);
  }

  async onSubmit() {
    this.errorMsg = '';

    if (this.certFiles.length === 0) {
      this.errorMsg = 'At least one certification is required.';
      return;
    }

    this.submitting = true;

    const userId = await this.supabase.getCurrentUserId();
    if (!userId) {
      this.errorMsg = 'Not authenticated.';
      this.submitting = false;
      return;
    }

    // Upload diploma to Storage (optional)
    let diplomaUrl: string | undefined;
    let diplomaScanStatus = 'unscanned';
    if (this.diplomaFile) {
      const staged = await this.supabase.stageLearningMaterial(userId, this.diplomaFile);
      if ('error' in staged) {
        this.errorMsg = staged.error;
        this.submitting = false;
        return;
      }
      const scan = await this.supabase.scanLearningMaterial(
        staged.path,
        this.diplomaFile.type || 'application/octet-stream'
      );
      if (scan.error) {
        this.errorMsg = scan.error;
        this.submitting = false;
        return;
      }
      diplomaUrl = scan.publicUrl;
      diplomaScanStatus = scan.clean ? 'trusted' : 'blocked';
    }

    // Upload all certifications to Storage and scan each one
    const certUrls: string[] = [];
    let certificationsScanStatus = 'trusted'; // clean unless any file is blocked
    for (const cert of this.certFiles) {
      const staged = await this.supabase.stageLearningMaterial(userId, cert.file);
      if ('error' in staged) {
        this.errorMsg = staged.error;
        this.submitting = false;
        return;
      }
      const scan = await this.supabase.scanLearningMaterial(
        staged.path,
        cert.file.type || 'application/octet-stream'
      );
      if (scan.error) {
        this.errorMsg = scan.error;
        this.submitting = false;
        return;
      }
      if (!scan.clean) {
        certificationsScanStatus = 'blocked';
      }
      if (scan.publicUrl) {
        // Also run Sightengine AI detection on image certs
        if (cert.file.type.startsWith('image/')) {
          const seScan = await this.supabase.scanMentorDocument(scan.publicUrl, 'certification');
          if (seScan.status === 'blocked') {
            certificationsScanStatus = 'blocked';
          }
        }
        certUrls.push(scan.publicUrl);
      }
    }

    if (certUrls.length === 0) {
      this.errorMsg = 'Failed to upload certifications. Please try again.';
      this.submitting = false;
      return;
    }

    const { error } = await this.supabase.submitMentorDocuments(
      diplomaUrl,
      certUrls,
      diplomaScanStatus,
      certificationsScanStatus
    );
    this.submitting = false;

    if (error) {
      console.error('Failed to submit documents:', error);
      this.errorMsg = error.message;
      return;
    }

    this.router.navigate(['/pending-approval'], { replaceUrl: true });
  }

  onPrevious() {
    this.router.navigate(['/mentor-profile']);
  }
}

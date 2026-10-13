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

  // Valid ID — required
  idType = '';
  idFrontFile: File | null = null;
  idFrontName = '';
  idFrontPreview: string | null = null;
  idBackFile: File | null = null;
  idBackName = '';
  idBackPreview: string | null = null;

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

  onIdFrontChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.idFrontFile = file;
    this.idFrontName = file.name;
    this.idFrontPreview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;
  }

  removeIdFront() {
    if (this.idFrontPreview) URL.revokeObjectURL(this.idFrontPreview);
    this.idFrontFile = null;
    this.idFrontName = '';
    this.idFrontPreview = null;
  }

  onIdBackChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.idBackFile = file;
    this.idBackName = file.name;
    this.idBackPreview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;
  }

  removeIdBack() {
    if (this.idBackPreview) URL.revokeObjectURL(this.idBackPreview);
    this.idBackFile = null;
    this.idBackName = '';
    this.idBackPreview = null;
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

    if (!this.idType) {
      this.errorMsg = 'Please select a valid ID type.';
      return;
    }

    if (!this.idFrontFile) {
      this.errorMsg = 'Please upload the front side of your ID.';
      return;
    }

    if (!this.idBackFile) {
      this.errorMsg = 'Please upload the back side of your ID.';
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

    // Upload Valid ID Front and scan
    let idFrontUrl: string | undefined;
    let idFrontScanStatus = 'unscanned';
    if (this.idFrontFile) {
      const staged = await this.supabase.stageLearningMaterial(userId, this.idFrontFile);
      if ('error' in staged) {
        this.errorMsg = staged.error;
        this.submitting = false;
        return;
      }
      const scan = await this.supabase.scanLearningMaterial(
        staged.path,
        this.idFrontFile.type || 'application/octet-stream'
      );
      if (scan.error) {
        this.errorMsg = scan.error;
        this.submitting = false;
        return;
      }
      idFrontUrl = scan.publicUrl;
      idFrontScanStatus = scan.clean ? 'trusted' : 'blocked';
      
      // Also run Sightengine AI detection on the ID front
      if (scan.publicUrl && this.idFrontFile.type.startsWith('image/')) {
        const seScan = await this.supabase.scanMentorDocument(scan.publicUrl, 'valid_id');
        if (seScan.status === 'blocked') {
          idFrontScanStatus = 'blocked';
        }
      }
    }

    // Upload Valid ID Back and scan
    let idBackUrl: string | undefined;
    let idBackScanStatus = 'unscanned';
    if (this.idBackFile) {
      const staged = await this.supabase.stageLearningMaterial(userId, this.idBackFile);
      if ('error' in staged) {
        this.errorMsg = staged.error;
        this.submitting = false;
        return;
      }
      const scan = await this.supabase.scanLearningMaterial(
        staged.path,
        this.idBackFile.type || 'application/octet-stream'
      );
      if (scan.error) {
        this.errorMsg = scan.error;
        this.submitting = false;
        return;
      }
      idBackUrl = scan.publicUrl;
      idBackScanStatus = scan.clean ? 'trusted' : 'blocked';
      
      // Also run Sightengine AI detection on the ID back
      if (scan.publicUrl && this.idBackFile.type.startsWith('image/')) {
        const seScan = await this.supabase.scanMentorDocument(scan.publicUrl, 'valid_id');
        if (seScan.status === 'blocked') {
          idBackScanStatus = 'blocked';
        }
      }
    }

    const { error } = await this.supabase.submitMentorDocuments(
      diplomaUrl,
      certUrls,
      diplomaScanStatus,
      certificationsScanStatus,
      this.idType,
      idFrontUrl,
      idBackUrl,
      idFrontScanStatus,
      idBackScanStatus
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

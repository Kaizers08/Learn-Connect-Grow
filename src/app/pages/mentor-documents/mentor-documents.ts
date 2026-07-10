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
  diploma: string | null = null;
  diplomaName = '';
  certifications: { name: string; data: string }[] = [];
  submitting = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  onDiplomaChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.diplomaName = file.name;
    const reader = new FileReader();
    reader.onload = () => { this.diploma = reader.result as string; };
    reader.readAsDataURL(file);
  }

  removeDiploma() {
    this.diploma = null;
    this.diplomaName = '';
  }

  onCertificationChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.certifications.push({ name: file.name, data: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  removeCertification(index: number) {
    this.certifications = this.certifications.filter((_, i) => i !== index);
  }

  async onSubmit() {
    this.errorMsg = '';

    // Certifications required (diploma optional)
    if (this.certifications.length === 0) {
      this.errorMsg = 'At least one certification is required.';
      return;
    }

    this.submitting = true;
    const { error } = await this.supabase.submitMentorDocuments(
      this.diploma ?? undefined,
      this.certifications.map(c => c.data)
    );
    this.submitting = false;

    if (error) {
      console.error('Failed to submit documents:', error);
      this.errorMsg = error.message;
      return;
    }

    // Mentor must wait for admin approval
    this.router.navigate(['/pending-approval']);
  }

  onPrevious() {
    this.router.navigate(['/mentor-profile']);
  }
}

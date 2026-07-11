import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen) {
      <div class="feedback-modal-backdrop" (click)="close()">
        <div class="feedback-modal" (click)="$event.stopPropagation()">
          <button class="feedback-modal-close" (click)="close()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="#555" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>

          <div class="fm-header">
            <div class="fm-mentor-avatar">
              @if (mentor?.profile_picture) {
                <img [src]="mentor.profile_picture" alt="Mentor" class="fm-avatar-img">
              } @else {
                <span>{{ getInitials(mentor?.full_name || 'Mentor') }}</span>
              }
            </div>
            <div class="fm-mentor-info">
              <h2 class="fm-title">Rate {{ mentor?.full_name || 'Mentor' }}</h2>
              <p class="fm-subtitle">{{ mentor?.expertise || 'Share your feedback' }}</p>
            </div>
          </div>

          <div class="fm-divider"></div>

          <div class="fm-body">
            <!-- Star Rating -->
            <div class="fm-rating-section">
              <label class="fm-label">Your Rating</label>
              <div class="fm-stars">
                @for (star of getStars(); track star) {
                  <button 
                    type="button"
                    class="fm-star"
                    [class.filled]="isFilled(star)"
                    (click)="setRating(star)"
                    (mouseenter)="hoverRating = star"
                    (mouseleave)="hoverRating = 0"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                    </svg>
                  </button>
                }
              </div>
              @if (rating > 0) {
                <p class="fm-rating-value">{{ rating }}.0 out of 5</p>
              }
            </div>

            <!-- Feedback Text -->
            <div class="fm-feedback-section">
              <label class="fm-label">Your Feedback (Optional)</label>
              <textarea 
                class="fm-textarea"
                placeholder="Share your experience with this mentor... (max 1000 characters)"
                [(ngModel)]="feedbackText"
                (input)="validateFeedback()"
                maxlength="1000"
              ></textarea>
              <p class="fm-char-count">{{ feedbackText.length }} / 1000</p>
            </div>

            <!-- Error Message -->
            @if (errorMessage) {
              <div class="fm-error">{{ errorMessage }}</div>
            }
          </div>

          <div class="fm-divider"></div>

          <div class="fm-actions">
            <button class="fm-btn-cancel" (click)="close()">Cancel</button>
            <button 
              class="fm-btn-submit" 
              (click)="submit()"
              [disabled]="!rating || isSubmitting"
            >
              {{ isSubmitting ? 'Submitting...' : 'Submit Feedback' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .feedback-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .feedback-modal {
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
    }

    .feedback-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      transition: color 0.2s;
      z-index: 10;
    }

    .feedback-modal-close:hover {
      color: #555;
    }

    .fm-header {
      padding: 32px 24px 24px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .fm-mentor-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #04A2D7, #0088cc);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      font-weight: 600;
      flex-shrink: 0;
      overflow: hidden;
    }

    .fm-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .fm-mentor-info {
      flex: 1;
    }

    .fm-title {
      font-size: 18px;
      font-weight: 600;
      color: #222;
      margin: 0 0 4px 0;
    }

    .fm-subtitle {
      font-size: 14px;
      color: #999;
      margin: 0;
    }

    .fm-divider {
      height: 1px;
      background: #eee;
    }

    .fm-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .fm-rating-section,
    .fm-feedback-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .fm-label {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .fm-stars {
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .fm-star {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: #ddd;
      transition: color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .fm-star:hover,
    .fm-star.filled {
      color: #F59E0B;
    }

    .fm-rating-value {
      text-align: center;
      font-size: 14px;
      color: #04A2D7;
      margin: 0;
      font-weight: 500;
    }

    .fm-textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      transition: border-color 0.2s;
    }

    .fm-textarea:focus {
      outline: none;
      border-color: #04A2D7;
    }

    .fm-char-count {
      font-size: 12px;
      color: #999;
      margin: 0;
      text-align: right;
    }

    .fm-error {
      padding: 12px;
      background: #fee;
      color: #c33;
      border-radius: 8px;
      font-size: 14px;
    }

    .fm-actions {
      padding: 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .fm-btn-cancel,
    .fm-btn-submit {
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .fm-btn-cancel {
      background: #f0f0f0;
      color: #333;
    }

    .fm-btn-cancel:hover {
      background: #e0e0e0;
    }

    .fm-btn-submit {
      background: #04A2D7;
      color: white;
    }

    .fm-btn-submit:hover:not(:disabled) {
      background: #0088cc;
    }

    .fm-btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class FeedbackModalComponent {
  @Input() isOpen = false;
  @Input() mentor: any = null;
  @Input() existingFeedback: any = null;
  @Output() onSubmit = new EventEmitter<{ rating: number; feedback_text: string }>();
  @Output() onClose = new EventEmitter<void>();

  rating = 0;
  hoverRating = 0;
  feedbackText = '';
  errorMessage = '';
  isSubmitting = false;

  ngOnInit() {
    if (this.existingFeedback) {
      this.rating = this.existingFeedback.rating;
      this.feedbackText = this.existingFeedback.feedback_text || '';
    }
  }

  ngOnChanges() {
    if (this.existingFeedback) {
      this.rating = this.existingFeedback.rating;
      this.feedbackText = this.existingFeedback.feedback_text || '';
    } else {
      this.rating = 0;
      this.feedbackText = '';
    }
    this.errorMessage = '';
  }

  getStars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isFilled(star: number): boolean {
    return star <= (this.hoverRating || this.rating);
  }

  setRating(star: number) {
    this.rating = star;
    this.hoverRating = 0;
  }

  validateFeedback() {
    if (this.feedbackText.length > 1000) {
      this.errorMessage = 'Feedback cannot exceed 1000 characters';
    } else {
      this.errorMessage = '';
    }
  }

  submit() {
    this.errorMessage = '';

    if (!this.rating) {
      this.errorMessage = 'Please select a rating';
      return;
    }

    if (this.feedbackText.length > 1000) {
      this.errorMessage = 'Feedback cannot exceed 1000 characters';
      return;
    }

    this.isSubmitting = true;
    this.onSubmit.emit({
      rating: this.rating,
      feedback_text: this.feedbackText
    });
    
    // Reset form after short delay
    setTimeout(() => {
      this.isSubmitting = false;
      this.rating = 0;
      this.feedbackText = '';
    }, 500);
  }

  close() {
    this.onClose.emit();
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}

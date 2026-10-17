import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-otp-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './otp-modal.component.html',
  styleUrl: './otp-modal.component.css'
})
export class OtpModalComponent {
  @Input() email = '';
  @Input() show = false;
  @Output() verify = new EventEmitter<string>();
  @Output() resend = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  otp = ['', '', '', '', '', ''];
  error = '';
  verifying = false;
  resending = false;
  countdown = 60;
  canResend = false;
  private countdownInterval?: number;

  ngOnInit() {
    if (this.show) {
      this.startCountdown();
    }
  }

  ngOnChanges() {
    if (this.show && !this.countdownInterval) {
      this.startCountdown();
    }
  }

  ngOnDestroy() {
    this.clearCountdown();
  }

  onInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Only allow single digit
    if (value.length > 1) {
      input.value = value.charAt(0);
      this.otp[index] = value.charAt(0);
    } else {
      this.otp[index] = value;
    }

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }

    this.error = '';
  }

  onKeyDown(index: number, event: KeyboardEvent) {
    // Handle backspace to move to previous input
    if (event.key === 'Backspace' && !this.otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      prevInput?.focus();
    }

    // Handle paste
    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      navigator.clipboard.readText().then((text) => {
        this.handlePaste(text, index);
      });
    }
  }

  onPaste(index: number, event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    this.handlePaste(pastedText, index);
  }

  private handlePaste(text: string, startIndex: number) {
    const digits = text.replace(/\D/g, '').split('');
    
    for (let i = 0; i < digits.length && (startIndex + i) < 6; i++) {
      this.otp[startIndex + i] = digits[i];
      const input = document.getElementById(`otp-${startIndex + i}`) as HTMLInputElement;
      if (input) input.value = digits[i];
    }

    // Focus last filled input or next empty one
    const lastIndex = Math.min(startIndex + digits.length, 5);
    const input = document.getElementById(`otp-${lastIndex}`) as HTMLInputElement;
    input?.focus();

    this.error = '';
  }

  async onVerify() {
    const code = this.otp.join('');
    
    if (code.length !== 6) {
      this.error = 'Please enter the complete 6-digit code';
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      this.error = 'OTP must contain only numbers';
      return;
    }

    this.verifying = true;
    this.error = '';
    this.verify.emit(code);
  }

  async onResend() {
    this.resending = true;
    this.error = '';
    this.otp = ['', '', '', '', '', ''];
    
    // Clear all inputs
    for (let i = 0; i < 6; i++) {
      const input = document.getElementById(`otp-${i}`) as HTMLInputElement;
      if (input) input.value = '';
    }

    this.resend.emit();
    
    // Reset countdown
    this.countdown = 60;
    this.canResend = false;
    this.startCountdown();

    setTimeout(() => {
      this.resending = false;
    }, 1000);
  }

  onClose() {
    this.clearCountdown();
    this.close.emit();
  }

  private startCountdown() {
    this.clearCountdown();
    this.canResend = false;
    this.countdown = 60;

    this.countdownInterval = window.setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.canResend = true;
        this.clearCountdown();
      }
    }, 1000);
  }

  private clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }

  resetVerifying() {
    this.verifying = false;
  }

  setError(message: string) {
    this.error = message;
    this.verifying = false;
  }
}

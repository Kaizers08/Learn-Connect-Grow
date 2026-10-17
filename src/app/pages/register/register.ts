import { Component, OnInit, inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { OtpModalComponent } from '../../components/otp-modal/otp-modal.component';

const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, OtpModalComponent],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent implements OnInit {
  @ViewChild(OtpModalComponent) otpModal?: OtpModalComponent;
  
  firstName = '';
  middleName = '';
  lastName = '';
  email = '';
  password = '';
  showPassword = false;
  agree = false;
  emailError = '';
  passwordError = '';
  nameError = '';
  /** Only true on /register?step=name after Google signup. */
  googleNameStep = false;
  loading = false;

  // OTP state
  showOtpModal = false;
  pendingSignupData: { email: string; password: string; fullName: string } | null = null;

  showPrivacyModal = false;
  showTermsModal = false;

  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Name-only UI ONLY when URL has step=name (set after Google OAuth)
    if (this.route.snapshot.queryParamMap.get('step') !== 'name') {
      this.googleNameStep = false;
      return;
    }

    await this.supabase.ensureAuthReady();
    const { data: { session } } = await this.supabase.getClient().auth.getSession();
    if (!session) {
      // No Google session — do not keep name-only URL
      await this.router.navigate(['/register'], { replaceUrl: true });
      return;
    }

    const meta = await this.supabase.getCurrentUserMeta();
    if (meta.nameCollected) {
      const target = await this.supabase.resolvePostAuthPath();
      await this.router.navigateByUrl(target, { replaceUrl: true });
      return;
    }

    this.googleNameStep = true;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  private buildFullName(): string {
    return [this.firstName, this.middleName, this.lastName]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' ');
  }

  private validateEmail(email: string): string | null {
    if (!VALID_EMAIL.test(email.trim())) {
      return 'Please enter a valid email address (must include @ and a domain).';
    }
    return null;
  }

  private validatePassword(password: string): string | null {
    if (!STRONG_PASSWORD.test(password)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.';
    }
    return null;
  }

  async onSignUp() {
    if (this.googleNameStep) {
      await this.onContinueGoogleNames();
      return;
    }

    this.emailError = '';
    this.passwordError = '';

    if (!this.firstName.trim() || !this.lastName.trim() || !this.email.trim() || !this.password) {
      alert('Please fill in all required fields.');
      return;
    }

    if (!this.agree) {
      alert('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    const emailIssue = this.validateEmail(this.email);
    if (emailIssue) {
      this.emailError = emailIssue;
      return;
    }

    const passwordIssue = this.validatePassword(this.password);
    if (passwordIssue) {
      this.passwordError = passwordIssue;
      return;
    }

    // Store signup data and send OTP
    this.loading = true;
    this.pendingSignupData = {
      email: this.email.trim(),
      password: this.password,
      fullName: this.buildFullName()
    };

    try {
      await this.sendOtp();
      this.showOtpModal = true;
    } catch (error: any) {
      alert(error.message || 'Failed to send verification code. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  async sendOtp() {
    if (!this.pendingSignupData) {
      this.pendingSignupData = {
        email: this.email.trim(),
        password: this.password,
        fullName: this.buildFullName()
      };
    }

    const { data, error } = await this.supabase.getClient().functions.invoke('send-otp-email', {
      body: {
        email: this.pendingSignupData.email,
        name: this.pendingSignupData.fullName
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to send OTP');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to send OTP');
    }
  }

  async onVerifyOtp(otp: string) {
    if (!this.pendingSignupData) {
      this.otpModal?.setError('Session expired. Please try again.');
      return;
    }

    try {
      // Verify OTP
      const { data, error } = await this.supabase.getClient().functions.invoke('verify-otp', {
        body: {
          email: this.pendingSignupData.email,
          otp: otp
        }
      });

      if (error || !data?.success) {
        this.otpModal?.setError(data?.error || error?.message || 'Invalid verification code');
        return;
      }

      // OTP verified, now create the account
      const { error: signupError } = await this.supabase.signUp(
        this.pendingSignupData.email,
        this.pendingSignupData.password,
        this.pendingSignupData.fullName
      );

      if (signupError) {
        console.error('Sign up failed:', signupError.message);
        this.otpModal?.setError(signupError.message);
        return;
      }

      // Success!
      this.showOtpModal = false;
      this.pendingSignupData = null;
      this.router.navigate(['/complete-profile'], { replaceUrl: true });

    } catch (error: any) {
      console.error('Verification error:', error);
      this.otpModal?.setError('Verification failed. Please try again.');
    }
  }

  async onResendOtp() {
    if (!this.pendingSignupData) {
      return;
    }

    try {
      await this.sendOtp();
    } catch (error: any) {
      this.otpModal?.setError(error.message || 'Failed to resend code');
    }
  }

  onCloseOtpModal() {
    this.showOtpModal = false;
    this.otpModal?.resetVerifying();
  }

  async onContinueGoogleNames() {
    this.nameError = '';

    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.nameError = 'Please enter your first and last name. Middle name is optional.';
      return;
    }

    if (!this.agree) {
      alert('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    this.loading = true;
    const { error } = await this.supabase.updateUserMeta({
      full_name: this.buildFullName(),
      name_collected: true
    });
    this.loading = false;

    if (error) {
      alert(error.message || 'Could not save your name. Please try again.');
      return;
    }

    this.router.navigate(['/complete-profile'], { replaceUrl: true });
  }

  async onGoogleSignUp() {
    const { error } = await this.supabase.signInWithGoogle();
    if (error) {
      console.error('Google sign up failed:', error.message);
      alert(error.message);
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}

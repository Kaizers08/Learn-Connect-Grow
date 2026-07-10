import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-journey',
  imports: [CommonModule, FormsModule],
  templateUrl: './journey.html',
  styleUrls: ['./journey.css']
})
export class JourneyComponent {
  profilePhoto: string | null = null;  // preview URL (object URL)
  profileFile: File | null = null;     // actual File for upload
  dateOfBirth: string = '';
  country: string = '';
  phoneNumber: string = '';
  gender: string = '';
  selectedDialCode: string = '';

  countries = [
    { name: 'Afghanistan', code: '+93' },
    { name: 'Albania', code: '+355' },
    { name: 'Algeria', code: '+213' },
    { name: 'Argentina', code: '+54' },
    { name: 'Australia', code: '+61' },
    { name: 'Austria', code: '+43' },
    { name: 'Bangladesh', code: '+880' },
    { name: 'Belgium', code: '+32' },
    { name: 'Bolivia', code: '+591' },
    { name: 'Brazil', code: '+55' },
    { name: 'Cambodia', code: '+855' },
    { name: 'Canada', code: '+1' },
    { name: 'Chile', code: '+56' },
    { name: 'China', code: '+86' },
    { name: 'Colombia', code: '+57' },
    { name: 'Croatia', code: '+385' },
    { name: 'Czech Republic', code: '+420' },
    { name: 'Denmark', code: '+45' },
    { name: 'Ecuador', code: '+593' },
    { name: 'Egypt', code: '+20' },
    { name: 'Ethiopia', code: '+251' },
    { name: 'Finland', code: '+358' },
    { name: 'France', code: '+33' },
    { name: 'Germany', code: '+49' },
    { name: 'Ghana', code: '+233' },
    { name: 'Greece', code: '+30' },
    { name: 'Guatemala', code: '+502' },
    { name: 'Honduras', code: '+504' },
    { name: 'Hungary', code: '+36' },
    { name: 'India', code: '+91' },
    { name: 'Indonesia', code: '+62' },
    { name: 'Iran', code: '+98' },
    { name: 'Iraq', code: '+964' },
    { name: 'Ireland', code: '+353' },
    { name: 'Israel', code: '+972' },
    { name: 'Italy', code: '+39' },
    { name: 'Japan', code: '+81' },
    { name: 'Jordan', code: '+962' },
    { name: 'Kenya', code: '+254' },
    { name: 'Kuwait', code: '+965' },
    { name: 'Malaysia', code: '+60' },
    { name: 'Mexico', code: '+52' },
    { name: 'Morocco', code: '+212' },
    { name: 'Myanmar', code: '+95' },
    { name: 'Nepal', code: '+977' },
    { name: 'Netherlands', code: '+31' },
    { name: 'New Zealand', code: '+64' },
    { name: 'Nigeria', code: '+234' },
    { name: 'Norway', code: '+47' },
    { name: 'Pakistan', code: '+92' },
    { name: 'Panama', code: '+507' },
    { name: 'Paraguay', code: '+595' },
    { name: 'Peru', code: '+51' },
    { name: 'Philippines', code: '+63' },
    { name: 'Poland', code: '+48' },
    { name: 'Portugal', code: '+351' },
    { name: 'Qatar', code: '+974' },
    { name: 'Romania', code: '+40' },
    { name: 'Russia', code: '+7' },
    { name: 'Saudi Arabia', code: '+966' },
    { name: 'Singapore', code: '+65' },
    { name: 'South Africa', code: '+27' },
    { name: 'South Korea', code: '+82' },
    { name: 'Spain', code: '+34' },
    { name: 'Sri Lanka', code: '+94' },
    { name: 'Sweden', code: '+46' },
    { name: 'Switzerland', code: '+41' },
    { name: 'Taiwan', code: '+886' },
    { name: 'Thailand', code: '+66' },
    { name: 'Turkey', code: '+90' },
    { name: 'Ukraine', code: '+380' },
    { name: 'United Arab Emirates', code: '+971' },
    { name: 'United Kingdom', code: '+44' },
    { name: 'United States', code: '+1' },
    { name: 'Uruguay', code: '+598' },
    { name: 'Venezuela', code: '+58' },
    { name: 'Vietnam', code: '+84' },
    { name: 'Yemen', code: '+967' },
    { name: 'Zimbabwe', code: '+263' }
  ];

  get dialCodes(): string[] {
    // unique codes sorted
    return [...new Set(this.countries.map(c => c.code))].sort();
  }

  onCountryChange() {
    const found = this.countries.find(c => c.name === this.country);
    if (found) {
      this.selectedDialCode = found.code;
    }
  }

  constructor(private router: Router, private userService: UserService, private supabase: SupabaseService) {}

  onPhotoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.profileFile = file;
      // Show preview using object URL (no base64 needed)
      this.profilePhoto = URL.createObjectURL(file);
    }
  }

  removePhoto() {
    if (this.profilePhoto) URL.revokeObjectURL(this.profilePhoto);
    this.profilePhoto = null;
    this.profileFile = null;
  }

  async onNext() {
    if (!this.phoneNumber.trim()) {
      alert('Phone number is required.');
      return;
    }

    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;

    const role = this.userService.role();
    const fullPhone = this.selectedDialCode
      ? `${this.selectedDialCode} ${this.phoneNumber}`
      : this.phoneNumber;

    // Upload photo to Supabase Storage if a file was selected
    let pictureUrl: string | null = null;
    if (this.profileFile) {
      pictureUrl = await this.supabase.uploadProfilePicture(userId, this.profileFile);
    }

    if (role === 'mentor') {
      await this.supabase.getClient()
        .from('mentor_profiles')
        .update({
          ...(pictureUrl ? { profile_picture: pictureUrl } : {}),
          phone_number:  fullPhone,
          country:       this.country     || null,
          gender:        this.gender      || null,
          date_of_birth: this.dateOfBirth || null,
        })
        .eq('user_id', userId);
    } else {
      await this.supabase.getClient()
        .from('mentee_profiles')
        .upsert({
          user_id:       userId,
          ...(pictureUrl ? { profile_picture: pictureUrl } : {}),
          phone_number:  fullPhone,
          country:       this.country     || null,
          gender:        this.gender      || null,
          date_of_birth: this.dateOfBirth || null,
        });
    }

    this.router.navigate(['/dashboard']);
  }
}

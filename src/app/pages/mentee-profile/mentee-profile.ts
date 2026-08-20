import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { PhoneLimitsService } from '../../services/phone-limits.service';

@Component({
  selector: 'app-mentee-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './mentee-profile.html',
  styleUrls: ['./mentee-profile.css']
})
export class MenteeProfileComponent implements OnInit {
  selectedType: string = 'student';
  fullName: string = '';
  university: string = '';
  jobPosition: string = '';
  company: string = '';
  lookingForJob: string = 'no';

  phoneNumber: string = '';
  gender: string = '';
  country: string = '';
  dateOfBirth: string = '';

  profilePhoto: string | null = null;  // preview URL
  profileFile: File | null = null;     // actual file for upload

  desiredExpertise: string = '';
  desiredSkills: string[] = [];
  skillInput = '';
  showErrors = false;
  
  types = [
    { value: 'student', label: 'Student' },
    { value: 'working-professional', label: 'Working professional' },
    { value: 'entrepreneur', label: 'Entrepreneur' },
    { value: 'unemployed', label: 'Unemployed' },
    { value: 'fresh-graduate', label: 'Fresh graduate' }
  ];

  expertiseOptions = [
    'UI/UX Design',
    'Fullstack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Mobile Developer',
    'DevOps / Cloud',
    'Data Science',
    'Machine Learning / AI',
    'Cybersecurity',
    'Blockchain',
    'Game Development',
    'QA / Testing',
    'Project Management',
    'Product Management',
    'Business Analysis',
    'Digital Marketing',
    'Graphic Design',
    'Content Writing',
    'Video Editing',
    'Photography'
  ];

  skillOptions = [
    'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'InDesign',
    'Canva', 'Webflow', 'Framer',
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue.js',
    'Next.js', 'Nuxt.js', 'Tailwind CSS', 'Bootstrap', 'SASS',
    'Node.js', 'Express.js', 'Python', 'Django', 'FastAPI', 'PHP', 'Laravel',
    'Java', 'Spring Boot', 'C#', '.NET', 'Ruby on Rails', 'Go', 'Rust',
    'Flutter', 'React Native', 'Swift', 'Kotlin', 'Dart',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'Redis', 'Supabase',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'CI/CD',
    'Linux', 'Nginx', 'GitHub Actions',
    'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn',
    'Tableau', 'Power BI', 'SQL',
    'Git', 'GitHub', 'Jira', 'Notion', 'Trello', 'WordPress', 'Shopify'
  ];

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    public phoneLimits: PhoneLimitsService
  ) {}

  get phoneMaxLength(): number {
    return this.phoneLimits.getLimits(this.country).max;
  }

  get phoneHint(): string {
    return this.phoneLimits.getHint(this.country);
  }

  async ngOnInit() {
    // Get full_name from auth metadata (from registration)
    const meta = await this.supabase.getCurrentUserMeta();
    if (meta.fullName) this.fullName = meta.fullName;
  }

  get isStudent(): boolean {
    return this.selectedType === 'student';
  }

  get isWorkingOrEntrepreneur(): boolean {
    return this.selectedType === 'working-professional' || this.selectedType === 'entrepreneur';
  }

  get isUnemployedOrFreshGrad(): boolean {
    return this.selectedType === 'unemployed' || this.selectedType === 'fresh-graduate';
  }

  addSkill() {
    const s = this.skillInput.trim();
    if (s && !this.desiredSkills.includes(s)) this.desiredSkills.push(s);
    this.skillInput = '';
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let cleaned = input.value.replace(/[^0-9\s]/g, '');
    // Enforce max digits for selected country
    const max = this.phoneLimits.getLimits(this.country).max;
    const digits = cleaned.replace(/\s/g, '');
    if (digits.length > max) {
      let count = 0;
      cleaned = cleaned.split('').filter(ch => {
        if (ch === ' ') return true;
        return count++ < max;
      }).join('');
    }
    this.phoneNumber = cleaned;
    input.value = cleaned;
  }

  toggleSkill(skill: string) {
    if (this.desiredSkills.includes(skill)) {
      this.desiredSkills = this.desiredSkills.filter(s => s !== skill);
    } else {
      this.desiredSkills.push(skill);
    }
  }

  onPhotoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.profileFile = file;
    this.profilePhoto = URL.createObjectURL(file);
  }

  removePhoto() {
    if (this.profilePhoto) URL.revokeObjectURL(this.profilePhoto);
    this.profilePhoto = null;
    this.profileFile = null;
  }

  async onPrevious() {
    this.router.navigate(['/complete-profile']);
  }

  async onNext() {
    this.showErrors = true;

    // Required fields
    if (!this.profilePhoto) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!this.desiredExpertise) {
      alert('Please select an area of expertise you want to learn.');
      return;
    }
    if (!this.desiredSkills.length) {
      alert('Please select at least one technical skill you want to learn.');
      return;
    }

    // Validate phone digit count against selected country (optional field)
    if (this.phoneNumber.trim()) {
      const digits = this.phoneLimits.countDigits(this.phoneNumber);
      const { min, max } = this.phoneLimits.getLimits(this.country);
      if (digits < min || digits > max) {
        alert(this.country
          ? `Phone number for ${this.country} must be ${min === max ? min + ' digits' : min + '–' + max + ' digits'}.`
          : `Phone number must be between ${min} and ${max} digits.`);
        return;
      }
    }

    const userId = await this.supabase.getCurrentUserId();

    // Upload profile picture to Storage
    let pictureUrl: string | undefined = undefined;
    if (this.profileFile) {
      const url = await this.supabase.uploadProfilePicture(userId!, this.profileFile);
      if (url) pictureUrl = url;
    }

    const { error } = await this.supabase.saveMenteeProfile({
      user_id: userId,
      full_name: this.fullName || undefined,
      type: this.selectedType,
      university: this.university || undefined,
      job_position: this.jobPosition || undefined,
      company: this.company || undefined,
      looking_for_job: this.lookingForJob,
      desired_expertise: this.desiredExpertise || undefined,
      desired_skills: this.desiredSkills.length ? this.desiredSkills : undefined,
      profile_picture: pictureUrl,
      phone_number: this.phoneNumber || undefined,
      gender: this.gender || undefined,
      country: this.country || undefined,
      date_of_birth: this.dateOfBirth || undefined,
    });

    if (error) {
      console.error('Failed to save mentee profile:', error);
    }

    this.router.navigate(['/journey']);
  }
}

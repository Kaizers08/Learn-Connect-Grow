import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-mentor-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './mentor-profile.html',
  styleUrls: ['./mentor-profile.css']
})
export class MentorProfileComponent implements OnInit {
  fullName = '';
  jobPosition = '';
  company = '';
  expertise = '';
  yearsExperience: number | null = null;
  bio = '';
  profilePhoto: string | null = null;
  phoneNumber = '';
  githubUrl = '';
  linkedinUrl = '';
  twitterUrl = '';
  errorMsg = '';

  skills: string[] = [];
  skillInput = '';

  expertiseOptions = [
    'UI/UX Design', 'Fullstack Developer', 'Frontend Developer', 'Backend Developer',
    'Mobile Developer', 'DevOps / Cloud', 'Data Science', 'Machine Learning / AI',
    'Cybersecurity', 'Blockchain', 'Game Development', 'QA / Testing',
    'Project Management', 'Product Management', 'Business Analysis',
    'Digital Marketing', 'Graphic Design', 'Content Writing', 'Video Editing', 'Photography'
  ];

  skillOptions = [
    'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'InDesign', 'Canva', 'Webflow', 'Framer',
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue.js', 'Next.js', 'Nuxt.js', 'Tailwind CSS', 'Bootstrap', 'SASS',
    'Node.js', 'Express.js', 'Python', 'Django', 'FastAPI', 'PHP', 'Laravel', 'Java', 'Spring Boot', 'C#', '.NET', 'Ruby on Rails', 'Go', 'Rust',
    'Flutter', 'React Native', 'Swift', 'Kotlin', 'Dart',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'Redis', 'Supabase',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'CI/CD', 'Linux', 'Nginx', 'GitHub Actions',
    'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn', 'Tableau', 'Power BI', 'SQL',
    'Git', 'GitHub', 'Jira', 'Notion', 'Trello', 'WordPress', 'Shopify'
  ];

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    const meta = await this.supabase.getCurrentUserMeta();
    if (meta.fullName) this.fullName = meta.fullName;
  }

  onPhotoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.profilePhoto = reader.result as string; };
    reader.readAsDataURL(file);
  }

  removePhoto() { this.profilePhoto = null; }

  addSkill() {
    const s = this.skillInput.trim();
    if (s && !this.skills.includes(s)) this.skills.push(s);
    this.skillInput = '';
  }

  toggleSkill(skill: string) {
    if (this.skills.includes(skill)) this.skills = this.skills.filter(s => s !== skill);
    else this.skills.push(skill);
  }

  async onPrevious() { this.router.navigate(['/complete-profile']); }

  async onNext() {
    this.errorMsg = '';

    // Required field validation
    if (!this.expertise) { this.errorMsg = 'Area of Expertise is required.'; return; }
    if (!this.skills.length) { this.errorMsg = 'Please add at least one technical skill.'; return; }
    if (this.yearsExperience === null || this.yearsExperience === undefined) { this.errorMsg = 'Years of Experience is required.'; return; }
    if (!this.phoneNumber.trim()) { this.errorMsg = 'Phone number is required.'; return; }

    const userId = await this.supabase.getCurrentUserId();
    const { error } = await this.supabase.saveMentorProfile({
      user_id: userId,
      full_name:        this.fullName        || undefined,
      job_position:     this.jobPosition     || undefined,
      company:          this.company         || undefined,
      expertise:        this.expertise,
      years_experience: this.yearsExperience,
      bio:              this.bio             || undefined,
      profile_picture:  this.profilePhoto    ?? undefined,
      skills:           this.skills,
      phone_number:     this.phoneNumber     || undefined,
      github_url:       this.githubUrl       || undefined,
      linkedin_url:     this.linkedinUrl     || undefined,
      twitter_url:      this.twitterUrl      || undefined,
    });

    if (error) {
      console.error('Failed to save mentor profile:', error);
      this.errorMsg = 'Failed to save profile. Please try again.';
      return;
    }

    this.router.navigate(['/mentor-documents']);
  }
}

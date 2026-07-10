import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

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

  desiredExpertise: string = '';
  desiredSkills: string[] = [];
  skillInput = '';
  
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
    private supabase: SupabaseService
  ) {}

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

  toggleSkill(skill: string) {
    if (this.desiredSkills.includes(skill)) {
      this.desiredSkills = this.desiredSkills.filter(s => s !== skill);
    } else {
      this.desiredSkills.push(skill);
    }
  }

  async onPrevious() {
    this.router.navigate(['/complete-profile']);
  }

  async onNext() {
    // Required fields
    if (!this.desiredExpertise) {
      alert('Please select an area of expertise you want to learn.');
      return;
    }
    if (!this.desiredSkills.length) {
      alert('Please select at least one technical skill you want to learn.');
      return;
    }

    const userId = await this.supabase.getCurrentUserId();

    const { error } = await this.supabase.saveMenteeProfile({
      user_id: userId,
      full_name: this.fullName || undefined,
      type: this.selectedType,
      university: this.university || undefined,
      job_position: this.jobPosition || undefined,
      company: this.company || undefined,
      looking_for_job: this.lookingForJob,
      desired_expertise: this.desiredExpertise || undefined,
      desired_skills: this.desiredSkills.length ? this.desiredSkills : undefined
    });

    if (error) {
      console.error('Failed to save mentee profile:', error);
    }

    this.router.navigate(['/journey']);
  }
}

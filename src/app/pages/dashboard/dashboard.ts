import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {

  userName = 'Jaireell';
  userRole = 'Mentee';

  upcomingSessionsCount = 2;
  unreadMessages = 0;

  activeNavItem = 'dashboard';

  recommendedMentors = [
    { name: 'Emily Johnson', specialty: 'UI/UX', rating: 4.9, reviews: 32 },
    { name: 'Peter Parker', specialty: 'Fullstack Developer', rating: 4.9, reviews: 32 },
    { name: 'Julian Hernandez', specialty: 'DevOps', rating: 4.9, reviews: 32 }
  ];

  upcomingSessions = [
    {
      mentorName: 'Manilyn Jones',
      isActive: true,
      date: 'December 3, 2025',
      time: '4:00PM – 10:00PM',
      platform: 'Google Meet'
    }
  ];

  onlineMentors = [
    { name: 'Jaireell Son Regala', status: 'Active Now', isOnline: true },
    { name: 'Jaireell Son Regala', status: 'Active Now', isOnline: true },
    { name: 'Luisita Reyes Marie', status: 'Active 2mins', isOnline: false }
  ];

  searchQuery = '';

  // ── Find Mentors ──────────────────────────────────────────────────────────
  mentorSearchQuery = '';
  selectedExpertise = '';
  selectedSkills: string[] = ['Figma', 'Photoshop', 'Wordpress', 'Webflow'];
  expertiseLevels: string[] = [];
  currentPage = 1;
  totalPages = 4;

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
    // Design
    'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'InDesign',
    'Canva', 'Webflow', 'Framer',
    // Frontend
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue.js',
    'Next.js', 'Nuxt.js', 'Tailwind CSS', 'Bootstrap', 'SASS',
    // Backend
    'Node.js', 'Express.js', 'Python', 'Django', 'FastAPI', 'PHP', 'Laravel',
    'Java', 'Spring Boot', 'C#', '.NET', 'Ruby on Rails', 'Go', 'Rust',
    // Mobile
    'Flutter', 'React Native', 'Swift', 'Kotlin', 'Dart',
    // Database
    'MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'Redis', 'Supabase',
    // DevOps / Cloud
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'CI/CD',
    'Linux', 'Nginx', 'GitHub Actions',
    // Data / AI
    'Python', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn',
    'Tableau', 'Power BI', 'SQL',
    // Other
    'Git', 'GitHub', 'Jira', 'Notion', 'Trello', 'WordPress', 'Shopify'
  ];
  levelOptions = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];

  allMentors = [
    {
      name: 'Julian Hernandez',
      role: 'UI/UX Designer',
      rating: 4.9,
      reviews: 32,
      bio: '5yrs of experience building ui friendly application',
      skills: ['Figma', 'Webflow', 'Photoshop', 'Wordpress']
    },
    {
      name: 'Janine Hernandez',
      role: 'UI/UX Designer',
      rating: 2.9,
      reviews: 3,
      bio: '5yrs of experience building ui friendly application',
      skills: ['Figma', 'Webflow', 'Photoshop', 'Wordpress']
    },
    {
      name: 'Michael Jackson',
      role: 'UI/UX Designer',
      rating: 3.9,
      reviews: 3,
      bio: '5yrs of experience building ui friendly application',
      skills: ['Figma', 'Webflow', 'Photoshop', 'Wordpress']
    }
  ];

  get filteredMentors() {
    return this.allMentors.filter(m => {
      const matchName = !this.mentorSearchQuery ||
        m.name.toLowerCase().includes(this.mentorSearchQuery.toLowerCase());
      const matchExpertise = !this.selectedExpertise ||
        m.role.toLowerCase().includes(this.selectedExpertise.toLowerCase());
      return matchName && matchExpertise;
    });
  }

  removeSkill(skill: string) {
    this.selectedSkills = this.selectedSkills.filter(s => s !== skill);
  }

  toggleLevel(level: string) {
    if (this.expertiseLevels.includes(level)) {
      this.expertiseLevels = this.expertiseLevels.filter(l => l !== level);
    } else {
      this.expertiseLevels.push(level);
    }
  }

  resetFilters() {
    this.mentorSearchQuery = '';
    this.selectedExpertise = '';
    this.selectedSkills = [];
    this.expertiseLevels = [];
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
  // ─────────────────────────────────────────────────────────────────────────

  constructor(private router: Router) {}

  setActiveNav(id: string) {
    this.activeNavItem = id;
  }

  onConnect(mentor: any) {}
  onViewProfile(mentor: any) {}
  onViewAllSessions() {}
  onViewAllOnline() {}
  onMessage(mentor: any) {}

  onLogout() {
    this.router.navigate(['/login']);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}

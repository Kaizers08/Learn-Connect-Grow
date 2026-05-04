import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  constructor(private router: Router) {}

  goToLogin() {
    this.router.navigate(['/login']);
  }

  features = [
    {
      image: 'feedback-mentorship',
      title: 'Feedback Mentorship',
      description: 'Receive expert feedback tailored to your goals.'
    },
    {
      image: 'expert-mentorship',
      title: 'Expert Mentorship',
      description: 'Learn from industry leading mentors.'
    },
    {
      image: 'progress-tracking',
      title: 'Progress Tracking',
      description: 'Learn from the best in the industry.'
    }
  ];

  services = [
    { icon: 'message', title: 'Personalized Mentorship' },
    { icon: 'video',   title: 'Live Sessions' },
    { icon: 'chart',   title: 'Track Progress' }
  ];

  benefits = [
    {
      icon: 'expert',
      title: 'Expert Mentors',
      description: 'Learn from the best in the industry'
    },
    {
      icon: 'projects',
      title: 'Real-World Projects',
      description: 'Build real-world projects and boost your portfolio'
    },
    {
      icon: 'community',
      title: 'Community & Networking',
      description: 'Join a large network of learners and professionals'
    }
  ];
}

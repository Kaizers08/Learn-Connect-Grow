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
  userAvatar = '/assets/avatars/user.jpg';

  upcomingSessionsCount = 2;
  unreadMessages = 0;

  activeNavItem = 'dashboard';

  navItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'search', icon: 'search', label: 'Search' },
    { id: 'calendar', icon: 'calendar', label: 'Calendar' },
    { id: 'messages', icon: 'messages', label: 'Messages' },
    { id: 'library', icon: 'library', label: 'Library' },
    { id: 'mentors', icon: 'mentors', label: 'Mentors' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  recommendedMentors = [
    {
      name: 'Emily Johnson',
      specialty: 'UI/UX',
      rating: 4.9,
      reviews: 32,
      avatar: '/assets/mentors/emily.jpg'
    },
    {
      name: 'Peter Parker',
      specialty: 'Fullstack Developer',
      rating: 4.9,
      reviews: 32,
      avatar: '/assets/mentors/peter.jpg'
    },
    {
      name: 'Julian Hernandez',
      specialty: 'DevOps',
      rating: 4.9,
      reviews: 32,
      avatar: '/assets/mentors/julian.jpg'
    }
  ];

  upcomingSessions = [
    {
      mentorName: 'Manilyn Jones',
      mentorAvatar: '/assets/mentors/manilyn.jpg',
      isActive: true,
      date: 'December 3, 2025',
      time: '4:00PM – 10:00PM',
      platform: 'Google Meet'
    }
  ];

  onlineMentors = [
    {
      name: 'Jaireell Son Regala',
      status: 'Active Now',
      avatar: '/assets/mentors/user1.jpg',
      isOnline: true
    },
    {
      name: 'Jaireell Son Regala',
      status: 'Active Now',
      avatar: '/assets/mentors/user2.jpg',
      isOnline: true
    },
    {
      name: 'Luisita Reyes Marie',
      status: 'Active 2mins',
      avatar: '/assets/mentors/user3.jpg',
      isOnline: false
    }
  ];

  searchQuery = '';

  constructor(private router: Router) {}

  setActiveNav(id: string) {
    this.activeNavItem = id;
  }

  onConnect(mentor: any) {
    // handle connect action
    console.log('Connect with', mentor.name);
  }

  onViewProfile(mentor: any) {
    // navigate to mentor profile
    console.log('View profile', mentor.name);
  }

  onViewAllSessions() {
    // navigate to sessions page
  }

  onViewAllOnline() {
    // navigate to online mentors
  }

  onMessage(mentor: any) {
    // open messages with mentor
    console.log('Message', mentor.name);
  }

  onLogout() {
    this.router.navigate(['/login']);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
}

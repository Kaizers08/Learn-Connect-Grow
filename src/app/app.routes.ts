import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'complete-profile',
    loadComponent: () => import('./pages/complete-profile/complete-profile').then(m => m.CompleteProfileComponent)
  },
  {
    path: 'mentee-profile',
    loadComponent: () => import('./pages/mentee-profile/mentee-profile').then(m => m.MenteeProfileComponent)
  },
  {
    path: 'mentor-profile',
    loadComponent: () => import('./pages/mentor-profile/mentor-profile').then(m => m.MentorProfileComponent)
  },
  {
    path: 'mentor-documents',
    loadComponent: () => import('./pages/mentor-documents/mentor-documents').then(m => m.MentorDocumentsComponent)
  },
  {
    path: 'mentor/:id',
    loadComponent: () => import('./pages/profile-view/profile-view').then(m => m.ProfileViewComponent)
  },
  {
    path: 'mentee/:id',
    loadComponent: () => import('./pages/profile-view/profile-view').then(m => m.ProfileViewComponent)
  },
  {
    path: 'journey',
    loadComponent: () => import('./pages/journey/journey').then(m => m.JourneyComponent)
  },
  {
    path: 'pending-approval',
    loadComponent: () => import('./pages/pending-approval/pending-approval').then(m => m.PendingApprovalComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

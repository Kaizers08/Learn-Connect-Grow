import { Routes } from '@angular/router';

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
    path: 'journey',
    loadComponent: () => import('./pages/journey/journey').then(m => m.JourneyComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mentee-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './mentee-profile.html',
  styleUrls: ['./mentee-profile.css']
})
export class MenteeProfileComponent {
  selectedType: string = 'student';
  university: string = '';
  jobPosition: string = '';
  company: string = '';
  lookingForJob: string = 'no';

  types = [
    { value: 'student', label: 'Student' },
    { value: 'working-professional', label: 'Working professional' },
    { value: 'entrepreneur', label: 'Entrepreneur' },
    { value: 'unemployed', label: 'Unemployed' },
    { value: 'fresh-graduate', label: 'Fresh graduate' }
  ];

  constructor(private router: Router) {}

  get isStudent(): boolean {
    return this.selectedType === 'student';
  }

  get isWorkingOrEntrepreneur(): boolean {
    return this.selectedType === 'working-professional' || this.selectedType === 'entrepreneur';
  }

  get isUnemployedOrFreshGrad(): boolean {
    return this.selectedType === 'unemployed' || this.selectedType === 'fresh-graduate';
  }

  onPrevious() {
    this.router.navigate(['/complete-profile']);
  }

  onNext() {
    this.router.navigate(['/journey']);
  }
}

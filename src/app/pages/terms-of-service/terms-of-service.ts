import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-terms-of-service',
  imports: [CommonModule],
  templateUrl: './terms-of-service.html',
  styleUrls: ['./terms-of-service.css']
})
export class TermsOfServiceComponent {
  constructor(private router: Router) {}
  goBack() { window.close(); }
}

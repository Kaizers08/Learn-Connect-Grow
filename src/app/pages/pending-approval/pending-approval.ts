import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-pending-approval',
  imports: [CommonModule],
  templateUrl: './pending-approval.html',
  styleUrls: ['./pending-approval.css']
})
export class PendingApprovalComponent {
  constructor(private router: Router, private supabase: SupabaseService) {}

  async onLogout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {

  // ─── General ───────────────────────────────────────────────────────────────
  userName = '';
  userRole = 'Mentee';
  showUserMenu = false;
  profilePicture: string | null = null;
  currentUserId = '';
  private lastSeenInterval: any;
  isLoading = true;

  get isMentor(): boolean { return this.userService.role() === 'mentor'; }

  upcomingSessionsCount = 2;
  unreadMessages = 0;
  activeNavItem = 'dashboard';

  // Matched mentors/mentees from DB
  recommendedMentors: any[] = [];
  // My connections (online side panel)
  connectedUsers: any[] = [];
  // Which user IDs I'm connected to
  myConnectionIds = new Set<string>();

  // Profile modal
  showProfileModal = false;
  selectedProfile: any = null;

  upcomingSessions = [
    { mentorName: 'Manilyn Jones', isActive: true, date: 'December 3, 2025', time: '4:00PM – 10:00PM', platform: 'Google Meet' }
  ];

  searchQuery = '';

  // ─── Settings Properties ───────────────────────────────────────────────────
  settingsFirstName = '';
  settingsLastName = '';
  settingsEmail = '';
  settingsJobPosition = '';
  settingsCompany = '';
  settingsExpertise = '';
  settingsYearsExperience: number | null = null;
  settingsBio = '';
  settingsTechnicalSkills: string[] = [];
  settingsPhone = '';
  settingsCountry = '';
  settingsGender = '';
  settingsDateOfBirth = '';
  settingsTab = 'profile';
  settingsSaved = false;
  settingsPhotoFile: File | null = null;
  settingsPhotoPreview: string | null = null;
  
  // Mentee specific settings
  settingsMenteeType = '';
  settingsUniversity = '';
  settingsMenteeJobPosition = '';
  settingsMenteeCompany = '';
  settingsLookingForJob = 'no';
  settingsDesiredExpertise = '';
  settingsDesiredSkills: string[] = [];
  
  // Password settings
  passwordError = '';
  settingsCurrentPassword = '';
  settingsNewPassword = '';
  settingsConfirmPassword = '';
  showCurrentPass = false;
  showNewPass = false;
  showConfirmPass = false;
  
  // Delete account
  showDeleteConfirm = false;
  deleteAccountPassword = '';
  isDeleting = false;

  // ─── Find Mentors ──────────────────────────────────────────────────────────
  mentorSearchQuery = '';
  selectedExpertise = '';
  selectedSkills: string[] = [];
  expertiseLevels: string[] = [];
  currentPage = 1;
  totalPages = 4;

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

  levelOptions = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];

  allMentors = [
    { name: 'Julian Hernandez', role: 'UI/UX Designer', rating: 0, reviews: 0, bio: '5yrs of experience building ui friendly application', skills: ['Figma', 'Webflow', 'Photoshop', 'Wordpress'] },
    { name: 'Janine Hernandez', role: 'UI/UX Designer', rating: 0, reviews: 0, bio: '5yrs of experience building ui friendly application', skills: ['Figma', 'Webflow', 'Photoshop', 'Wordpress'] },
    { name: 'Michael Jackson', role: 'UI/UX Designer', rating: 0, reviews: 0, bio: '5yrs of experience building ui friendly application', skills: ['Figma', 'Webflow', 'Photoshop', 'Wordpress'] }
  ];

  get filteredMentors() {
    return this.allMentors.filter(m => {
      const matchName = !this.mentorSearchQuery || m.name.toLowerCase().includes(this.mentorSearchQuery.toLowerCase());
      const matchExpertise = !this.selectedExpertise || m.role.toLowerCase().includes(this.selectedExpertise.toLowerCase());
      return matchName && matchExpertise;
    });
  }

  removeSkill(skill: string) { this.selectedSkills = this.selectedSkills.filter(s => s !== skill); }

  toggleLevel(level: string) {
    if (this.expertiseLevels.includes(level)) this.expertiseLevels = this.expertiseLevels.filter(l => l !== level);
    else this.expertiseLevels.push(level);
  }

  resetFilters() { this.mentorSearchQuery = ''; this.selectedExpertise = ''; this.selectedSkills = []; this.expertiseLevels = []; }
  goToPage(page: number) { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }
  getPages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }

  // ─── Messages ──────────────────────────────────────────────────────────────
  chatSearchQuery = '';
  newMessageText = '';

  // Dynamic conversations from connected users
  conversations: any[] = [];
  
  activeConversation: any = null;

  messages: { id: number; text: string; fromMe: boolean; timestamp?: string; isPlaceholder?: boolean }[] = [];

  get filteredConversations() {
    if (!this.chatSearchQuery) return this.conversations;
    return this.conversations.filter(c => c.name.toLowerCase().includes(this.chatSearchQuery.toLowerCase()));
  }

  selectConversation(conv: any) { 
    this.activeConversation = conv;
    this.loadMessages(conv.id);
  }

  async loadMessages(userId: string) {
    const myId = this.currentUserId;
    if (!myId) return;

    const { data } = await this.supabase.getMessages(myId, userId);
    this.messages = (data || []).map((msg: any) => ({
      id: msg.id,
      text: msg.message,
      fromMe: msg.sender_id === myId,
      timestamp: msg.created_at
    }));
  }

  async sendMessage() {
    if (!this.newMessageText.trim() || !this.activeConversation) return;

    const message = this.newMessageText.trim();
    this.newMessageText = '';

    // Send to database
    await this.supabase.sendMessage(this.activeConversation.id, message);
    
    // Add to local messages immediately for better UX
    this.messages.push({
      id: Date.now(), // temporary ID
      text: message,
      fromMe: true,
      timestamp: new Date().toISOString()
    });

    // Refresh messages from database to get real IDs
    setTimeout(() => this.loadMessages(this.activeConversation.id), 100);
  }

  onMessageKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  // ─── Mentors & Feedback ────────────────────────────────────────────────────
  myMentors = [
    { name: 'Emily Johnson', specialty: 'UI/UX', rating: 0, reviews: 0 },
    { name: 'Peter Parker', specialty: 'Fullstack Developer', rating: 0, reviews: 0 },
    { name: 'Julian Hernandez', specialty: 'DevOps', rating: 0, reviews: 0 },
    { name: 'Julian Hernandez', specialty: 'DevOps', rating: 0, reviews: 0 }
  ];

  feedbackList = [
    { name: 'Julian Hernandez', rating: 5, comment: 'Good mentor and very understanding for their students, I love her teaching skills' },
    { name: 'Janine Hernandez', rating: 3, comment: 'Good mentor and very understanding for their students, I love her teaching skills' },
    { name: 'Michael Jackson', rating: 4, comment: 'Good mentor and very understanding for their students, I love her teaching skills' }
  ];

  getStars(rating: number): number[] { return Array.from({ length: 5 }, (_, i) => i + 1); }
  isFilled(star: number, rating: number): boolean { return star <= Math.round(rating); }

  // ─── Settings ──────────────────────────────────────────────────────────────
  
  settingsCountries = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia',
    'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Belarus',
    'Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria','Cambodia',
    'Cameroon','Canada','Chile','China','Colombia','Costa Rica','Croatia','Cuba',
    'Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','El Salvador',
    'Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece',
    'Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland',
    'Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait',
    'Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Mexico',
    'Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nicaragua','Nigeria',
    'Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland',
    'Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore',
    'Slovakia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden',
    'Switzerland','Syria','Taiwan','Tanzania','Thailand','Tunisia','Turkey',
    'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
    'Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe'
  ];

  toggleSettingsSkill(skill: string, type: 'mentor' | 'mentee') {
    if (type === 'mentor') {
      if (this.settingsTechnicalSkills.includes(skill)) this.settingsTechnicalSkills = this.settingsTechnicalSkills.filter(s => s !== skill);
      else this.settingsTechnicalSkills.push(skill);
    } else {
      if (this.settingsDesiredSkills.includes(skill)) this.settingsDesiredSkills = this.settingsDesiredSkills.filter(s => s !== skill);
      else this.settingsDesiredSkills.push(skill);
    }
  }

  onSettingsPhotoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.settingsPhotoFile = file;
      this.settingsPhotoPreview = URL.createObjectURL(file);
    }
  }

  // ─── Constructor ───────────────────────────────────────────────────────────
  constructor(
    private router: Router,
    private userService: UserService,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    await Promise.all([
      this.loadUserProfile(),
      this.loadMatchedUsers(),
      this.loadConnections()
    ]);
    // Update last_seen every 2 minutes
    await this.supabase.updateLastSeen();
    this.lastSeenInterval = setInterval(() => this.supabase.updateLastSeen(), 120000);
    this.isLoading = false;
  }

  ngOnDestroy() {
    if (this.lastSeenInterval) clearInterval(this.lastSeenInterval);
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  setActiveNav(id: string) { this.activeNavItem = id; }
  onViewAllSessions() {}
  onViewAllOnline() {}
  onSettings() { this.showUserMenu = false; this.setActiveNav('settings'); }
  toggleUserMenu() { this.showUserMenu = !this.showUserMenu; }
  closeUserMenu() { this.showUserMenu = false; }
  onLogout() { this.showUserMenu = false; this.router.navigate(['/login']); }

  getInitials(name: string): string {
    if (!name || name === '') return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // ─── Matchmaking ───────────────────────────────────────────────────────────
  async loadMatchedUsers() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;
    this.currentUserId = userId;

    if (this.isMentor) {
      const { data } = await this.supabase.getClient()
        .from('mentor_profiles')
        .select('expertise, skills')
        .eq('user_id', userId)
        .maybeSingle();

      const expertise = (data as any)?.expertise;
      const skills: string[] = (data as any)?.skills || [];
      const { data: matched } = await this.supabase.findMenteesForMentor(expertise, skills);
      this.recommendedMentors = (matched || []).filter((m: any) => m.user_id !== userId).map((m: any) => ({
        ...m,
        rating: 0,
        reviews: 0
      }));
    } else {
      const { data } = await this.supabase.getClient()
        .from('mentee_profiles')
        .select('desired_expertise, desired_skills')
        .eq('user_id', userId)
        .maybeSingle();

      const desiredExpertise = (data as any)?.desired_expertise;
      const desiredSkills: string[] = (data as any)?.desired_skills || [];
      const { data: matched } = await this.supabase.findMentorsForMentee(desiredExpertise, desiredSkills);
      // Only show approved mentors
      this.recommendedMentors = (matched || []).filter((m: any) => m.user_id !== userId && m.status === 'approved').map((m: any) => ({
        ...m,
        rating: 0,
        reviews: 0
      }));
    }
  }

  async loadConnections() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;

    const connections = await this.supabase.getMyConnections();
    this.myConnectionIds = new Set(
      connections.map((c: any) => c.mentee_user_id === userId ? c.mentor_user_id : c.mentee_user_id)
    );

    // Load profiles of connected users
    const ids = [...this.myConnectionIds];
    if (!ids.length) { 
      this.connectedUsers = []; 
      this.conversations = [];
      return; 
    }

    const role = this.userService.role();
    // If I'm a mentee, my connections are mentors, and vice versa
    const table = role === 'mentor' ? 'mentee_profiles' : 'mentor_profiles';
    const nameField = role === 'mentor' ? 'user_id,profile_picture,last_seen' : 'user_id,full_name,profile_picture,last_seen';

    const { data } = await this.supabase.getClient()
      .from(table)
      .select(nameField)
      .in('user_id', ids);

    const users = (data || []).map((u: any) => ({
      ...u,
      name: u.full_name || this.getNameFromMeta(u.user_id),
      isOnline: this.isOnline(u.last_seen),
      lastSeenLabel: this.getLastSeenLabel(u.last_seen),
    }));

    this.connectedUsers = users;

    // Also populate conversations for messages with last message
    const conversations = [];
    for (const u of users) {
      const { data: lastMsg } = await this.supabase.getLastMessage(userId, u.user_id);
      conversations.push({
        id: u.user_id,
        name: u.name,
        status: u.isOnline ? 'Active Now' : u.lastSeenLabel,
        isOnline: u.isOnline,
        lastMessage: lastMsg?.message || 'No messages yet',
        profile_picture: u.profile_picture
      });
    }
    this.conversations = conversations;

    // Set first conversation as active if none selected
    if (!this.activeConversation && this.conversations.length > 0) {
      this.activeConversation = this.conversations[0];
      this.loadMessages(this.activeConversation.id);
    }
  }

  isOnline(lastSeen: string): boolean {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000; // 5 min
  }

  getLastSeenLabel(lastSeen: string): string {
    if (!lastSeen) return 'Unknown';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 5) return 'Active Now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}m ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  private getNameFromMeta(_userId: string): string { return 'User'; }

  isConnectedTo(userId: string): boolean {
    return this.myConnectionIds.has(userId);
  }

  async onConnect(user: any) {
    const myId = this.currentUserId;
    if (!myId) return;
    const otherId = user.user_id;
    if (this.isMentor) {
      await this.supabase.connect(otherId, myId); // otherId=mentee, myId=mentor
    } else {
      await this.supabase.connect(myId, otherId); // myId=mentee, otherId=mentor
    }
    this.myConnectionIds.add(otherId);
    await this.loadConnections(); // Refresh connections and conversations
    
    // After connecting, switch to messages tab and select the conversation
    this.setActiveNav('messages');
    const conversation = this.conversations.find(c => c.id === otherId);
    if (conversation) {
      this.selectConversation(conversation);
    }
  }

  async onDisconnect(user: any) {
    const myId = this.currentUserId;
    if (!myId) return;
    const otherId = user.user_id;
    if (this.isMentor) {
      await this.supabase.disconnect(otherId, myId);
    } else {
      await this.supabase.disconnect(myId, otherId);
    }
    this.myConnectionIds.delete(otherId);
    await this.loadConnections(); // Refresh connections and conversations
    
    // Close profile modal if it's showing this user
    if (this.selectedProfile?.user_id === otherId) {
      this.closeProfile();
    }
  }

  // ─── Profile Modal ─────────────────────────────────────────────────────────
  async openProfile(user: any) {
    // Load full profile data including social media links
    const userId = user.user_id;
    const role = this.userService.role();
    
    // Determine which table to query based on opposite role
    const table = role === 'mentor' ? 'mentee_profiles' : 'mentor_profiles';
    
    const { data } = await this.supabase.getClient()
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    // Merge the full data with existing user data
    this.selectedProfile = data ? { ...user, ...data } : user;
    this.showProfileModal = true;
  }

  closeProfile() {
    this.showProfileModal = false;
    this.selectedProfile = null;
  }

  onViewProfile(user: any) { this.openProfile(user); }
  onMessage(user: any) { 
    this.setActiveNav('messages');
    const conversation = this.conversations.find(c => c.id === user.user_id);
    if (conversation) {
      this.selectConversation(conversation);
    }
  }

  // ─── Data ──────────────────────────────────────────────────────────────────
  async loadUserProfile() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;

    const role = this.userService.role();
    const authUser = await this.supabase.getClient().auth.getUser();
    this.settingsEmail = authUser.data.user?.email || '';
    
    // Get full_name from auth metadata (set during registration)
    const meta = await this.supabase.getCurrentUserMeta();
    const authFullName = meta.fullName || '';

    if (role === 'mentor') {
      const { data } = await this.supabase.getClient()
        .from('mentor_profiles')
        .select('full_name, profile_picture, job_position, company, expertise, years_experience, bio, skills, phone_number, country, gender, date_of_birth')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        const d = data as any;
        // Prefer full_name from mentor_profiles, fallback to auth metadata
        const fullName = d.full_name || authFullName;
        if (fullName) this.userName = this.stripMiddleName(fullName);
        this.profilePicture          = d.profile_picture || null;
        this.settingsJobPosition     = d.job_position    || '';
        this.settingsCompany         = d.company         || '';
        this.settingsExpertise       = d.expertise       || '';
        this.settingsYearsExperience = d.years_experience ?? null;
        this.settingsBio             = d.bio             || '';
        this.settingsTechnicalSkills = d.skills          || [];
        this.settingsPhone           = d.phone_number    || '';
        this.settingsCountry         = d.country         || '';
        this.settingsGender          = d.gender          || '';
        this.settingsDateOfBirth     = d.date_of_birth   || '';
      } else if (authFullName) {
        this.userName = this.stripMiddleName(authFullName);
      }
      this.userRole = 'Mentor';
    } else {
      // For mentees, check profile table first, then fall back to auth metadata
      const { data } = await this.supabase.getClient()
        .from('mentee_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        const d = data as any;
        // Prefer full_name from mentee_profiles, fallback to auth metadata
        const fullName = d.full_name || authFullName;
        if (fullName) this.userName = this.stripMiddleName(fullName);
        this.profilePicture           = d.profile_picture   || null;
        this.settingsMenteeType       = d.type              || '';
        this.settingsUniversity       = d.university        || '';
        this.settingsMenteeJobPosition= d.job_position      || '';
        this.settingsMenteeCompany    = d.company           || '';
        this.settingsLookingForJob    = d.looking_for_job   || 'no';
        this.settingsDesiredExpertise = d.desired_expertise || '';
        this.settingsDesiredSkills    = d.desired_skills    || [];
        this.settingsPhone            = d.phone_number      || '';
        this.settingsCountry          = d.country           || '';
        this.settingsGender           = d.gender            || '';
        this.settingsDateOfBirth      = d.date_of_birth     || '';
      } else if (authFullName) {
        this.userName = this.stripMiddleName(authFullName);
      }
      this.userRole = 'Mentee';
    }

    const nameParts = this.userName.split(' ');
    this.settingsFirstName = nameParts[0] || '';
    this.settingsLastName  = nameParts.slice(-1)[0] || '';
  }

  async saveSettings() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) {
      alert('Error: Could not identify user.');
      return;
    }
    const role = this.userService.role();
    const newName = `${this.settingsFirstName} ${this.settingsLastName}`.trim();

    try {
      // Upload new photo to Storage if one was selected
      if (this.settingsPhotoFile) {
        const url = await this.supabase.uploadProfilePicture(userId, this.settingsPhotoFile);
        if (url) this.profilePicture = url;
        this.settingsPhotoFile = null;
      }

      this.userName = newName;

      // Update email if changed (Account tab)
      if (this.settingsTab === 'account') {
        const authUser = await this.supabase.getClient().auth.getUser();
        const currentEmail = authUser.data.user?.email || '';
        
        if (this.settingsEmail && this.settingsEmail !== currentEmail) {
          const { error: emailError } = await this.supabase.getClient().auth.updateUser({
            email: this.settingsEmail
          });
          
          if (emailError) {
            alert(`Failed to update email: ${emailError.message}`);
            return;
          } else {
            alert('Email updated! Please check your new email for verification.');
          }
        }
      }

      if (role === 'mentor') {
        const { error } = await this.supabase.getClient()
          .from('mentor_profiles')
          .update({
            full_name:        newName,
            job_position:     this.settingsJobPosition     || null,
            company:          this.settingsCompany         || null,
            expertise:        this.settingsExpertise       || null,
            years_experience: this.settingsYearsExperience ?? null,
            bio:              this.settingsBio             || null,
            skills:           this.settingsTechnicalSkills,
            profile_picture:  this.profilePicture          || null,
            phone_number:     this.settingsPhone           || null,
            country:          this.settingsCountry         || null,
            gender:           this.settingsGender          || null,
            date_of_birth:    this.settingsDateOfBirth     || null,
          })
          .eq('user_id', userId);
        
        if (error) {
          console.error('Failed to save mentor profile:', error);
          alert(`Failed to save: ${error.message}`);
          return;
        }
      } else {
        const { error } = await this.supabase.getClient()
          .from('mentee_profiles')
          .update({
            type:              this.settingsMenteeType         || null,
            university:        this.settingsUniversity         || null,
            job_position:      this.settingsMenteeJobPosition  || null,
            company:           this.settingsMenteeCompany      || null,
            looking_for_job:   this.settingsLookingForJob      || null,
            desired_expertise: this.settingsDesiredExpertise   || null,
            desired_skills:    this.settingsDesiredSkills,
            profile_picture:   this.profilePicture             || null,
            phone_number:      this.settingsPhone              || null,
            country:           this.settingsCountry            || null,
            gender:            this.settingsGender             || null,
            date_of_birth:     this.settingsDateOfBirth        || null,
          })
          .eq('user_id', userId);
        
        if (error) {
          console.error('Failed to save mentee profile:', error);
          alert(`Failed to save: ${error.message}`);
          return;
        }

        await this.supabase.updateUserMeta({ full_name: newName });
      }

      this.settingsSaved = true;
      setTimeout(() => this.settingsSaved = false, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('An error occurred while saving. Please try again.');
    }
  }

  async savePassword() {
    this.passwordError = '';
    if (!this.settingsCurrentPassword) { this.passwordError = 'Current password is required.'; return; }
    if (this.settingsNewPassword.length < 8) { this.passwordError = 'New password must be at least 8 characters.'; return; }
    if (this.settingsNewPassword !== this.settingsConfirmPassword) { this.passwordError = 'Passwords do not match.'; return; }
    const { error: signInError } = await this.supabase.signIn(this.settingsEmail, this.settingsCurrentPassword);
    if (signInError) { this.passwordError = 'Current password is incorrect.'; return; }
    const { error } = await this.supabase.getClient().auth.updateUser({ password: this.settingsNewPassword });
    if (error) { this.passwordError = error.message; return; }
    this.settingsSaved = true;
    this.settingsCurrentPassword = '';
    this.settingsNewPassword = '';
    this.settingsConfirmPassword = '';
    setTimeout(() => this.settingsSaved = false, 3000);
  }

  private stripMiddleName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName.trim();
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  async deleteAccount() {
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm() {
    this.showDeleteConfirm = false;
    this.deleteAccountPassword = '';
  }

  async confirmDeleteAccount() {
    if (!this.deleteAccountPassword) {
      alert('Please enter your password to confirm account deletion.');
      return;
    }

    this.isDeleting = true;

    try {
      // Verify password first
      const authUser = await this.supabase.getClient().auth.getUser();
      const email = authUser.data.user?.email || '';

      const { error: signInError } = await this.supabase.signIn(email, this.deleteAccountPassword);
      if (signInError) {
        alert('Password is incorrect.');
        this.isDeleting = false;
        return;
      }

      // Get user ID
      const userId = await this.supabase.getCurrentUserId();
      if (!userId) {
        alert('Unable to determine user ID.');
        this.isDeleting = false;
        return;
      }

      // Call edge function to delete user account and all data
      const deleteResult = await this.supabase.deleteUserAccount(userId);
      
      if (!deleteResult.success) {
        alert(`Failed to delete account: ${deleteResult.error}`);
        this.isDeleting = false;
        return;
      }

      alert('Your account and all associated data have been successfully deleted.');
      await this.supabase.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error during account deletion:', error);
      alert('An error occurred while deleting your account. Please try again.');
      this.isDeleting = false;
    }
  }
}

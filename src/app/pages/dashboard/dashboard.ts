import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SupabaseService } from '../../services/supabase.service';
import { FeedbackModalComponent } from './feedback-modal.component';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, FeedbackModalComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewChecked {

  // ─── General ───────────────────────────────────────────────────────────────
  @ViewChild('calendarScrollContainer', { static: false }) calendarScrollContainer?: ElementRef<HTMLDivElement>;
  
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

  // ─── Activity Calendar (static UI) ──────────────────────────────────────────
  calendarViewMode: 'day' | 'week' | 'month' | 'year' = 'week';
  calendarWeekLabel = '';
  calendarHours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  calendarDays: Array<{ name: string; short: string; date: number }> = [];
  /** Demo “now” line around 15:15 as % of 09–21 day span */
  readonly calendarSlotCount = 24;
  calendarNowPercent = 0;
  private nowLineInterval: any;
  private shouldScrollCalendar = false;
  showNewEventPanel = true;

  // Event deletion
  showEventContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  selectedEventIndex: number | null = null;

  openEventContextMenu(event: MouseEvent, eventIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.selectedEventIndex = eventIndex;
    this.showEventContextMenu = true;

    // Close context menu when clicking elsewhere
    setTimeout(() => {
      document.addEventListener('click', this.closeEventContextMenu.bind(this), { once: true });
    }, 0);
  }

  closeEventContextMenu() {
    this.showEventContextMenu = false;
    this.selectedEventIndex = null;
  }

  deleteEvent() {
    if (this.selectedEventIndex !== null) {
      this.calendarEvents.splice(this.selectedEventIndex, 1);
      this.displayNotification('Event deleted successfully', 'success');
      this.closeEventContextMenu();
    }
  }

  // Notification/Toast system
  showNotification = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' | 'info' = 'info';
  private notificationTimeout: any;

  displayNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    this.notificationMessage = message;
    this.notificationType = type;
    this.showNotification = true;

    // Clear any existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    // Auto-hide after 3 seconds
    this.notificationTimeout = setTimeout(() => {
      this.showNotification = false;
    }, 3000);
  }

  closeNotification() {
    this.showNotification = false;
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
  }
  newEvent = {
    title: '',
    place: '',
    date: '',
    startTime: '',
    endTime: '',
    members: [] as string[],
    notes: '',
    color: '#29CC39'
  };
  
  availableColors = ['#29CC39', '#33BFFF', '#FF6633', '#A855F7', '#F59E0B', '#EC4899', '#10B981'];
  currentColorIndex = 0;

  calendarEvents: Array<{
    day: number;
    startHour: number;
    durationHours: number;
    title: string;
    color: string;
    badges: string[];
    avatars: number;
    compact?: boolean;
    place?: string;
    notes?: string;
    date?: string;
  }> = [];

  formatCalendarHour(hour: number): string {
    return `${hour < 10 ? '0' : ''}${hour}`;
  }

  initializeCurrentWeek(): void {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const monday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Get Monday of current week
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + monday);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Format week label
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = monthNames[weekStart.getMonth()];
    const endMonth = monthNames[weekEnd.getMonth()];
    const startDate = weekStart.getDate();
    const endDate = weekEnd.getDate();
    const year = weekEnd.getFullYear();
    
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      this.calendarWeekLabel = `${startMonth} ${startDate} – ${endDate}, ${year}`;
    } else {
      this.calendarWeekLabel = `${startMonth} ${startDate} – ${endMonth} ${endDate}, ${year}`;
    }
    
    // Build calendar days
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    this.calendarDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      const dayIndex = currentDay.getDay();
      
      this.calendarDays.push({
        name: dayNames[dayIndex],
        short: dayShorts[dayIndex],
        date: currentDay.getDate()
      });
    }
  }

  updateCalendarNowLine(scrollToPosition: boolean = false): void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    // Calculate percentage based on 24-hour day (0-24)
    const currentTimeInHours = hours + minutes / 60;
    this.calendarNowPercent = (currentTimeInHours / 24) * 100;
    
    // Scroll to current time if requested
    if (scrollToPosition) {
      this.scrollCalendarToCurrentTime();
    }
  }

  scrollCalendarToCurrentTime(): void {
    const container = this.calendarScrollContainer?.nativeElement;
    
    if (!container) {
      return;
    }
    
    const scrollHeight = container.scrollHeight;
    const containerHeight = container.clientHeight;
    
    if (scrollHeight <= containerHeight) {
      return;
    }
    
    // Calculate scroll position: center the current time in view
    const targetScroll = (scrollHeight * this.calendarNowPercent / 100) - (containerHeight / 2);
    const finalScroll = Math.max(0, Math.min(targetScroll, scrollHeight - containerHeight));
    
    container.scrollTo({
      top: finalScroll,
      behavior: 'smooth'
    });
  }

  getCalendarEventTime(event: { startHour: number; durationHours: number }): string {
    const end = event.startHour + event.durationHours;
    return `${this.formatCalendarHour(event.startHour)}:00 – ${this.formatCalendarHour(end)}:00`;
  }

  getCalendarEventStyle(event: { day: number; startHour: number; durationHours: number; color: string; compact?: boolean }) {
    const top = ((event.startHour) / this.calendarSlotCount) * 100;
    const height = (event.durationHours / this.calendarSlotCount) * 100;
    const bg = event.compact ? `${event.color}14` : '#FFFFFF';
    return {
      top: `calc(${top}% + 1px)`,
      height: `calc(${height}% - 2px)`,
      borderColor: event.color,
      background: bg,
      ['--cal-event-accent' as string]: event.color
    };
  }

  // Event Form Methods
  cycleEventColor(): void {
    this.currentColorIndex = (this.currentColorIndex + 1) % this.availableColors.length;
    this.newEvent.color = this.availableColors[this.currentColorIndex];
  }

  createEvent(): void {
    if (!this.newEvent.title || !this.newEvent.date || !this.newEvent.startTime) {
      this.displayNotification('Please fill in Title, Date, and Start Time', 'warning');
      return;
    }

    // Parse date and times
    const eventDate = new Date(this.newEvent.date);
    const [startHours, startMinutes] = this.newEvent.startTime.split(':').map(Number);
    
    // Calculate duration
    let durationHours = 1; // Default 1 hour if no end time
    if (this.newEvent.endTime) {
      const [endHours, endMinutes] = this.newEvent.endTime.split(':').map(Number);
      const startTimeInMinutes = startHours * 60 + startMinutes;
      const endTimeInMinutes = endHours * 60 + endMinutes;
      
      if (endTimeInMinutes > startTimeInMinutes) {
        durationHours = (endTimeInMinutes - startTimeInMinutes) / 60;
      } else {
        this.displayNotification('End time must be after start time', 'warning');
        return;
      }
    }
    
    // Get the Monday of the current calendar week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + monday);
    weekStart.setHours(0, 0, 0, 0); // Reset to start of day
    
    // Calculate which day column (0-6) this event belongs to
    // Day 0 = Monday, Day 6 = Sunday
    const timeDiff = eventDate.getTime() - weekStart.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    // Check if event is within current week view
    if (daysDiff < 0 || daysDiff > 6) {
      this.displayNotification('Event date is outside the current week view. Please switch to the correct week.', 'warning');
    }
    
    // Generate badges
    const badges: string[] = [];
    if (this.newEvent.place) {
      badges.push('LOC');
    }
    if (this.newEvent.notes) {
      badges.push('NOTE');
    }
    
    // Create event
    const newCalendarEvent = {
      day: daysDiff,
      startHour: startHours,
      durationHours: durationHours,
      title: this.newEvent.title,
      color: this.newEvent.color,
      badges: badges.length > 0 ? badges : ['MEET'],
      avatars: this.newEvent.members.length || 1,
      compact: durationHours <= 1,
      place: this.newEvent.place || undefined,
      notes: this.newEvent.notes || undefined,
      date: this.newEvent.date
    };

    this.calendarEvents.push(newCalendarEvent);

    // Reset form
    this.newEvent = {
      title: '',
      place: '',
      date: '',
      startTime: '',
      endTime: '',
      members: [],
      notes: '',
      color: this.availableColors[0]
    };
    this.currentColorIndex = 0;

    this.displayNotification('Event created successfully!', 'success');
  }

  getCalendarHourLinePercent(index: number): number {
    return (index / this.calendarSlotCount) * 100;
  }

  setCalendarView(mode: 'day' | 'week' | 'month' | 'year') {
    this.calendarViewMode = mode;
    
    // Update calendar display based on view mode
    if (mode === 'day') {
      this.initializeCurrentDay();
    } else if (mode === 'week') {
      this.initializeCurrentWeek();
    } else if (mode === 'month') {
      this.initializeCurrentMonth();
    } else if (mode === 'year') {
      this.initializeCurrentYear();
    }
  }

  initializeCurrentDay(): void {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const month = monthNames[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();
    const dayIndex = now.getDay();
    
    this.calendarWeekLabel = `${month} ${date}, ${year}`;
    
    // Show only current day
    this.calendarDays = [{
      name: dayNames[dayIndex],
      short: dayShorts[dayIndex],
      date: date
    }];
  }

  initializeCurrentMonth(): void {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = now.getFullYear();
    const month = now.getMonth();
    
    this.calendarWeekLabel = `${monthNames[month]} ${year}`;
    
    // Get first day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get first Monday of the month view (might be from previous month)
    const firstDayOfWeek = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(1 - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));
    
    // Build 7 days starting from first day of calendar view
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    this.calendarDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(startDate.getDate() + i);
      const dayIndex = currentDay.getDay();
      
      this.calendarDays.push({
        name: dayNames[dayIndex],
        short: dayShorts[dayIndex],
        date: currentDay.getDate()
      });
    }
  }

  initializeCurrentYear(): void {
    const now = new Date();
    const year = now.getFullYear();
    
    this.calendarWeekLabel = `${year}`;
    
    // For year view, show the current week still
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dayOfWeek = now.getDay();
    const monday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + monday);
    
    this.calendarDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      const dayIndex = currentDay.getDay();
      
      this.calendarDays.push({
        name: dayNames[dayIndex],
        short: dayShorts[dayIndex],
        date: currentDay.getDate()
      });
    }
  }

  calendarRange(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

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
  totalUnreadMessages = 0;

  // Dynamic conversations from connected users
  conversations: any[] = [];
  
  activeConversation: any = null;

  messages: { id: number; text: string; fromMe: boolean; timestamp?: string; status?: string; isPlaceholder?: boolean }[] = [];

  get filteredConversations() {
    if (!this.chatSearchQuery) return this.conversations;
    return this.conversations.filter(c => c.name.toLowerCase().includes(this.chatSearchQuery.toLowerCase()));
  }

  selectConversation(conv: any) { 
    this.activeConversation = conv;
    this.loadMessages(conv.id);
    // Mark messages as seen when opening conversation
    this.supabase.markMessagesAsSeen(conv.id, this.currentUserId);
    // Update unread count for this conversation
    conv.unreadCount = 0;
    this.updateTotalUnreadCount();
  }

  async loadMessages(userId: string) {
    const myId = this.currentUserId;
    if (!myId) return;

    const { data } = await this.supabase.getMessages(myId, userId);
    this.messages = (data || []).map((msg: any) => ({
      id: msg.id,
      text: msg.message,
      fromMe: msg.sender_id === myId,
      timestamp: msg.created_at,
      status: msg.status
    }));
  }

  async sendMessage() {
    if (!this.newMessageText.trim() || !this.activeConversation) return;

    const message = this.newMessageText.trim();
    this.newMessageText = '';

    // Optimistic UI update - add message immediately
    const tempId = Date.now();
    this.messages.push({
      id: tempId,
      text: message,
      fromMe: true,
      timestamp: new Date().toISOString(),
      status: 'sent'
    });

    try {
      // Send to database
      const result = await this.supabase.sendMessage(this.activeConversation.id, message);
      
      if (result.data) {
        // Replace temp message with real one
        const index = this.messages.findIndex(m => m.id === tempId);
        if (index !== -1) {
          this.messages[index] = {
            id: result.data.id,
            text: message,
            fromMe: true,
            timestamp: result.data.created_at,
            status: result.data.status
          };
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      this.messages = this.messages.filter(m => m.id !== tempId);
    }
  }

  updateTotalUnreadCount() {
    this.totalUnreadMessages = this.conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
  }

  getMessageStatusIcon(status: string): string {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'seen': return '✓✓';
      default: return '';
    }
  }

  getMessageStatusClass(status: string): string {
    switch (status) {
      case 'sent': return 'status-sent';
      case 'delivered': return 'status-delivered';
      case 'seen': return 'status-seen';
      default: return '';
    }
  }

  onMessageKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  // ─── Feedback Modal Properties ──────────────────────────────────────────────
  showFeedbackModal = false;
  selectedMentorForFeedback: any = null;
  existingFeedback: any = null;

  // ─── Resources / Learning Materials Properties ──────────────────────────────
  Math = Math; // Expose Math for template
  resourceMaterials: any[] = [];
  selectedResourceMentorId = '';
  availableResourceMentors: any[] = [];
  resourceMenteesProgress: any[] = [];
  
  // Upload modal
  showResourcesUploadModal = false;
  resourceUploadTitle = '';
  resourceUploadDescription = '';
  resourceUploadOrderNumber = '';
  resourceUploadFile: File | null = null;
  resourceUploadFileName = '';
  resourceUploadFileSize = 0;
  resourceUploadDuration: number | null = null;
  isResourceUploading = false;
  
  // Edit modal
  showResourcesEditModal = false;
  editingResourceMaterial: any = null;
  resourceEditTitle = '';
  resourceEditDescription = '';
  resourceEditOrderNumber = '';
  resourceEditDuration: number | null = null;

  // Materials modal (for mentee viewing mentor's materials)
  showMaterialsModal = false;
  selectedMentorForMaterials: any = null;
  modalMaterials: any[] = [];
  modalCompletedCount = 0;
  modalProgressPercentage = 0;

  // Mentee progress modal (for mentor viewing mentee's progress)
  showMenteeProgressModal = false;
  selectedMenteeForProgress: any = null;

  // ─── Mentors & Feedback ────────────────────────────────────────────────────
  connectedMentors: any[] = [];
  menteesFeedback: any[] = [];

  getStars(rating?: number): number[] { return Array.from({ length: 5 }, (_, i) => i + 1); }
  isFilled(star: number, rating: number): boolean { return star <= Math.round(rating); }

  // ─── Feedback Methods ──────────────────────────────────────────────────────
  async loadConnectedMentors() {
    if (this.isMentor) return; // Only for mentees

    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;

    const connections = await this.supabase.getMyConnections();
    const mentorIds = connections
      .filter((c: any) => c.mentee_user_id === userId && c.status === 'connected')
      .map((c: any) => c.mentor_user_id);

    if (!mentorIds.length) {
      this.connectedMentors = [];
      return;
    }

    // Get mentor profiles
    const { data: mentors } = await this.supabase.getClient()
      .from('mentor_profiles')
      .select('*')
      .in('user_id', mentorIds);

    // Get feedback for each mentor
    const mentorsWithFeedback = await Promise.all((mentors || []).map(async (mentor: any) => {
      const { data: feedback } = await this.supabase.getClient()
        .from('feedback_submissions')
        .select('*')
        .eq('mentee_user_id', userId)
        .eq('mentor_user_id', mentor.user_id)
        .maybeSingle();
      return { ...mentor, feedback };
    }));

    this.connectedMentors = mentorsWithFeedback;
  }

  async loadMenteesFeedback() {
    if (!this.isMentor) return; // Only for mentors

    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;

    // Get all feedback for this mentor
    const { data: feedbacks } = await this.supabase.getClient()
      .from('feedback_submissions')
      .select('*')
      .eq('mentor_user_id', userId)
      .order('created_at', { ascending: false });

    // Get mentee profiles for each feedback
    const feedbacksWithMenteeInfo = await Promise.all((feedbacks || []).map(async (feedback: any) => {
      const { data: mentee } = await this.supabase.getClient()
        .from('mentee_profiles')
        .select('full_name, profile_picture')
        .eq('user_id', feedback.mentee_user_id)
        .maybeSingle();
      return {
        ...feedback,
        mentee_name: mentee?.full_name || 'Anonymous',
        mentee_picture: mentee?.profile_picture || null
      };
    }));

    this.menteesFeedback = feedbacksWithMenteeInfo;
  }

  async openFeedbackModal(mentor: any) {
    this.selectedMentorForFeedback = mentor;
    this.existingFeedback = mentor.feedback || null;
    this.showFeedbackModal = true;
  }

  closeFeedbackModal() {
    this.showFeedbackModal = false;
    this.selectedMentorForFeedback = null;
    this.existingFeedback = null;
  }

  async submitFeedback(event: { rating: number; feedback_text: string }) {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId || !this.selectedMentorForFeedback) {
      alert('Error: Unable to submit feedback');
      return;
    }

    const mentorId = this.selectedMentorForFeedback.user_id;

    try {
      // Check if feedback already exists
      const { data: existingFeedback } = await this.supabase.getClient()
        .from('feedback_submissions')
        .select('*')
        .eq('mentee_user_id', userId)
        .eq('mentor_user_id', mentorId)
        .maybeSingle();

      if (existingFeedback) {
        // Update existing feedback
        const { error: updateError } = await this.supabase.getClient()
          .from('feedback_submissions')
          .update({
            rating: event.rating,
            feedback_text: event.feedback_text,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFeedback.id);

        if (updateError) throw updateError;
      } else {
        // Insert new feedback
        const { error: insertError } = await this.supabase.getClient()
          .from('feedback_submissions')
          .insert({
            mentee_user_id: userId,
            mentor_user_id: mentorId,
            rating: event.rating,
            feedback_text: event.feedback_text
          });

        if (insertError) throw insertError;
      }

      // Close modal and reset
      this.showFeedbackModal = false;
      this.selectedMentorForFeedback = null;
      this.existingFeedback = null;

      // Reload connected mentors to show the new/updated feedback
      await this.loadConnectedMentors();
      
      // Show success message
      alert('✅ Feedback submitted successfully!');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('❌ Failed to submit feedback. Please try again.');
    }
  }

  async deleteFeedback(mentor: any) {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    const userId = await this.supabase.getCurrentUserId();
    if (!userId || !mentor.feedback) return;

    try {
      await this.supabase.getClient()
        .from('feedback_submissions')
        .delete()
        .eq('id', mentor.feedback.id);

      // Reload connected mentors
      await this.loadConnectedMentors();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Failed to delete feedback. Please try again.');
    }
  }


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
    
    // Initialize calendar with current week
    this.initializeCurrentWeek();
    
    // Initialize and update calendar "now" line
    this.updateCalendarNowLine(false); // Don't scroll on init, will scroll when tab is opened
    this.nowLineInterval = setInterval(() => {
      this.updateCalendarNowLine(); // Don't scroll on periodic updates
    }, 60000); // Update every minute
    
    // Update last_seen every 2 minutes
    await this.supabase.updateLastSeen();
    this.lastSeenInterval = setInterval(() => {
      this.supabase.updateLastSeen();
      // Also refresh connections every 2 minutes to update online status
      if (this.activeNavItem === 'messages') {
        this.loadConnections();
        // Check for new messages
        if (this.activeConversation) {
          this.loadMessages(this.activeConversation.id);
        }
      }
    }, 120000);
    
    // Frequent polling for messages tab (every 5 seconds when active)
    setInterval(() => {
      if (this.activeNavItem === 'messages' && this.activeConversation) {
        this.checkForNewMessages();
      }
    }, 5000);
    
    // Update unread counts every 30 seconds
    setInterval(() => {
      this.updateAllUnreadCounts();
    }, 30000);
    
    this.isLoading = false;
  }

  async checkForNewMessages() {
    if (!this.activeConversation || this.messages.length === 0) return;
    
    const lastMessageId = this.messages[this.messages.length - 1]?.id;
    const myId = this.currentUserId;
    
    const { data } = await this.supabase.getMessages(myId, this.activeConversation.id);
    const newMessages = (data || []).filter((msg: any) => {
      // Only get messages newer than the last one we have
      return msg.id > lastMessageId;
    });
    
    if (newMessages.length > 0) {
      // Add new messages
      newMessages.forEach((msg: any) => {
        this.messages.push({
          id: msg.id,
          text: msg.message,
          fromMe: msg.sender_id === myId,
          timestamp: msg.created_at,
          status: msg.status
        });
      });
      
      // Mark as seen
      await this.supabase.markMessagesAsSeen(this.activeConversation.id, myId);
    }
  }

  async updateAllUnreadCounts() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;
    
    // Update unread counts for all conversations
    for (const conv of this.conversations) {
      const unreadCount = await this.supabase.getUnreadCount(userId, conv.id);
      conv.unreadCount = unreadCount;
    }
    
    this.updateTotalUnreadCount();
  }

  ngOnDestroy() {
    if (this.lastSeenInterval) clearInterval(this.lastSeenInterval);
    if (this.nowLineInterval) clearInterval(this.nowLineInterval);
  }

  ngAfterViewChecked() {
    // Check if we should scroll the calendar and if the element is now available
    if (this.shouldScrollCalendar && this.calendarScrollContainer?.nativeElement) {
      this.shouldScrollCalendar = false;
      // Use setTimeout to ensure Angular has finished all DOM updates
      setTimeout(() => {
        this.scrollCalendarToCurrentTime();
      }, 0);
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  async setActiveNav(id: string) { 
    this.activeNavItem = id;
    
    // Close any open modals when switching tabs
    this.closeMaterialsModal();
    this.closeMenteeProgressModal();
    
    if (id === 'mentors') {
      if (this.isMentor) {
        await this.loadMenteesFeedback();
      } else {
        await this.loadConnectedMentors();
      }
    } else if (id === 'library') {
      if (this.isMentor) {
        await this.loadResourceMaterials();
        await this.loadResourceMenteesProgress();
      } else {
        await this.loadResourceMentors();
      }
    } else if (id === 'calendar') {
      // Scroll to current time when calendar tab is opened
      // Set flag - will scroll in ngAfterViewChecked when DOM is ready
      this.shouldScrollCalendar = true;
    }
  }
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
      const approvedMentors = (matched || []).filter((m: any) => m.user_id !== userId && m.status === 'approved');
      
      if (approvedMentors.length === 0) {
        this.recommendedMentors = [];
        return;
      }

      try {
        // Get all mentor IDs
        const mentorIds = approvedMentors.map((m: any) => m.user_id);
        
        // Fetch ALL feedback in ONE query (much faster!)
        const { data: allFeedback, error } = await this.supabase.getClient()
          .from('feedback_submissions')
          .select('mentor_user_id, rating')
          .in('mentor_user_id', mentorIds);

        // If feedback table doesn't exist, just show mentors without ratings
        if (error) {
          console.warn('Feedback table not found, showing mentors without ratings');
          this.recommendedMentors = approvedMentors.map((m: any) => ({
            ...m,
            rating: 0,
            reviews: 0
          }));
          return;
        }

        // Group feedback by mentor_user_id
        const feedbackByMentor = new Map<string, number[]>();
        (allFeedback || []).forEach((fb: any) => {
          if (!feedbackByMentor.has(fb.mentor_user_id)) {
            feedbackByMentor.set(fb.mentor_user_id, []);
          }
          feedbackByMentor.get(fb.mentor_user_id)!.push(fb.rating);
        });

        // Calculate ratings for each mentor
        this.recommendedMentors = approvedMentors.map((m: any) => {
          const ratings = feedbackByMentor.get(m.user_id) || [];
          const reviews = ratings.length;
          const rating = reviews > 0 
            ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / reviews) * 10) / 10
            : 0;
          
          return {
            ...m,
            rating,
            reviews
          };
        });
      } catch (error) {
        console.error('Error loading ratings:', error);
        // If error, just show mentors without ratings
        this.recommendedMentors = approvedMentors.map((m: any) => ({
          ...m,
          rating: 0,
          reviews: 0
        }));
      }
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
    
    const { data } = await this.supabase.getClient()
      .from(table)
      .select('user_id,full_name,profile_picture,last_seen')
      .in('user_id', ids);

    const users = (data || []).map((u: any) => ({
      ...u,
      name: u.full_name?.trim() || `User ${u.user_id.slice(0, 8)}`,
      isOnline: this.isOnline(u.last_seen),
      lastSeenLabel: this.getLastSeenLabel(u.last_seen),
    }));

    this.connectedUsers = users;

    // Also populate conversations for messages with last message
    const conversations = [];
    for (const u of users) {
      const { data: lastMsg } = await this.supabase.getLastMessage(userId, u.user_id);
      const unreadCount = await this.supabase.getUnreadCount(userId, u.user_id);
      conversations.push({
        id: u.user_id,
        name: u.name,
        status: u.isOnline ? 'Active Now' : u.lastSeenLabel,
        isOnline: u.isOnline,
        lastMessage: lastMsg?.message || 'No messages yet',
        profile_picture: u.profile_picture,
        unreadCount: unreadCount
      });
    }
    this.conversations = conversations;
    this.updateTotalUnreadCount();

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

  onViewProfile(user: any) { 
    // Navigate to appropriate profile view page based on user role
    if (user && user.user_id) {
      // Determine if this is a mentor or mentee based on current user's role
      // If I'm a mentor, I'm viewing mentees; if I'm a mentee, I'm viewing mentors
      const viewType = this.isMentor ? 'mentee' : 'mentor';
      this.router.navigate([`/${viewType}`, user.user_id]);
    }
  }
  onMessage(user: any) { 
    this.setActiveNav('messages');
    const conversation = this.conversations.find(c => c.id === user.user_id);
    if (conversation) {
      this.selectConversation(conversation);
    }
  }

  // ─── Resources / Learning Materials Methods ────────────────────────────────
  
  async loadResourceMentors() {
    if (this.isMentor) return;
    
    const connections = await this.supabase.getMyConnections();
    const mentorIds = connections
      .filter((c: any) => c.mentee_user_id === this.currentUserId && c.status === 'connected')
      .map((c: any) => c.mentor_user_id);

    if (mentorIds.length === 0) {
      this.availableResourceMentors = [];
      return;
    }

    const { data: mentors } = await this.supabase.getClient()
      .from('mentor_profiles')
      .select('user_id, full_name, profile_picture, expertise')
      .in('user_id', mentorIds);

    // Calculate progress for each mentor
    const mentorsWithProgress = await Promise.all((mentors || []).map(async (mentor: any) => {
      // Get total materials from this mentor
      const { data: materials } = await this.supabase.getClient()
        .from('learning_materials')
        .select('id')
        .eq('mentor_user_id', mentor.user_id);

      const totalMaterials = (materials || []).length;

      // Get completed materials
      const materialIds = (materials || []).map((m: any) => m.id);
      let completedCount = 0;

      if (materialIds.length > 0) {
        const { data: progress } = await this.supabase.getClient()
          .from('material_progress')
          .select('material_id')
          .eq('mentee_user_id', this.currentUserId)
          .eq('completed', true)
          .in('material_id', materialIds);

        completedCount = (progress || []).length;
      }

      const progressPercentage = totalMaterials > 0 
        ? Math.round((completedCount / totalMaterials) * 100)
        : 0;

      return {
        ...mentor,
        total_materials: totalMaterials,
        completed_materials: completedCount,
        progress_percentage: progressPercentage
      };
    }));

    this.availableResourceMentors = mentorsWithProgress;
  }

  async selectResourceMentor(mentorId: string) {
    this.selectedResourceMentorId = mentorId;
    await this.loadResourceMaterialsForMentee();
  }

  async loadResourceMaterials() {
    const { data } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.currentUserId)
      .order('order_number', { ascending: true });

    this.resourceMaterials = data || [];
  }

  async loadResourceMaterialsForMentee() {
    if (!this.selectedResourceMentorId) return;

    const { data: materialsData } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.selectedResourceMentorId)
      .order('order_number', { ascending: true });

    const { data: progressData } = await this.supabase.getClient()
      .from('material_progress')
      .select('material_id, completed')
      .eq('mentee_user_id', this.currentUserId);

    const progressMap = new Map(
      (progressData || []).map((p: any) => [p.material_id, p.completed])
    );

    this.resourceMaterials = (materialsData || []).map(m => ({
      ...m,
      completed: progressMap.get(m.id) || false
    }));
  }

  async loadResourceMenteesProgress() {
    const connections = await this.supabase.getMyConnections();
    const menteeIds = connections
      .filter((c: any) => c.mentor_user_id === this.currentUserId && c.status === 'connected')
      .map((c: any) => c.mentee_user_id);

    if (menteeIds.length === 0) {
      this.resourceMenteesProgress = [];
      return;
    }

    const { data: mentees } = await this.supabase.getClient()
      .from('mentee_profiles')
      .select('user_id, full_name, profile_picture')
      .in('user_id', menteeIds);

    const totalMaterials = this.resourceMaterials.length;

    const progressPromises = (mentees || []).map(async (mentee: any) => {
      const { data: progress } = await this.supabase.getClient()
        .from('material_progress')
        .select('material_id, completed')
        .eq('mentee_user_id', mentee.user_id)
        .eq('completed', true);

      const completedCount = (progress || []).length;
      const percentage = totalMaterials > 0 
        ? Math.round((completedCount / totalMaterials) * 100) 
        : 0;

      return {
        mentee_user_id: mentee.user_id,
        mentee_name: mentee.full_name || 'Mentee',
        mentee_picture: mentee.profile_picture || '',
        total_materials: totalMaterials,
        completed_materials: completedCount,
        progress_percentage: percentage
      };
    });

    this.resourceMenteesProgress = await Promise.all(progressPromises);
  }

  openResourcesUploadModal() {
    this.showResourcesUploadModal = true;
    this.resourceUploadTitle = '';
    this.resourceUploadDescription = '';
    this.resourceUploadOrderNumber = this.getResourceNextOrderNumber();
    this.resourceUploadFile = null;
    this.resourceUploadFileName = '';
    this.resourceUploadFileSize = 0;
    this.resourceUploadDuration = null;
  }

  closeResourcesUploadModal() {
    this.showResourcesUploadModal = false;
    this.resourceUploadFile = null;
  }

  onResourceFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        alert(`⚠️ File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.\n\nTips:\n- Compress your video\n- Use lower resolution (720p)\n- Or upgrade to Supabase Pro for larger files`);
        (event.target as HTMLInputElement).value = '';
        return;
      }
      
      this.resourceUploadFile = file;
      this.resourceUploadFileName = file.name;
      this.resourceUploadFileSize = file.size;
    }
  }

  getResourceNextOrderNumber(): string {
    if (this.resourceMaterials.length === 0) return '1.1';
    
    const lastOrder = this.resourceMaterials[this.resourceMaterials.length - 1].order_number;
    const parts = lastOrder.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    
    return `${major}.${minor + 1}`;
  }

  async uploadResourceMaterial() {
    if (!this.resourceUploadTitle || !this.resourceUploadFile || !this.resourceUploadOrderNumber) {
      alert('Please fill in all required fields');
      return;
    }

    this.isResourceUploading = true;

    try {
      const fileExt = this.resourceUploadFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `learning-materials/${this.currentUserId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await this.supabase.getClient()
        .storage
        .from('learning-materials')
        .upload(filePath, this.resourceUploadFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = this.supabase.getClient()
        .storage
        .from('learning-materials')
        .getPublicUrl(filePath);

      const fileType = this.getResourceFileType(fileExt || '');

      const { error: insertError } = await this.supabase.getClient()
        .from('learning_materials')
        .insert({
          mentor_user_id: this.currentUserId,
          title: this.resourceUploadTitle,
          description: this.resourceUploadDescription,
          order_number: this.resourceUploadOrderNumber,
          file_url: urlData.publicUrl,
          file_type: fileType,
          file_name: this.resourceUploadFile.name,
          duration_minutes: this.resourceUploadDuration
        });

      if (insertError) throw insertError;

      alert('✅ Material uploaded successfully!');
      this.closeResourcesUploadModal();
      await this.loadResourceMaterials();
      await this.loadResourceMenteesProgress();
    } catch (error) {
      console.error('Error uploading material:', error);
      alert('❌ Failed to upload material. Please try again.');
    } finally {
      this.isResourceUploading = false;
    }
  }

  getResourceFileType(extension: string): string {
    const ext = extension.toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx', 'txt', 'ppt', 'pptx'].includes(ext)) return 'document';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    return 'file';
  }

  openResourcesEditModal(material: any) {
    this.editingResourceMaterial = material;
    this.resourceEditTitle = material.title;
    this.resourceEditDescription = material.description;
    this.resourceEditOrderNumber = material.order_number;
    this.resourceEditDuration = material.duration_minutes;
    this.showResourcesEditModal = true;
  }

  closeResourcesEditModal() {
    this.showResourcesEditModal = false;
    this.editingResourceMaterial = null;
  }

  async updateResourceMaterial() {
    if (!this.editingResourceMaterial || !this.resourceEditTitle || !this.resourceEditOrderNumber) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await this.supabase.getClient()
        .from('learning_materials')
        .update({
          title: this.resourceEditTitle,
          description: this.resourceEditDescription,
          order_number: this.resourceEditOrderNumber,
          duration_minutes: this.resourceEditDuration,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.editingResourceMaterial.id);

      if (error) throw error;

      alert('✅ Material updated successfully!');
      this.closeResourcesEditModal();
      
      // Reload based on context
      if (this.isMentor) {
        await this.loadResourceMaterials();
        await this.loadResourceMenteesProgress();
        // If mentee progress modal is open, refresh it
        if (this.showMenteeProgressModal && this.selectedMenteeForProgress) {
          await this.openMenteeProgressModal(this.selectedMenteeForProgress);
        }
      }
    } catch (error) {
      console.error('Error updating material:', error);
      alert('❌ Failed to update material. Please try again.');
    }
  }

  async deleteResourceMaterial(material: any) {
    if (!confirm(`Are you sure you want to delete "${material.title}"?`)) return;

    try {
      const filePath = material.file_url.split('/learning-materials/')[1];
      if (filePath) {
        await this.supabase.getClient()
          .storage
          .from('learning-materials')
          .remove([filePath]);
      }

      const { error } = await this.supabase.getClient()
        .from('learning_materials')
        .delete()
        .eq('id', material.id);

      if (error) throw error;

      alert('✅ Material deleted successfully!');
      await this.loadResourceMaterials();
      await this.loadResourceMenteesProgress();
      
      // If mentee progress modal is open, refresh it
      if (this.showMenteeProgressModal && this.selectedMenteeForProgress) {
        await this.openMenteeProgressModal(this.selectedMenteeForProgress);
      }
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('❌ Failed to delete material. Please try again.');
    }
  }

  async toggleResourceCompletion(material: any) {
    if (this.isMentor) return;

    try {
      const newCompletedState = !material.completed;

      const { data: existing } = await this.supabase.getClient()
        .from('material_progress')
        .select('id')
        .eq('mentee_user_id', this.currentUserId)
        .eq('material_id', material.id)
        .maybeSingle();

      if (existing) {
        await this.supabase.getClient()
          .from('material_progress')
          .update({
            completed: newCompletedState,
            completed_at: newCompletedState ? new Date().toISOString() : null
          })
          .eq('id', existing.id);
      } else {
        await this.supabase.getClient()
          .from('material_progress')
          .insert({
            mentee_user_id: this.currentUserId,
            material_id: material.id,
            completed: newCompletedState,
            completed_at: newCompletedState ? new Date().toISOString() : null
          });
      }

      material.completed = newCompletedState;
    } catch (error) {
      console.error('Error toggling completion:', error);
      alert('❌ Failed to update progress. Please try again.');
    }
  }

  getResourceFileIcon(fileType: string): string {
    switch (fileType) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'document': return '📝';
      case 'image': return '🖼️';
      default: return '📎';
    }
  }

  getResourceProgressColor(percentage: number): string {
    if (percentage >= 75) return '#21AA3A'; // green
    if (percentage >= 50) return '#04A2D7'; // blue
    if (percentage >= 25) return '#f59e0b'; // orange
    return '#ef4444'; // red
  }

  getResourceFileSizeLabel(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // Modal methods for viewing materials
  async openMentorMaterialsModal(mentor: any) {
    this.selectedMentorForMaterials = mentor;
    this.showMaterialsModal = true;

    // Load materials from this mentor
    const { data: materialsData } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', mentor.user_id)
      .order('order_number', { ascending: true });

    // Load progress
    const { data: progressData } = await this.supabase.getClient()
      .from('material_progress')
      .select('material_id, completed')
      .eq('mentee_user_id', this.currentUserId);

    const progressMap = new Map(
      (progressData || []).map((p: any) => [p.material_id, p.completed])
    );

    this.modalMaterials = (materialsData || []).map(m => ({
      ...m,
      completed: progressMap.get(m.id) || false
    }));

    this.updateModalProgress();
  }

  closeMaterialsModal() {
    this.showMaterialsModal = false;
    this.selectedMentorForMaterials = null;
    this.modalMaterials = [];
  }

  async openMenteeProgressModal(mentee: any) {
    this.selectedMenteeForProgress = mentee;
    this.showMenteeProgressModal = true;

    // Load mentor's materials
    const { data: materialsData } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.currentUserId)
      .order('order_number', { ascending: true });

    // Load mentee's progress
    const { data: progressData } = await this.supabase.getClient()
      .from('material_progress')
      .select('material_id, completed')
      .eq('mentee_user_id', mentee.mentee_user_id);

    const progressMap = new Map(
      (progressData || []).map((p: any) => [p.material_id, p.completed])
    );

    this.modalMaterials = (materialsData || []).map(m => ({
      ...m,
      completed: progressMap.get(m.id) || false
    }));

    this.updateModalProgress();
  }

  closeMenteeProgressModal() {
    this.showMenteeProgressModal = false;
    this.selectedMenteeForProgress = null;
    this.modalMaterials = [];
  }

  async toggleMaterialCompletion(material: any) {
    if (this.isMentor) return;

    try {
      const newCompletedState = !material.completed;

      const { data: existing } = await this.supabase.getClient()
        .from('material_progress')
        .select('id')
        .eq('mentee_user_id', this.currentUserId)
        .eq('material_id', material.id)
        .maybeSingle();

      if (existing) {
        await this.supabase.getClient()
          .from('material_progress')
          .update({
            completed: newCompletedState,
            completed_at: newCompletedState ? new Date().toISOString() : null
          })
          .eq('id', existing.id);
      } else {
        await this.supabase.getClient()
          .from('material_progress')
          .insert({
            mentee_user_id: this.currentUserId,
            material_id: material.id,
            completed: newCompletedState,
            completed_at: newCompletedState ? new Date().toISOString() : null
          });
      }

      material.completed = newCompletedState;
      this.updateModalProgress();
      
      // Reload mentor list to update progress
      await this.loadResourceMentors();
    } catch (error) {
      console.error('Error toggling completion:', error);
      alert('❌ Failed to update progress. Please try again.');
    }
  }

  updateModalProgress() {
    this.modalCompletedCount = this.modalMaterials.filter(m => m.completed).length;
    this.modalProgressPercentage = this.modalMaterials.length > 0
      ? Math.round((this.modalCompletedCount / this.modalMaterials.length) * 100)
      : 0;
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

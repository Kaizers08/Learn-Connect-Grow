import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef, NgZone, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SupabaseService } from '../../services/supabase.service';
import { FeedbackModalComponent } from './feedback-modal.component';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, FeedbackModalComponent, IconComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly dashboardBodyClass = 'dashboard-messages-open';

  // ─── General ───────────────────────────────────────────────────────────────
  @ViewChild('calendarScrollContainer', { static: false }) calendarScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('messagesScrollContainer', { static: false }) messagesScrollContainer?: ElementRef<HTMLDivElement>;
  
  userName = '';
  userRole = 'Mentee';
  showUserMenu = false;
  profilePicture: string | null = null;
  currentUserId = '';
  private lastSeenInterval: any;
  isLoading = true;

  get isMentor(): boolean { return this.userService.role() === 'mentor'; }

  upcomingSessionsCount = 0;
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

  // ─── Debug UI ──────────────────────────────────────────────────────────────
  upcomingSessions: Array<{
    mentorName: string;
    isActive: boolean;
    date: string;
    time: string;
    platform: string;
    notes?: string;
    mentorProfilePicture?: string;
    eventType?: string;
  }> = [];

  searchQuery = '';

  // ─── Activity Calendar (static UI) ──────────────────────────────────────────
  calendarViewMode: 'day' | 'week' = 'week';
  calendarWeekLabel = '';
  calendarHours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  calendarDays: Array<{ name: string; short: string; date: number }> = [];
  calendarAnchorDate = new Date();
  /** Demo “now” line around 15:15 as % of 09–21 day span */
  readonly calendarSlotCount = 24;
  calendarNowPercent = 0;
  private nowLineInterval: any;
  private shouldScrollCalendar = false;
  private shouldScrollMessages = false;
  private messageScrollFrame: number | null = null;
  showCalendarEventModal = false;
  selectedCalendarEvent: any = null;

  // Delete calendar event confirmation
  showDeleteEventModal = false;
  eventPendingDelete: any = null;
  isDeletingEvent = false;

  openCalendarEventDetails(event: any) {
    this.selectedCalendarEvent = event;
    this.showCalendarEventModal = true;
  }

  onCalendarEventContextMenu(event: any, mouseEvent: MouseEvent) {
    mouseEvent.preventDefault();
    this.openCalendarEventDetails(event);
  }

  closeCalendarEventDetails() {
    this.showCalendarEventModal = false;
    this.selectedCalendarEvent = null;
  }

  /** Only events the current user owns can be deleted (not a mentor's shared events). */
  canDeleteCalendarEvent(event: any): boolean {
    if (!event) return false;
    return !event.isFromMentor;
  }

  askDeleteCalendarEvent(event: any) {
    this.eventPendingDelete = event;
    this.showDeleteEventModal = true;
    this.refreshView();
  }

  cancelDeleteCalendarEvent() {
    this.showDeleteEventModal = false;
    this.eventPendingDelete = null;
    this.refreshView();
  }

  async confirmDeleteCalendarEvent() {
    const event = this.eventPendingDelete;
    if (!event || this.isDeletingEvent) return;

    this.isDeletingEvent = true;
    this.refreshView();

    try {
      const { success, error } = await this.withTimeout(
        this.supabase.deleteCalendarEvent(event.id),
        30000,
        'Delete event'
      );

      if (!success || error) throw error || new Error('Delete failed');

      // Optimistic UI update.
      this.calendarEvents = this.calendarEvents.filter((e: any) => e.id !== event.id);
      this.isDeletingEvent = false;
      this.showDeleteEventModal = false;
      this.eventPendingDelete = null;
      this.showCalendarEventModal = false;
      this.selectedCalendarEvent = null;
      this.displayNotification('Event deleted successfully', 'success');
      this.refreshView();

      // Refresh upcoming sessions sidebar in the background.
      void this.loadCalendarEvents();
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      const message = (error as any)?.message?.includes('timed out')
        ? (error as any).message
        : 'Failed to delete event. Please try again.';
      this.displayNotification(message, 'error');
    } finally {
      this.isDeletingEvent = false;
      this.refreshView();
    }
  }

  // Calendar event loading
  async loadCalendarEvents() {
    try {
      const userId = await this.supabase.getCurrentUserId();
      if (!userId) return;

      console.log('=== Loading Calendar Events ===');
      console.log('Current User ID:', userId);
      console.log('Is Mentor:', this.isMentor);

      // Get user's own events
      const { data, error } = await this.supabase.getUserCalendarEvents(userId);
      
      if (error) {
        console.error('Error loading calendar events:', error);
        return;
      }

      console.log('User Own Events:', data);

      let allEvents = data || [];

      // If user is a mentee, also load events from connected mentors
      if (!this.isMentor) {
        console.log('User is MENTEE - fetching connected mentors events...');
        
        // First, let's get the connections manually to debug
        const { data: connections, error: connError } = await this.supabase.getClient()
          .from('connections')
          .select('*')
          .eq('mentee_user_id', userId)
          .eq('status', 'connected');
        
        console.log('Direct Connections Query:', connections);
        
        // Extract mentor IDs and fetch mentor profiles
        let mentorProfiles: any[] = [];
        // Distinct colors for mentors
        const mentorColors = ['#29CC39', '#33BFFF', '#FF6633', '#A855F7', '#F59E0B', '#EC4899', '#10B981', '#06B6D4', '#8B5CF6'];
        
        if (connections && connections.length > 0) {
          const mentorIds = connections.map((c: any) => c.mentor_user_id);
          console.log('Extracted Mentor IDs:', mentorIds);
          
          // Get mentor profiles for names and profile pictures
          const { data: profiles } = await this.supabase.getClient()
            .from('mentor_profiles')
            .select('user_id, full_name, profile_picture')
            .in('user_id', mentorIds);
          
          mentorProfiles = profiles || [];
          
          // Check ALL events in calendar_events table
          const { data: allEventsCheck } = await this.supabase.getClient()
            .from('calendar_events')
            .select('*');
          
          console.log('ALL Calendar Events in DB:', allEventsCheck);
        }
        
        const { data: mentorEvents, error: mentorError } = await this.supabase.getConnectedMentorsCalendarEvents(userId);
        
        console.log('Mentor Events Result:', mentorEvents);
        console.log('Mentor Events Error:', mentorError);
        
        if (!mentorError && mentorEvents && mentorEvents.length > 0) {
          // Create a map for mentor ID -> name, color, and profile picture
          const mentorMap = new Map<string, { name: string; color: string; profilePicture?: string }>();
          mentorProfiles.forEach((mentor, index) => {
            mentorMap.set(mentor.user_id, {
              name: mentor.full_name || 'Mentor',
              color: mentorColors[index % mentorColors.length],
              profilePicture: mentor.profile_picture
            });
          });

          // Mark mentor events so we can style them differently or show who created them
          const markedMentorEvents = mentorEvents.map((event: any) => {
            const mentorInfo = mentorMap.get(event.user_id) || { name: 'Mentor', color: '#29CC39', profilePicture: undefined };
            return {
              ...event,
              isFromMentor: true,
              mentorName: mentorInfo.name,
              mentorColor: mentorInfo.color,
              mentorProfilePicture: mentorInfo.profilePicture
            };
          });
          
          console.log('Marked Mentor Events:', markedMentorEvents);
          
          // Combine user's events with mentor events
          allEvents = [...allEvents, ...markedMentorEvents];
          console.log('Combined All Events:', allEvents);
        } else {
          console.log('No mentor events found or error occurred');
        }
      }

      // Convert database events to calendar display format
      const weekStart = this.getWeekStart(this.getCalendarReferenceDate());

      this.calendarEvents = allEvents.map((dbEvent: any) => {
        const eventDateTime = this.parseEventDateTime(dbEvent.event_date, dbEvent.start_time);
        const startHours = eventDateTime.getHours();

        // Calculate duration
        let durationHours = 1;
        if (dbEvent.end_time) {
          const [endHours, endMinutes] = String(dbEvent.end_time).split(':').map(Number);
          const startTimeInMinutes = startHours * 60 + eventDateTime.getMinutes();
          const endTimeInMinutes = endHours * 60 + endMinutes;
          durationHours = (endTimeInMinutes - startTimeInMinutes) / 60;
        }

        const eventDayStart = new Date(
          eventDateTime.getFullYear(),
          eventDateTime.getMonth(),
          eventDateTime.getDate()
        );
        const daysDiff = Math.round(
          (eventDayStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Type-safe event type
        const rawEventType = dbEvent.event_type || 'personal';
        const eventType = (['mentorship', 'personal', 'reminder'].includes(rawEventType) 
          ? rawEventType 
          : 'personal') as 'mentorship' | 'personal' | 'reminder';

        // Generate badges
        const badges: string[] = [];
        if (dbEvent.place) badges.push('LOC');
        if (dbEvent.notes) badges.push('NOTE');

        return {
          id: dbEvent.id,
          day: daysDiff,
          startHour: startHours,
          durationHours: durationHours,
          title: dbEvent.title,
          color: dbEvent.isFromMentor && dbEvent.mentorColor 
            ? dbEvent.mentorColor 
            : dbEvent.color,
          badges: badges,
          avatars: dbEvent.members?.length || 1,
          compact: durationHours <= 1,
          place: dbEvent.place,
          notes: dbEvent.notes,
          date: dbEvent.event_date,
          startTime: dbEvent.start_time,
          endTime: dbEvent.end_time,
          isFromMentor: dbEvent.isFromMentor || false,
          ownerId: dbEvent.user_id,
          eventType: eventType,
          mentorName: dbEvent.mentorName,
          mentorProfilePicture: dbEvent.mentorProfilePicture
        };
      }).filter((event: any) => event.day >= 0 && event.day <= 6); // Only show events in current week

      console.log('Final Calendar Events for Display:', this.calendarEvents);

      // Load upcoming sessions for the sidebar
      this.loadUpcomingSessions(allEvents);
      this.refreshView();

    } catch (error: any) {
      console.error('Error loading calendar events:', error);
      this.refreshView();
    }
  }

  /** Parse YYYY-MM-DD + HH:MM as a local Date (avoids UTC date-only shift). */
  private parseEventDateTime(eventDate: string | Date, startTime?: string): Date {
    const datePart = String(eventDate).slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    let hours = 0;
    let minutes = 0;
    if (startTime) {
      const parts = String(startTime).split(':').map(Number);
      hours = parts[0] || 0;
      minutes = parts[1] || 0;
    }
    return new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
  }

  /** Monday 00:00 local for the week containing `from`. */
  private getWeekStart(from: Date): Date {
    const dayOfWeek = from.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  // Load upcoming sessions from calendar events (real now + this week)
  loadUpcomingSessions(events: any[]) {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const thisWeekUpcoming = events
      .map((event: any) => ({
        event,
        at: this.parseEventDateTime(event.event_date, event.start_time)
      }))
      .filter(({ at }) => at > now && at < weekEnd)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map(({ event }) => event);

    // Convert to upcoming sessions format (limit to 3 soonest this week)
    this.upcomingSessions = thisWeekUpcoming.slice(0, 3).map((event: any) => {
      const eventDate = this.parseEventDateTime(event.event_date);
      const dateOptions: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      const formattedDate = eventDate.toLocaleDateString('en-US', dateOptions);

      // Format time
      let timeString = '';
      if (event.start_time) {
        const [startHours, startMinutes] = String(event.start_time).split(':').map(Number);
        const startPeriod = startHours >= 12 ? 'PM' : 'AM';
        const startHours12 = startHours % 12 || 12;
        timeString = `${startHours12}:${startMinutes.toString().padStart(2, '0')}${startPeriod}`;
        
        if (event.end_time) {
          const [endHours, endMinutes] = String(event.end_time).split(':').map(Number);
          const endPeriod = endHours >= 12 ? 'PM' : 'AM';
          const endHours12 = endHours % 12 || 12;
          timeString += ` – ${endHours12}:${endMinutes.toString().padStart(2, '0')}${endPeriod}`;
        }
      }

      return {
        mentorName: event.isFromMentor
          ? (event.mentorName || event.title)
          : event.title,
        isActive: false,
        date: formattedDate,
        time: timeString,
        platform: event.place || 'Virtual Meeting',
        notes: event.notes || '',
        mentorProfilePicture: event.mentorProfilePicture || '',
        eventType: event.event_type || 'mentorship'
      };
    });

    this.upcomingSessionsCount = thisWeekUpcoming.length;
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
      this.refreshView();
    }, 3000);

    this.refreshView();
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
    color: '#29CC39',
    eventType: 'mentorship' as 'mentorship' | 'personal' | 'reminder'
  };

  availableColors = ['#29CC39', '#33BFFF', '#FF6633', '#A855F7', '#F59E0B', '#EC4899', '#10B981'];
  currentColorIndex = 0;

  calendarEvents: Array<{
    id?: string;
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
    startTime?: string;
    endTime?: string;
    isFromMentor?: boolean;
    ownerId?: string;
    eventType?: 'mentorship' | 'personal' | 'reminder';
    mentorName?: string;
    mentorProfilePicture?: string;
  }> = [];

  formatCalendarHour(hour: number): string {
    return `${hour < 10 ? '0' : ''}${hour}`;
  }

  private getCalendarReferenceDate(): Date {
    return new Date(this.calendarAnchorDate);
  }

  private setCalendarAnchorToToday(): void {
    this.calendarAnchorDate = new Date();
  }

  initializeCurrentWeek(): void {
    const weekStart = this.getWeekStart(this.getCalendarReferenceDate());
    
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

  getCalendarEventDateLabel(event: { date?: string }): string {
    if (!event.date) return 'Unknown date';
    const parsedDate = new Date(event.date);
    return parsedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getCalendarEventSourceLabel(event: { isFromMentor?: boolean; mentorName?: string }): string {
    if (event.isFromMentor) {
      return event.mentorName ? `Created by ${event.mentorName}` : 'Created by mentor';
    }
    return 'Created by you';
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

  cycleEventColor(): void {
    this.currentColorIndex = (this.currentColorIndex + 1) % this.availableColors.length;
    this.newEvent.color = this.availableColors[this.currentColorIndex];
  }

  async createEvent(): Promise<void> {
    if (!this.isMentor) {
      this.displayNotification('Only mentors can create mentoring sessions', 'warning');
      return;
    }

    if (!this.newEvent.title || !this.newEvent.date || !this.newEvent.startTime) {
      this.displayNotification('Please fill in Title, Date, and Start Time', 'warning');
      return;
    }

    const eventDate = this.parseEventDateTime(this.newEvent.date, this.newEvent.startTime);
    const [startHours, startMinutes] = this.newEvent.startTime.split(':').map(Number);
    let durationHours = 1;

    if (this.newEvent.endTime) {
      const [endHours, endMinutes] = this.newEvent.endTime.split(':').map(Number);
      const startTimeInMinutes = startHours * 60 + startMinutes;
      const endTimeInMinutes = endHours * 60 + endMinutes;

      if (endTimeInMinutes <= startTimeInMinutes) {
        this.displayNotification('End time must be after start time', 'warning');
        return;
      }

      durationHours = (endTimeInMinutes - startTimeInMinutes) / 60;
    }

    const weekStart = this.getWeekStart(this.getCalendarReferenceDate());
    const eventDayStart = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate()
    );
    const daysDiff = Math.round(
      (eventDayStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    try {
      const userId = await this.supabase.getCurrentUserId();
      if (!userId) {
        this.displayNotification('Please log in to create sessions', 'error');
        return;
      }

      const { error } = await this.supabase.createCalendarEvent({
        user_id: userId,
        title: this.newEvent.title,
        place: this.newEvent.place || undefined,
        event_date: this.newEvent.date,
        start_time: this.newEvent.startTime,
        end_time: this.newEvent.endTime || undefined,
        members: this.newEvent.members,
        notes: this.newEvent.notes || undefined,
        color: this.newEvent.color,
        event_type: 'mentorship'
      });

      if (error) {
        this.displayNotification('Failed to create session', 'error');
        return;
      }

      if (daysDiff < 0 || daysDiff > 6) {
        this.calendarAnchorDate = new Date(
          eventDate.getFullYear(),
          eventDate.getMonth(),
          eventDate.getDate()
        );
      }

      this.newEvent = {
        title: '',
        place: '',
        date: '',
        startTime: '',
        endTime: '',
        members: [],
        notes: '',
        color: this.availableColors[0],
        eventType: 'mentorship'
      };
      this.currentColorIndex = 0;

      await this.loadCalendarEvents();
      this.displayNotification('Session created successfully', 'success');
    } catch (error) {
      console.error('Error creating session:', error);
      this.displayNotification('Failed to create session', 'error');
    }
  }

  getCalendarHourLinePercent(index: number): number {
    return (index / this.calendarSlotCount) * 100;
  }

  setCalendarView(mode: 'day' | 'week') {
    this.calendarViewMode = mode;
    this.renderCalendarView();
  }

  initializeCurrentDay(): void {
    const now = this.getCalendarReferenceDate();
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
  currentPage = 1;
  pageSize = 4;

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

  get filteredMentors() {
    return this.recommendedMentors
      .map((mentor: any) => this.normalizeMentorCard(mentor))
      .filter((mentor: any) => {
        const matchName = this.matchesNameSearch(
          mentor.searchName || mentor.name,
          mentor.name,
          this.mentorSearchQuery
        );
        const matchSkills = this.selectedSkills.length === 0
          || this.selectedSkills.every(skill => mentor.skills.includes(skill));
        return matchName && matchSkills;
      });
  }

  /** Flexible name match: tokens can appear in any order; middle names optional. */
  private matchesNameSearch(fullName: string, displayName: string, query: string): boolean {
    const q = (query || '').trim().toLowerCase();
    if (!q) return true;

    const haystack = `${fullName || ''} ${displayName || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (haystack.includes(q)) return true;

    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every(token => haystack.includes(token));
  }

  private renderCalendarView(): void {
    if (this.calendarViewMode === 'day') {
      this.initializeCurrentDay();
    } else {
      this.initializeCurrentWeek();
    }
    this.loadCalendarEvents();
  }

  goToPreviousCalendarPeriod(): void {
    const anchor = this.getCalendarReferenceDate();
    if (this.calendarViewMode === 'day') {
      anchor.setDate(anchor.getDate() - 1);
    } else {
      anchor.setDate(anchor.getDate() - 7);
    }
    this.calendarAnchorDate = anchor;
    this.renderCalendarView();
  }

  goToNextCalendarPeriod(): void {
    const anchor = this.getCalendarReferenceDate();
    if (this.calendarViewMode === 'day') {
      anchor.setDate(anchor.getDate() + 1);
    } else {
      anchor.setDate(anchor.getDate() + 7);
    }
    this.calendarAnchorDate = anchor;
    this.renderCalendarView();
  }

  goToToday(): void {
    this.setCalendarAnchorToToday();
    this.renderCalendarView();
  }

  get pagedMentors() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredMentors.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMentors.length / this.pageSize));
  }

  private normalizeMentorCard(mentor: any) {
    const rawName = mentor.full_name || mentor.mentee_name || mentor.name || mentor.title || 'User';
    const expertise = mentor.expertise || mentor.desired_expertise || mentor.role || 'Mentor';
    const skills = Array.isArray(mentor.skills)
      ? mentor.skills
      : Array.isArray(mentor.desired_skills)
        ? mentor.desired_skills
        : [];

    return {
      ...mentor,
      user_id: mentor.user_id,
      searchName: rawName,
      name: this.stripMiddleName(rawName),
      role: expertise,
      expertise,
      bio: mentor.bio || mentor.description || `Matched ${this.isMentor ? 'mentee' : 'mentor'} profile`,
      skills,
      rating: mentor.rating ?? 0,
      reviews: mentor.reviews ?? 0
    };
  }

  removeSkill(skill: string) { this.selectedSkills = this.selectedSkills.filter(s => s !== skill); }

  addSkillFromSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const skill = select.value.trim();
    if (!skill || this.selectedSkills.includes(skill)) return;
    this.selectedSkills = [...this.selectedSkills, skill];
    select.value = '';
    this.currentPage = 1;
  }

  onMentorSearchChange() {
    this.currentPage = 1;
  }

  resetFilters() { this.mentorSearchQuery = ''; this.selectedExpertise = ''; this.selectedSkills = []; this.currentPage = 1; }
  goToPage(page: number) { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }
  getPages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }

  // ─── Messages ──────────────────────────────────────────────────────────────
  chatSearchQuery = '';
  newMessageText = '';
  totalUnreadMessages = 0;

  // Dynamic conversations from connected users
  conversations: any[] = [];
  
  activeConversation: any = null;

  messages: { id: string | number; text: string; fromMe: boolean; timestamp?: string; status?: string; isPlaceholder?: boolean }[] = [];
  private lastMessageCursor: { createdAt: number; id: string | number } | null = null;

  get filteredConversations() {
    if (!this.chatSearchQuery) return this.conversations;
    return this.conversations.filter(c => c.name.toLowerCase().includes(this.chatSearchQuery.toLowerCase()));
  }

  async selectConversation(conv: any) { 
    this.activeConversation = conv;
    if (!this.currentUserId) {
      this.currentUserId = await this.supabase.getCurrentUserId() || '';
    }
    await this.loadMessages(conv.id);
    // Mark messages as seen when opening conversation
    if (this.currentUserId) {
      await this.supabase.markMessagesAsSeen(conv.id, this.currentUserId);
    }
    // Update unread count for this conversation
    conv.unreadCount = 0;
    this.updateTotalUnreadCount();
    this.refreshView();
  }

  async loadMessages(userId: string) {
    const myId = this.currentUserId || await this.supabase.getCurrentUserId();
    if (!myId) return;
    this.currentUserId = myId;

    const { data, error } = await this.supabase.getMessages(myId, userId);
    if (error) {
      console.error('Error loading messages:', error);
      this.displayNotification('Failed to load messages', 'error');
      return;
    }
    this.messages = (data || []).map((msg: any) => ({
      id: msg.id,
      text: msg.message,
      fromMe: msg.sender_id === myId,
      timestamp: msg.created_at,
      status: msg.status
    }));
    const latestMessage = this.messages[this.messages.length - 1];
    this.lastMessageCursor = latestMessage?.timestamp
      ? { createdAt: new Date(latestMessage.timestamp).getTime(), id: latestMessage.id }
      : null;
    this.scheduleMessagesScroll();
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
    this.scheduleMessagesScroll();
    this.refreshView();

    try {
      const result = await this.supabase.sendMessage(this.activeConversation.id, message);

      if (result.error || !result.data) {
        this.messages = this.messages.filter(m => m.id !== tempId);
        this.displayNotification('Failed to send message', 'error');
        this.refreshView();
        return;
      }

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

      // Update conversation preview
      this.activeConversation.lastMessage = message;
      const conv = this.conversations.find(c => c.id === this.activeConversation.id);
      if (conv) conv.lastMessage = message;

      this.scheduleMessagesScroll();
      this.refreshView();
    } catch (error) {
      console.error('Error sending message:', error);
      this.messages = this.messages.filter(m => m.id !== tempId);
      this.displayNotification('Failed to send message', 'error');
      this.refreshView();
    }
  }

  updateTotalUnreadCount() {
    this.totalUnreadMessages = this.conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
    this.unreadMessages = this.totalUnreadMessages;
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
  private resourceSetupWarningShown = false;
  
  // Edit modal
  showResourcesEditModal = false;
  editingResourceMaterial: any = null;
  resourceEditTitle = '';
  resourceEditDescription = '';
  resourceEditOrderNumber = '';
  resourceEditDuration: number | null = null;

  // Delete confirmation modal
  showDeleteMaterialModal = false;
  materialPendingDelete: any = null;
  isDeletingMaterial = false;

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
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private appRef: ApplicationRef
  ) {}

  /** Force the UI to update after async work (Supabase, timeouts, etc.). */
  private refreshView(): void {
    this.zone.run(() => {
      try {
        this.cdr.detectChanges();
      } catch {
        // Component may be mid-destroy.
      }
      try {
        this.appRef.tick();
      } catch {
        // Ignore if a tick is already in progress.
      }
    });
  }

  private setDashboardScrollLock(enabled: boolean): void {
    document.body.classList.toggle(this.dashboardBodyClass, enabled);
  }

  async ngOnInit() {
    this.isLoading = true;
    try {
      await this.loadUserProfile();

      await Promise.all([
        this.loadMatchedUsers(),
        this.loadConnections(),
        this.loadCalendarEvents()
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
        // Refresh connections so online status stays current on dashboard + messages
        if (this.activeNavItem === 'messages' || this.activeNavItem === 'dashboard') {
          this.loadConnections();
          if (this.activeNavItem === 'messages' && this.activeConversation) {
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
    } finally {
      this.isLoading = false;
      this.refreshView();
    }
  }

  async checkForNewMessages() {
    if (!this.activeConversation) return;

    const lastMessage = this.messages[this.messages.length - 1];
    const lastCreatedAt = lastMessage?.timestamp
      ? new Date(lastMessage.timestamp).getTime()
      : (this.lastMessageCursor?.createdAt || 0);
    const myId = this.currentUserId || await this.supabase.getCurrentUserId();
    if (!myId) return;

    const { data } = await this.supabase.getMessages(myId, this.activeConversation.id);
    const existingIds = new Set(this.messages.map(m => String(m.id)));
    const newMessages = (data || []).filter((msg: any) => {
      if (existingIds.has(String(msg.id))) return false;
      return new Date(msg.created_at).getTime() > lastCreatedAt;
    });

    if (newMessages.length > 0) {
      newMessages.forEach((msg: any) => {
        this.messages.push({
          id: msg.id,
          text: msg.message,
          fromMe: msg.sender_id === myId,
          timestamp: msg.created_at,
          status: msg.status
        });
      });

      const latest = newMessages[newMessages.length - 1];
      this.activeConversation.lastMessage = latest.message;
      const conv = this.conversations.find(c => c.id === this.activeConversation.id);
      if (conv) conv.lastMessage = latest.message;

      await this.supabase.markMessagesAsSeen(this.activeConversation.id, myId);
      const newestMessage = this.messages[this.messages.length - 1];
      this.lastMessageCursor = newestMessage?.timestamp
        ? { createdAt: new Date(newestMessage.timestamp).getTime(), id: newestMessage.id }
        : this.lastMessageCursor;
      this.scheduleMessagesScroll();
      this.refreshView();
    }
  }

  async updateAllUnreadCounts() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;

    for (const conv of this.conversations) {
      conv.unreadCount = await this.supabase.getUnreadCount(userId, conv.id);
    }

    this.updateTotalUnreadCount();
    this.refreshView();
  }

  ngOnDestroy() {
    if (this.lastSeenInterval) clearInterval(this.lastSeenInterval);
    if (this.nowLineInterval) clearInterval(this.nowLineInterval);
    this.setDashboardScrollLock(false);
  }

  ngAfterViewChecked() {
    if (this.shouldScrollMessages && this.messagesScrollContainer?.nativeElement) {
      this.shouldScrollMessages = false;
      if (this.messageScrollFrame !== null) {
        cancelAnimationFrame(this.messageScrollFrame);
      }
      this.messageScrollFrame = requestAnimationFrame(() => {
        this.messageScrollFrame = requestAnimationFrame(() => {
          this.scrollMessagesToBottom();
        });
      });
    }

    // Check if we should scroll the calendar and if the element is now available
    if (this.shouldScrollCalendar && this.calendarScrollContainer?.nativeElement) {
      this.shouldScrollCalendar = false;
      // Use setTimeout to ensure Angular has finished all DOM updates
      setTimeout(() => {
        this.scrollCalendarToCurrentTime();
      }, 0);
    }
  }

  private scrollMessagesToBottom(): void {
    const container = this.messagesScrollContainer?.nativeElement;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }

  private scheduleMessagesScroll(): void {
    this.shouldScrollMessages = true;
    this.refreshView();
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  async setActiveNav(id: string) { 
    this.activeNavItem = id;
    this.setDashboardScrollLock(id === 'messages');
    if (id === 'messages') {
      await this.loadConnections();
      if (this.messages.length > 0) {
        this.scheduleMessagesScroll();
      }
    }

    // Keep upcoming sessions / calendar in sync with real time
    if (id === 'dashboard' || id === 'calendar') {
      void this.loadCalendarEvents();
    }
    
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
  onViewAllSessions() { this.setActiveNav('calendar'); }
  onViewAllOnline() { this.setActiveNav('messages'); }
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
    this.currentPage = 1;

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
      this.refreshView();
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
        this.refreshView();
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
          this.refreshView();
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
        this.refreshView();
      } catch (error) {
        console.error('Error loading ratings:', error);
        // If error, just show mentors without ratings
        this.recommendedMentors = approvedMentors.map((m: any) => ({
          ...m,
          rating: 0,
          reviews: 0
        }));
        this.refreshView();
      }
    }
  }

  async loadConnections() {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) return;
    this.currentUserId = userId;

    const connections = await this.supabase.getMyConnections();
    this.myConnectionIds = new Set(
      connections.map((c: any) => c.mentee_user_id === userId ? c.mentor_user_id : c.mentee_user_id)
    );

    // Load profiles of connected users
    const ids = [...this.myConnectionIds];
    if (!ids.length) { 
      this.connectedUsers = []; 
      this.conversations = [];
      this.activeConversation = null;
      this.messages = [];
      this.updateTotalUnreadCount();
      this.refreshView();
      return; 
    }

    let role = this.userService.role();
    if (!role) {
      const meta = await this.supabase.getCurrentUserMeta();
      role = (meta.role as any) || '';
    }
    // If I'm a mentee, my connections are mentors, and vice versa
    const primaryTable = role === 'mentor' ? 'mentee_profiles' : 'mentor_profiles';
    const fallbackTable = role === 'mentor' ? 'mentor_profiles' : 'mentee_profiles';

    const { data, error } = await this.supabase.getClient()
      .from(primaryTable)
      .select('user_id,full_name,profile_picture,last_seen')
      .in('user_id', ids);

    if (error) {
      console.error('Error loading connection profiles:', error);
    }

    let profiles = data || [];

    // If some connected users are missing from the opposite-role table, try the other
    const foundIds = new Set(profiles.map((p: any) => p.user_id));
    const missingIds = ids.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      const { data: fallbackData } = await this.supabase.getClient()
        .from(fallbackTable)
        .select('user_id,full_name,profile_picture,last_seen')
        .in('user_id', missingIds);
      if (fallbackData?.length) {
        profiles = [...profiles, ...fallbackData];
      }
    }

    const users = profiles.map((u: any) => ({
      ...u,
      name: u.full_name?.trim() || `User ${u.user_id.slice(0, 8)}`,
      isOnline: this.isOnline(u.last_seen),
      lastSeenLabel: this.getLastSeenLabel(u.last_seen),
    }));

    // Keep any connected IDs that still have no profile row visible in the list
    const profileIds = new Set(users.map((u: any) => u.user_id));
    for (const id of ids) {
      if (!profileIds.has(id)) {
        users.push({
          user_id: id,
          name: `User ${id.slice(0, 8)}`,
          isOnline: false,
          lastSeenLabel: 'Unknown',
          profile_picture: null
        });
      }
    }

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

    // Keep active conversation in sync after refresh
    if (this.activeConversation) {
      const stillConnected = this.conversations.find(c => c.id === this.activeConversation.id);
      if (stillConnected) {
        this.activeConversation = stillConnected;
      } else {
        this.activeConversation = null;
        this.messages = [];
      }
    }

    if (!this.activeConversation && this.conversations.length > 0 && this.activeNavItem === 'messages') {
      await this.selectConversation(this.conversations[0]);
    }
    this.refreshView();
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
  async onMessage(user: any) {
    const otherId = user.user_id;
    if (!otherId) return;

    await this.setActiveNav('messages');

    let conversation = this.conversations.find(c => c.id === otherId);
    if (!conversation) {
      conversation = {
        id: otherId,
        name: user.name || user.full_name || 'User',
        status: user.isOnline ? 'Active Now' : (user.lastSeenLabel || 'Offline'),
        isOnline: !!user.isOnline,
        lastMessage: 'No messages yet',
        profile_picture: user.profile_picture,
        unreadCount: 0
      };
      this.conversations = [conversation, ...this.conversations];
    }

    await this.selectConversation(conversation);
  }

  // ─── Resources / Learning Materials Methods ────────────────────────────────

  private handleResourceSetupError(error: any): boolean {
    const message = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
    const isMissingSetup =
      error?.status === 404 ||
      message.includes('learning_materials') ||
      message.includes('material_progress') ||
      message.includes('bucket not found');

    if (!isMissingSetup) return false;

    if (!this.resourceSetupWarningShown) {
      this.resourceSetupWarningShown = true;
      this.displayNotification('Learning Materials setup is missing in Supabase.', 'error');
    }

    return true;
  }
  
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
    this.refreshView();
  }

  async selectResourceMentor(mentorId: string) {
    this.selectedResourceMentorId = mentorId;
    await this.loadResourceMaterialsForMentee();
  }

  async loadResourceMaterials() {
    const { data, error } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.currentUserId)
      .order('order_number', { ascending: true });

    if (error) {
      if (this.handleResourceSetupError(error)) {
        this.resourceMaterials = [];
        return;
      }
      console.error('Error loading resource materials:', error);
      return;
    }

    this.resourceMaterials = data || [];
    this.refreshView();
  }

  async loadResourceMaterialsForMentee() {
    if (!this.selectedResourceMentorId) return;

    const { data: materialsData, error: materialsError } = await this.supabase.getClient()
      .from('learning_materials')
      .select('*')
      .eq('mentor_user_id', this.selectedResourceMentorId)
      .order('order_number', { ascending: true });

    if (materialsError) {
      if (this.handleResourceSetupError(materialsError)) {
        this.resourceMaterials = [];
        return;
      }
      console.error('Error loading mentor materials:', materialsError);
      return;
    }

    const { data: progressData, error: progressError } = await this.supabase.getClient()
      .from('material_progress')
      .select('material_id, completed')
      .eq('mentee_user_id', this.currentUserId);

    if (progressError) {
      if (this.handleResourceSetupError(progressError)) {
        this.resourceMaterials = [];
        return;
      }
      console.error('Error loading material progress:', progressError);
      return;
    }

    const progressMap = new Map(
      (progressData || []).map((p: any) => [p.material_id, p.completed])
    );

    this.resourceMaterials = (materialsData || []).map(m => ({
      ...m,
      completed: progressMap.get(m.id) || false
    }));
    this.refreshView();
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
    this.refreshView();
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

  private withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} timed out. Please check your connection and try again.`)),
        ms
      );
      Promise.resolve(promise).then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  async uploadResourceMaterial() {
    if (this.isResourceUploading) return;

    if (!this.resourceUploadTitle || !this.resourceUploadFile || !this.resourceUploadOrderNumber) {
      this.displayNotification('Please fill in all required fields', 'warning');
      return;
    }

    this.isResourceUploading = true;
    this.refreshView();

    const fileToUpload = this.resourceUploadFile;

    try {
      const userId = this.currentUserId || await this.supabase.getCurrentUserId();
      if (!userId) {
        this.displayNotification('Please log in to upload materials', 'error');
        return;
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await this.withTimeout(
        this.supabase.getClient()
          .storage
          .from('learning-materials')
          .upload(filePath, fileToUpload, {
            upsert: false,
            contentType: fileToUpload.type || undefined
          }),
        120000,
        'Upload'
      );

      if (uploadError) throw uploadError;

      const { data: urlData } = this.supabase.getClient()
        .storage
        .from('learning-materials')
        .getPublicUrl(filePath);

      const fileType = this.getResourceFileType(fileExt || '');

      const { data: inserted, error: insertError } = await this.withTimeout(
        this.supabase.getClient()
          .from('learning_materials')
          .insert({
            mentor_user_id: userId,
            title: this.resourceUploadTitle,
            description: this.resourceUploadDescription,
            order_number: this.resourceUploadOrderNumber,
            file_url: urlData.publicUrl,
            file_type: fileType,
            file_name: fileToUpload.name,
            duration_minutes: this.resourceUploadDuration
          })
          .select('*')
          .single(),
        30000,
        'Saving material'
      );

      if (insertError) throw insertError;

      // Optimistic UI — close panel + toast before any background reloads.
      if (inserted) {
        this.resourceMaterials = [...this.resourceMaterials, inserted].sort((a, b) =>
          String(a.order_number).localeCompare(String(b.order_number), undefined, { numeric: true })
        );
      }
      this.isResourceUploading = false;
      this.closeResourcesUploadModal();
      this.displayNotification('Material uploaded successfully', 'success');
      this.refreshView();

      void this.loadResourceMenteesProgress();
    } catch (error) {
      console.error('Error uploading material:', error);
      if (!this.handleResourceSetupError(error)) {
        const message = (error as any)?.message?.includes('timed out')
          ? (error as any).message
          : 'Failed to upload material. Please try again.';
        this.displayNotification(message, 'error');
      }
    } finally {
      this.isResourceUploading = false;
      this.refreshView();
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
      this.displayNotification('Please fill in all required fields', 'warning');
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

      this.displayNotification('Material updated successfully', 'success');
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
      this.displayNotification('Failed to update material. Please try again.', 'error');
    } finally {
      this.refreshView();
    }
  }

  askDeleteResourceMaterial(material: any) {
    this.materialPendingDelete = material;
    this.showDeleteMaterialModal = true;
    this.refreshView();
  }

  cancelDeleteResourceMaterial() {
    this.showDeleteMaterialModal = false;
    this.materialPendingDelete = null;
    this.refreshView();
  }

  async confirmDeleteResourceMaterial() {
    const material = this.materialPendingDelete;
    if (!material || this.isDeletingMaterial) return;

    this.isDeletingMaterial = true;
    this.refreshView();

    try {
      const { error } = await this.withTimeout(
        this.supabase.getClient()
          .from('learning_materials')
          .delete()
          .eq('id', material.id),
        30000,
        'Delete'
      );

      if (error) throw error;

      // Optimistic UI update — don't wait on list reloads to clear the modal.
      const deletedId = material.id;
      this.resourceMaterials = this.resourceMaterials.filter(m => m.id !== deletedId);
      this.modalMaterials = this.modalMaterials.filter(m => m.id !== deletedId);
      this.updateModalProgress();
      this.isDeletingMaterial = false;
      this.showDeleteMaterialModal = false;
      this.materialPendingDelete = null;
      this.displayNotification('Material deleted successfully', 'success');
      this.refreshView();

      // Best-effort file cleanup (must not block UI).
      const filePath = material.file_url?.split('/learning-materials/')[1];
      if (filePath) {
        void this.supabase.getClient()
          .storage
          .from('learning-materials')
          .remove([filePath]);
      }

      // Background refresh (UI already updated).
      void this.loadResourceMenteesProgress();
    } catch (error) {
      console.error('Error deleting material:', error);
      const message = (error as any)?.message?.includes('timed out')
        ? (error as any).message
        : 'Failed to delete material. Please try again.';
      this.displayNotification(message, 'error');
    } finally {
      this.isDeletingMaterial = false;
      this.refreshView();
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
      this.refreshView();
    } catch (error) {
      console.error('Error toggling completion:', error);
      this.displayNotification('Failed to update progress. Please try again.', 'error');
    }
  }

  getTotalMaterialMinutes(): number {
    return this.resourceMaterials.reduce(
      (sum, m) => sum + (Number(m.duration_minutes) || 0),
      0
    );
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

  getResourceFileIconName(fileType: string): string {
    switch (fileType) {
      case 'video': return 'video';
      case 'pdf': return 'pdf';
      case 'document': return 'document';
      case 'image': return 'image';
      default: return 'file';
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
    this.refreshView();
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
    this.refreshView();
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
      this.refreshView();
      
      // Reload mentor list to update progress
      await this.loadResourceMentors();
    } catch (error) {
      console.error('Error toggling completion:', error);
      this.displayNotification('Failed to update progress. Please try again.', 'error');
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
    this.refreshView();
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

import { Component, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ChatMessage {
  type: 'bot' | 'user';
  text: string;
  time: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;
  
  private readonly API_URL = 'https://api.cerebras.ai/v1/chat/completions';
  private readonly API_KEY = 'csk-3xwf2fc45phvc6n8v5kyknf5y4p5enfy2ewf565nch86hr6m';
  private conversationHistory: Array<{role: string, content: string}> = [];

  isOpen = signal(false);
  isMinimized = signal(false);
  userMessage = signal('');
  isTyping = signal(false);
  messages = signal<ChatMessage[]>([
    {
      type: 'bot',
      text: 'Hi! 👋 I\'m your EdTech assistant. Ask me how the platform works — signing up, finding a mentor, booking sessions, learning materials, and more. I can also help with general questions and math!',
      time: this.getCurrentTime()
    }
  ]);

  constructor(private http: HttpClient) {
    this.conversationHistory.push({
      role: 'system',
      content: `You are EdTech Assistant, the built-in guide for the "Learn, Connect, Grow" EdTech Mentoring Platform. Your main job is to explain how the platform works and help visitors get started. You can also answer general knowledge and math questions.

=== WHAT THE PLATFORM IS ===
An online mentoring platform that connects mentees (learners) with expert mentors. Core value: Feedback Mentorship, Expert Mentorship, and Progress Tracking. Users can find matches, message each other, book sessions on a shared calendar, share learning materials, and track progress.

=== ROLES ===
- Mentee: a learner looking to grow skills.
- Mentor: an expert who guides mentees (must be approved by an admin before appearing to mentees).
- Admin: reviews and approves/rejects mentor applications and oversees the platform.

=== GETTING STARTED (REGISTER & LOGIN) ===
1. Register with first name, last name, email, and password (middle name optional) and agree to the terms.
2. Log in with email + password, or use Google sign-in. There is a "Forgot password" option that emails a reset link.
3. After signing up you complete onboarding before reaching the dashboard.

=== ONBOARDING / PROFILES ===
- Choose your role: Mentee or Mentor.
- Mentee profile: your type (student, working professional, entrepreneur, etc.), university/company/job, the area of expertise and technical skills you want to learn.
- Mentor profile: job position, company, area of expertise, technical skills, years of experience, bio, photo, phone, and social links (GitHub/LinkedIn/Twitter).
- Everyone finishes a short "Journey" step: photo, date of birth, country, phone, gender.
- Mentors then upload documents (certifications required, diploma optional) and wait on a "Pending approval" screen until an admin approves them.

=== MAIN DASHBOARD FEATURES ===
- Find Mentors/Mentees: get recommended matches based on shared expertise or skills; search, filter (by expertise, skills, experience level), and connect. Mentees only see APPROVED mentors.
- Connections & Messages: connect with a match to open a 1-to-1 chat with unread counts, delivery/seen status, and online/last-seen indicators.
- Calendar / Sessions: mentors create sessions (title, place, date, time, notes); connected mentees see those sessions color-coded, plus an upcoming-sessions list.
- Library / Learning Materials: mentors upload materials (videos, PDFs, documents, images); mentees open/download them and mark items complete.
- Progress Tracking: mentees see their completion percentage per mentor; mentors see each mentee's progress.
- Feedback / Ratings: mentees give mentors a 1–5 star rating and optional written feedback; mentor profiles show average rating and reviews.
- Settings: edit your profile, change email/password, or delete your account.

=== ADMIN ===
Admins review mentor applications and their documents, then approve or reject them, and can see platform stats (total mentors/mentees).

=== HOW TO ANSWER ===
- Be friendly, concise, and helpful. Prefer short, step-by-step answers for "how do I..." questions.
- Use the information above as the source of truth for how the platform works. If asked about something truly not covered here, say you're not sure and suggest contacting support or exploring the dashboard, rather than inventing features.
- You can still help with general questions, learning topics, and math problems.`
    });
  }

  toggleChat() {
    this.isOpen.update(open => !open);
    this.isMinimized.set(false);
  }

  minimizeChat() {
    this.isMinimized.set(true);
  }

  maximizeChat() {
    this.isMinimized.set(false);
  }

  closeChat() {
    this.isOpen.set(false);
    this.isMinimized.set(false);
  }

  async sendMessage() {
    const message = this.userMessage().trim();
    if (!message || this.isTyping()) return;

    this.userMessage.set('');

    this.messages.update(msgs => [
      ...msgs,
      { type: 'user', text: message, time: this.getCurrentTime() }
    ]);

    this.isTyping.set(true);
    setTimeout(() => this.scrollToBottom(), 100);

    try {
      const botResponse = await this.getBotResponse(message);

      this.isTyping.set(false);
      this.messages.update(msgs => [
        ...msgs,
        { type: 'bot', text: botResponse, time: this.getCurrentTime() }
      ]);

      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('[Chatbot] sendMessage error:', error);

      this.isTyping.set(false);
      this.messages.update(msgs => [
        ...msgs,
        {
          type: 'bot',
          text: 'Sorry, something went wrong. Please try again.',
          time: this.getCurrentTime()
        }
      ]);
    }
  }

  private async getBotResponse(userMessage: string): Promise<string> {
    try {
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.API_KEY}`
      });

      const body = {
        model: 'zai-glm-4.7',
        messages: this.conversationHistory,
        temperature: 0.7,
        max_tokens: 500
      };

      const data: any = await firstValueFrom(
        this.http.post(this.API_URL, body, { headers })
      );

      const botMessage = data.choices[0]?.message?.content || 'Sorry, I couldn\'t process that.';

      this.conversationHistory.push({
        role: 'assistant',
        content: botMessage
      });

      return botMessage;
    } catch (error) {
      console.error('[Chatbot] Error:', error);
      return 'Sorry, I\'m having trouble connecting right now. Please try again later.';
    }
  }

  private getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  selectSuggestion(suggestion: string) {
    this.userMessage.set(suggestion);
    this.sendMessage();
  }

  private scrollToBottom() {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
    }
  }

  formatMessage(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
}

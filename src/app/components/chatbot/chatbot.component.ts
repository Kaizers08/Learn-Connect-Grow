import { environment } from '../../../environments/environment';
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
  
  private readonly API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly API_KEY = environment.groqApiKey;
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
      content: `You are EdTech Assistant for "Learn, Connect, Grow" — an online mentoring platform. Be friendly, concise, and helpful. Keep answers short and conversational. Do NOT use markdown tables or headers.

ROLES: Mentee (learner), Mentor (expert, must be approved by admin), Admin (approves mentors).

GETTING STARTED: Register with name/email/password or Google. After signup, complete onboarding: pick role → fill profile → (mentors upload documents and wait for admin approval) → dashboard.

DASHBOARD FEATURES:
- Find Mentors/Mentees: matched by expertise/skills, search and filter, connect.
- Messages: 1-to-1 chat with connected users, file attachments, seen/delivered status.
- Calendar: mentors create sessions; mentees see mentor sessions color-coded.
- Library: mentors upload learning materials; mentees view and mark complete (no download).
- Progress Tracking: mentees see completion % per mentor; mentors see mentee progress.
- Feedback: mentees rate mentors 1-5 stars with optional written review.
- Settings: edit profile, change password, delete account.

ADMIN: reviews mentor applications and documents, approves or rejects, views platform stats.

Answer general knowledge and math questions too. For coding help, suggest they bring it to their mentor.`
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

      // Keep only system prompt + last 6 messages to stay within token limits
      const systemMessage = this.conversationHistory[0];
      const recentMessages = this.conversationHistory.slice(-6);
      const messages = recentMessages[0]?.role === 'system'
        ? recentMessages
        : [systemMessage, ...recentMessages];

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization':`Bearer ${this.API_KEY}`
      });

      const body = {
        model: 'llama-3.1-8b-instant',
        messages: messages,
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
    } catch (error: any) {
      console.error('[Chatbot] Error:', error);
      console.error('[Chatbot] Error body:', JSON.stringify(error?.error));
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
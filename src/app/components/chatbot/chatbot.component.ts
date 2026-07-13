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
      text: 'Hi! 👋 I\'m your EdTech assistant. I can help you with general questions or solve math problems for you!',
      time: this.getCurrentTime()
    }
  ]);

  constructor(private http: HttpClient) {
    this.conversationHistory.push({
      role: 'system',
      content: `You are EdTech Assistant, a helpful AI chatbot for the EdTech Mentoring Platform. 
      
You can:
1. Answer general questions about any topic
2. Help with math problems and calculations
3. Provide information about learning and education

IMPORTANT: If users ask about specific features of the EdTech Mentoring Platform (like finding mentors, scheduling sessions, viewing profiles, etc.), politely inform them that "The system is still under development, and I don't have access to those features yet. However, I'm here to help with general questions and math problems!"

Keep responses friendly, concise, and helpful.`
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

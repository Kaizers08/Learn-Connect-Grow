import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  private readonly API_URL = 'https://api.cerebras.ai/v1/chat/completions';
  private readonly API_KEY = 'csk-3xwf2fc45phvc6n8v5kyknf5y4p5enfy2ewf565nch86hr6m';
  private conversationHistory: Array<{role: string, content: string}> = [];

  isOpen = false;
  isMinimized = false;
  userMessage = '';
  isTyping = false;
  
  messages: ChatMessage[] = [];

  constructor(private cdr: ChangeDetectorRef) {
    console.log('[Chatbot] Component initialized, isOpen:', this.isOpen);
    
    // Initialize system prompt
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

    // Add welcome message
    this.messages = [
      {
        type: 'bot',
        text: 'Hi! 👋 I\'m your EdTech assistant. I can help you with general questions or solve math problems for you!',
        time: this.getCurrentTime()
      }
    ];
  }

  toggleChat() {
    console.log('[Chatbot] toggleChat called, isOpen was:', this.isOpen);
    this.isOpen = !this.isOpen;
    console.log('[Chatbot] toggleChat, isOpen now:', this.isOpen);
    this.isMinimized = false;
  }

  minimizeChat() {
    this.isMinimized = true;
  }

  maximizeChat() {
    this.isMinimized = false;
  }

  closeChat() {
    this.isOpen = false;
    this.isMinimized = false;
  }

  async sendMessage() {
    if (!this.userMessage.trim() || this.isTyping) return;

    const message = this.userMessage.trim();
    this.userMessage = '';

    // Add user message
    this.messages.push({
      type: 'user',
      text: message,
      time: this.getCurrentTime()
    });

    // Show typing indicator
    this.isTyping = true;

    // Scroll to bottom
    setTimeout(() => this.scrollToBottom(), 100);

    try {
      // Get bot response
      const botResponse = await this.getBotResponse(message);

      console.log('[Chatbot] Got bot response:', botResponse);

      // Hide typing indicator and add bot message
      this.isTyping = false;
      this.messages.push({
        type: 'bot',
        text: botResponse,
        time: this.getCurrentTime()
      });

      console.log('[Chatbot] Messages array now:', this.messages);
      
      // Force change detection
      this.cdr.detectChanges();

      // Scroll to bottom
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('[Chatbot] sendMessage error:', error);
      this.isTyping = false;
      this.messages.push({
        type: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
        time: this.getCurrentTime()
      });
      this.cdr.detectChanges();
    }
  }

  private async getBotResponse(userMessage: string): Promise<string> {
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      console.log('[Chatbot] Sending request to Cerebras API...');

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
        },
        body: JSON.stringify({
          model: 'zai-glm-4.7',
          messages: this.conversationHistory,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      console.log('[Chatbot] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chatbot] API error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[Chatbot] API response:', data);
      
      const botMessage = data.choices[0]?.message?.content || 'Sorry, I couldn\'t process that.';

      // Add bot response to history
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
    this.userMessage = suggestion;
    this.sendMessage();
  }

  private scrollToBottom() {
    const messagesContainer = document.querySelector('.chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}

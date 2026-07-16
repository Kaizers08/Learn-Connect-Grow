import { Injectable } from '@angular/core';

export interface ChatMessage {
  type: 'bot' | 'user';
  text: string;
  time: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly API_URL = 'https://api.cerebras.ai/v1/chat/completions';
  private readonly API_KEY = 'csk-3xwf2fc45phvc6n8v5kyknf5y4p5enfy2ewf565nch86hr6m';
  
  private conversationHistory: Array<{role: string, content: string}> = [];

  constructor() {
    // Initialize with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: `You are EdTech Assistant, the built-in guide for the "Learn, Connect, Grow" EdTech Mentoring Platform. Your main job is to explain how the platform works and help visitors get started; you can also answer general knowledge and math questions.

The platform connects mentees (learners) with expert mentors. Users register (first/last name, email, password) or use Google sign-in, then complete onboarding: choose a role (Mentee or Mentor), fill in a profile (skills, expertise, experience), and finish a short "Journey" step. Mentors also upload documents and must be approved by an admin before mentees can see them.

On the dashboard users can: find and connect with recommended matches, message connections in 1-to-1 chat, book/view sessions on a shared calendar (mentors create sessions), share and complete learning materials in the Library, track progress, and leave star ratings + feedback for mentors. Admins approve or reject mentor applications.

Be friendly, concise, and helpful. Use the above as the source of truth; if something isn't covered, say you're not sure rather than inventing features.`
    });
  }

  async sendMessage(userMessage: string): Promise<string> {
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3.1-8b',
          messages: this.conversationHistory,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const botMessage = data.choices[0]?.message?.content || 'Sorry, I couldn\'t process that.';

      // Add bot response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: botMessage
      });

      return botMessage;
    } catch (error) {
      console.error('Chatbot error:', error);
      return 'Sorry, I\'m having trouble connecting right now. Please try again later.';
    }
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  clearHistory() {
    this.conversationHistory = [{
      role: 'system',
      content: this.conversationHistory[0].content
    }];
  }
}

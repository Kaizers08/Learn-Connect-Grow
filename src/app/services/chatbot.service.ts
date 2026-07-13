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
      content: `You are EdTech Assistant, a helpful AI chatbot for the EdTech Mentoring Platform. 
      
You can:
1. Answer general questions about any topic
2. Help with math problems and calculations
3. Provide information about learning and education

IMPORTANT: If users ask about specific features of the EdTech Mentoring Platform (like finding mentors, scheduling sessions, viewing profiles, etc.), politely inform them that "The system is still under development, and I don't have access to those features yet. However, I'm here to help with general questions and math problems!"

Keep responses friendly, concise, and helpful.`
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

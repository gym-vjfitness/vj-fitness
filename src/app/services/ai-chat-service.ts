import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface ChatPart { text: string; }
export interface ChatMessage { role: 'user' | 'model'; parts: ChatPart[]; }

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private http = inject(HttpClient);
  private storageKey = 'premium_gym_ai_history';

  private savedSessions = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
  
  sessions = signal<ChatSession[]>(this.savedSessions);
  activeSessionId = signal<string | null>(null);
  
  isLoading = signal<boolean>(false);
  isTyping = signal<boolean>(false);

  constructor() {
    this.loadHistory();
  }

  get activeMessages(): ChatMessage[] {
    const currentId = this.activeSessionId();
    const session = this.sessions().find(s => s.id === currentId);
    return session ? session.messages : [];
  }

  createNewChat() {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now()
    };
    this.sessions.update(s => [newSession, ...s]);
    this.activeSessionId.set(newSession.id);
    this.saveHistory();
  }

  selectChat(id: string) {
    this.activeSessionId.set(id);
  }

  async sendMessage(userText: string) {
    if (!userText.trim()) return;

    if (!this.activeSessionId()) this.createNewChat();
    const currentId = this.activeSessionId()!;

    const newUserMsg: ChatMessage = { role: 'user', parts: [{ text: userText }] };
    let isFirstMessage = false;

    this.sessions.update(sessions =>
      sessions.map(s => {
        if (s.id === currentId) {
          if (s.messages.length === 0) isFirstMessage = true;
          return {
            ...s,
            title: isFirstMessage ? userText.substring(0, 25) + '...' : s.title,
            messages: [...s.messages, newUserMsg],
            updatedAt: Date.now()
          };
        }
        return s;
      }).sort((a, b) => b.updatedAt - a.updatedAt)
    );

    this.saveHistory();
    this.isLoading.set(true);

    try {
      const activeMsgs = this.sessions().find(s => s.id === currentId)?.messages || [];
      const payloadMsgs = activeMsgs.slice(-5);
      
      // Kept the delay so the pre-loader animations have time to run
      const minDelay = new Promise(resolve => setTimeout(resolve, 3500));
      const apiCall = firstValueFrom(this.http.post(environment.aiChatApiUrl, { contents: payloadMsgs }));
      
      const [response]: any = await Promise.all([apiCall, minDelay]);

      if (response?.candidates?.[0]?.content) {
        const fullText = response.candidates[0].content.parts[0].text;

        this.sessions.update(sessions =>
          sessions.map(s => s.id === currentId ? { ...s, messages: [...s.messages, { role: 'model', parts: [{ text: '' }] }] } : s)
        );

        this.isLoading.set(false);
        this.isTyping.set(true);

        let currentText = '';
        const chunkSize = 1; 
        const delay = 25; // CHANGED: From 45ms to 25ms. Faster but still deliberate.

        for (let i = 0; i < fullText.length; i += chunkSize) {
          currentText += fullText.substring(i, i + chunkSize);

          this.sessions.update(sessions =>
            sessions.map(s => {
              if (s.id === currentId) {
                const msgs = [...s.messages];
                msgs[msgs.length - 1] = { role: 'model', parts: [{ text: currentText }] };
                return { ...s, messages: msgs };
              }
              return s;
            })
          );
          await new Promise(r => setTimeout(r, delay)); 
        }

        this.isTyping.set(false);
        this.saveHistory();
      }
    } catch (error) {
      this.isLoading.set(false);
      this.isTyping.set(false);
      const errorMsg: ChatMessage = { role: 'model', parts: [{ text: 'Connection lost. Please try again.' }] };
      this.sessions.update(sessions =>
        sessions.map(s => s.id === currentId ? { ...s, messages: [...s.messages, errorMsg] } : s)
      );
    }
  }

  private saveHistory() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.sessions()));
  }

  private loadHistory() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.sessions.set(parsed);
        if (parsed.length > 0) this.activeSessionId.set(parsed[0].id);
        else this.createNewChat();
      } catch (e) { this.createNewChat(); }
    } else {
      this.createNewChat();
    }
  }

  deleteChat(id: string) {
    const updatedSessions = this.sessions().filter((session: any) => session.id !== id);
    this.sessions.set(updatedSessions);
    if (this.activeSessionId() === id) {
      this.activeSessionId.set('');
    }
    this.saveHistory();
  }

  clearAllHistory() {
    this.sessions.set([]);
    this.activeSessionId.set('');
    localStorage.removeItem(this.storageKey);
  }
}
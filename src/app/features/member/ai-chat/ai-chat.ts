import { Component, inject, ViewChild, ElementRef, AfterViewChecked, computed, effect, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiChatService } from '../../../services/ai-chat-service';
import { DialogService } from '../../../services/dialog-service';
import { ToastService } from '../../../services/toast-service';
import { environment } from './../../../../environments/environment';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./ai-chat.scss'],
})
export class AiChat implements AfterViewChecked {
  aiChatService = inject(AiChatService);
  dialogService = inject(DialogService);
  toastService = inject(ToastService);
  companyName = environment.companyName;

  userInput: string = '';
  isSidebarOpen: boolean = false;

  // New Loading Animation Signals
  loadingText = signal<string>('');
  isBreathing = signal<boolean>(false);

  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  @ViewChild('chatInput') private chatInput!: ElementRef<HTMLTextAreaElement>;

  sessions = this.aiChatService.sessions;
  activeSessionId = this.aiChatService.activeSessionId;
  isLoading = this.aiChatService.isLoading;
  isTyping = this.aiChatService.isTyping;
  activeMessages = computed(() => this.aiChatService.activeMessages);

  constructor() {
    effect(() => {
      if (this.isLoading()) {
        this.runLoadingSequence();
      } else {
        this.loadingText.set('');
        this.isBreathing.set(false);
      }
    });
  }

  // The custom typewriter sequence for the loading text
  async runLoadingSequence() {
    this.isBreathing.set(false);
    await this.typeString('Analyzing question...');
    
    if (!this.isLoading()) return;
    await new Promise(r => setTimeout(r, 600)); // Pause
    
    if (!this.isLoading()) return;
    this.isBreathing.set(false);
    await this.typeString('Verifying context...');
    
    if (!this.isLoading()) return;
    await new Promise(r => setTimeout(r, 600)); // Pause
    
    if (!this.isLoading()) return;
    this.isBreathing.set(false);
    await this.typeString('Generating response...');
    
    if (!this.isLoading()) return;
    // Finally, activate the breathing CSS effect while waiting for the network
    this.isBreathing.set(true); 
  }

  async typeString(str: string) {
    this.loadingText.set('');
    for (let i = 0; i < str.length; i++) {
      if (!this.isLoading()) return;
      this.loadingText.update(prev => prev + str[i]);
      await new Promise(r => setTimeout(r, 35)); // Speed of typing the loading text
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  autoGrow(event: Event) {
    const textArea = event.target as HTMLTextAreaElement;
    const currentScroll = this.myScrollContainer?.nativeElement.scrollTop || 0;
    textArea.style.height = '44px';
    const newHeight = Math.min(textArea.scrollHeight, 150);
    textArea.style.height = newHeight + 'px';
    if (this.myScrollContainer) {
      this.myScrollContainer.nativeElement.scrollTop = currentScroll;
    }
  }

  onSubmit(event?: Event) {
    if (event) event.preventDefault();
    if (this.userInput.trim() && !this.isLoading() && !this.isTyping()) {
      this.aiChatService.sendMessage(this.userInput);
      this.userInput = '';
      if (this.chatInput) {
        this.chatInput.nativeElement.style.height = '44px';
      }
    }
  }

  handleEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!this.isLoading() && !this.isTyping()) {
        this.onSubmit();
      }
    }
  }

  createNewChat() {
    this.aiChatService.createNewChat();
    if (window.innerWidth < 768) this.isSidebarOpen = false;
  }

  selectChat(id: string) {
    this.aiChatService.selectChat(id);
    if (window.innerWidth < 768) this.isSidebarOpen = false;
  }

  async deleteChat(id: string, event: Event) {
    event.stopPropagation();
    const confirmed = await this.dialogService.open({
      title: `Delete`,
      message: `Delete this conversation?`,
      mode: 'delete',
      confirmText: `Delete`,
      cancelText: 'Cancel'
    });
    if (!confirmed) return;
    this.aiChatService.deleteChat(id);
    this.toastService.success("Conversation deleted!");
  }

  async clearAllChats() {
    const confirmed = await this.dialogService.open({
      title: `Clear History`,
      message: `Confirm clearing all chat history`,
      mode: 'delete',
      confirmText: `Delete`,
      cancelText: 'Cancel'
    });
    if (!confirmed) return;
    this.aiChatService.clearAllHistory();
    this.toastService.success("All chats cleared!");
  }

  formatText(text: string, isLastMessage: boolean, isTyping: boolean): string {
    if (!text) return isTyping ? '<span class="inline-block w-1.5 h-[1.1em] bg-primary animate-pulse align-middle rounded-sm"></span>' : '';

    let html = text;
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold tracking-tight mt-4 mb-2 text-foreground">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold tracking-tight mt-5 mb-2 text-foreground">$1</h2>');

    html = html.replace(/^(\s*)[\*\-]\s+(.*)$/gm, (match, spaces, content) => {
        const level = Math.floor(spaces.length / 2);
        const margin = level * 1.5; 
        const bullet = level === 0 ? '•' : (level === 1 ? '◦' : '▪');
        return `<div style="margin-left: ${margin}rem" class="flex items-start mt-1 mb-1"><span class="text-primary/80 mr-2.5 font-bold select-none text-[1.2rem] leading-none">${bullet}</span><span class="flex-1 text-foreground/90 leading-relaxed">${content}</span></div>`;
    });

    html = html.replace(/^(\s*)(\d+)\.\s+(.*)$/gm, (match, spaces, num, content) => {
        const level = Math.floor(spaces.length / 2);
        const margin = level * 1.5;
        return `<div style="margin-left: ${margin}rem" class="flex items-start mt-1 mb-1"><span class="text-primary/80 mr-2 font-bold select-none min-w-[1.2rem] text-[0.95rem] leading-snug">${num}.</span><span class="flex-1 text-foreground/90 leading-relaxed">${content}</span></div>`;
    });

    const lines = html.split('\n');
    let result = '';
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let isLastLine = (i === lines.length - 1);
        let cursorHtml = (isLastLine && isLastMessage && isTyping) 
          ? '<span class="inline-block w-1.5 h-[1.1em] ml-1 bg-primary animate-pulse align-text-bottom rounded-sm shadow-[0_0_8px_var(--primary)]"></span>' 
          : '';

        if (line.trim() === '') {
            result += `<div class="h-1.5">${cursorHtml}</div>`;
        } else if (!line.startsWith('<div') && !line.startsWith('<h')) {
            result += `<div class="mb-1.5 leading-relaxed text-foreground/90">${line}${cursorHtml}</div>`;
        } else {
            if (isLastLine && isLastMessage && isTyping) {
                line = line.replace(/(<\/[a-zA-Z]+>)$/, `${cursorHtml}$1`);
            }
            result += line;
        }
    }
    return result;
  }
}
import { NetworkManager } from '../network/NetworkManager';
import type { ChatMessagePayload, ChatHistoryPayload } from '../network/networkTypes';
import { isMobileDevice } from '../utils/deviceUtils';

export class ChatUI {
  private container: HTMLDivElement;
  private headerBar: HTMLDivElement;
  private closeBtn: HTMLButtonElement;
  private toggleBtn: HTMLButtonElement;
  private messageList: HTMLDivElement;
  private inputContainer: HTMLDivElement;
  private inputField: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private networkManager: NetworkManager;

  public isOpen: boolean = false;
  public onChatStateChanged?: (isOpen: boolean) => void;

  constructor(networkManager: NetworkManager) {
    this.networkManager = networkManager;
    
    // Toggle Button (Mobile & Desktop)
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'chat-toggle-btn';
    this.toggleBtn.innerHTML = '💬 <span style="font-size: 12px; font-weight: 700;">Chat</span>';

    // Main Chat Window Container
    this.container = document.createElement('div');
    this.container.id = 'chat-container';

    // Header Bar
    this.headerBar = document.createElement('div');
    this.headerBar.id = 'chat-header-bar';
    this.headerBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px;">
        <span>💬</span>
        <span>World Chat</span>
      </div>
    `;

    this.closeBtn = document.createElement('button');
    this.closeBtn.id = 'chat-close-btn';
    this.closeBtn.innerHTML = '✕';
    this.headerBar.appendChild(this.closeBtn);
    
    // Message List
    this.messageList = document.createElement('div');
    this.messageList.id = 'chat-message-list';
    
    // Input Container
    this.inputContainer = document.createElement('div');
    this.inputContainer.id = 'chat-input-container';
    
    this.inputField = document.createElement('input');
    this.inputField.id = 'chat-input';
    this.inputField.type = 'text';
    this.inputField.placeholder = isMobileDevice() ? 'Type a message...' : 'Type a message... (Press Enter)';
    this.inputField.maxLength = 255;

    this.sendBtn = document.createElement('button');
    this.sendBtn.id = 'chat-send-btn';
    this.sendBtn.innerText = 'Send';
    
    this.inputContainer.appendChild(this.inputField);
    this.inputContainer.appendChild(this.sendBtn);

    this.container.appendChild(this.headerBar);
    this.container.appendChild(this.messageList);
    this.container.appendChild(this.inputContainer);
    
    document.body.appendChild(this.toggleBtn);
    document.body.appendChild(this.container);
    
    this.applyStyles();
    this.bindEvents();
    
    // Initially hide chat until connected
    this.toggleBtn.style.display = 'none';
    this.container.style.display = 'none';
  }

  private applyStyles() {
    const isMobile = isMobileDevice();
    this.inputField.placeholder = isMobile ? 'Type a message...' : 'Type a message... (Press Enter)';

    // Floating Toggle Button
    Object.assign(this.toggleBtn.style, {
      position: 'fixed',
      top: 'calc(65px + env(safe-area-inset-top, 0px))',
      left: 'calc(15px + env(safe-area-inset-left, 0px))',
      zIndex: '1000',
      padding: '8px 14px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      cursor: 'pointer',
      display: 'none',
      alignItems: 'center',
      gap: '6px',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      touchAction: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none'
    });

    // Chat Window Container
    if (isMobile) {
      Object.assign(this.container.style, {
        position: 'fixed',
        top: 'calc(60px + env(safe-area-inset-top, 0px))',
        left: 'calc(12px + env(safe-area-inset-left, 0px))',
        right: 'calc(12px + env(safe-area-inset-right, 0px))',
        bottom: 'auto',
        maxWidth: '420px',
        height: '240px',
        maxHeight: '40vh',
        display: 'none',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        pointerEvents: 'auto',
        zIndex: '1050',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'white',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)'
      });
    } else {
      Object.assign(this.container.style, {
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        top: 'auto',
        right: 'auto',
        width: '350px',
        height: '260px',
        maxHeight: '300px',
        display: 'none',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        pointerEvents: 'auto',
        zIndex: '1000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'white',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
      });
    }

    // Header Bar
    Object.assign(this.headerBar.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      userSelect: 'none'
    });

    // Close Button
    Object.assign(this.closeBtn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      color: '#cbd5e1',
      fontSize: '14px',
      fontWeight: '700',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    });

    // Message List
    Object.assign(this.messageList.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontSize: '13px'
    });

    // Input Row
    Object.assign(this.inputContainer.style, {
      padding: '8px 10px',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      gap: '6px'
    });

    // Input Field
    Object.assign(this.inputField.style, {
      flex: '1',
      padding: '8px 12px',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '6px',
      color: 'white',
      outline: 'none',
      fontSize: '14px',
      fontFamily: 'inherit'
    });

    // Send Button
    Object.assign(this.sendBtn.style, {
      padding: '8px 14px',
      backgroundColor: '#4f46e5',
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      fontWeight: '700',
      fontSize: '13px',
      cursor: 'pointer'
    });
  }

  public openChat(): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.toggleBtn.style.display = 'none';
    this.scrollToBottom();
    if (this.onChatStateChanged) {
      this.onChatStateChanged(true);
    }
    setTimeout(() => this.inputField.focus(), 50);
  }

  public closeChat(): void {
    this.isOpen = false;
    this.inputField.blur();
    const isMobile = isMobileDevice();
    if (isMobile) {
      this.container.style.display = 'none';
      this.toggleBtn.style.display = 'flex';
    } else {
      // Keep visible on desktop or toggle
      this.container.style.display = 'flex';
    }
    if (this.onChatStateChanged) {
      this.onChatStateChanged(false);
    }
  }

  public toggleChat(): void {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  private bindEvents(): void {
    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChat();
    });

    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeChat();
    });

    const sendCurrentMessage = () => {
      const text = this.inputField.value.trim();
      if (text.length > 0) {
        this.networkManager.sendChatMessage(text);
        this.inputField.value = '';
      }
      const isMobile = isMobileDevice();
      if (isMobile) {
        this.inputField.blur();
      }
    };

    this.sendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sendCurrentMessage();
    });

    this.inputField.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        sendCurrentMessage();
      } else if (e.key === 'Escape') {
        this.closeChat();
      }
    });

    // Handle orientation & resizing
    window.addEventListener('resize', () => {
      this.applyStyles();
      if (this.isOpen) {
        this.container.style.display = 'flex';
      }
    });

    // Network Events
    this.networkManager.on('world_joined', () => {
      const isMobile = isMobileDevice();
      if (isMobile) {
        this.toggleBtn.style.display = 'flex';
      } else {
        this.container.style.display = 'flex';
      }
      this.messageList.innerHTML = '';
      this.appendSystemMessage('Connected to Global World.');
    });

    this.networkManager.on('session_joined', () => {
      const isMobile = isMobileDevice();
      if (isMobile) {
        this.toggleBtn.style.display = 'flex';
      } else {
        this.container.style.display = 'flex';
      }
      this.messageList.innerHTML = '';
      this.appendSystemMessage('Connected to Global World.');
    });

    this.networkManager.on('chat_history', (payload: ChatHistoryPayload) => {
      this.messageList.innerHTML = '';
      payload.messages.forEach(msg => this.appendMessage(msg));
    });

    this.networkManager.on('chat_message', (payload: ChatMessagePayload) => {
      this.appendMessage(payload);
    });

    this.networkManager.on('player_joined', (payload) => {
      this.appendSystemMessage(`${payload.player.displayName} joined the world.`);
    });

    this.networkManager.on('player_left', (_payload) => {
      this.appendSystemMessage(`A player left the world.`);
    });
  }

  private appendMessage(msg: ChatMessagePayload) {
    const msgEl = document.createElement('div');
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgEl.style.wordBreak = 'break-word';
    msgEl.innerHTML = `<span style="color: #888; font-size: 11px;">[${time}]</span> <strong style="color: #4da6ff;"></strong> <span></span>`;
    
    msgEl.querySelector('strong')!.textContent = msg.displayName + ':';
    msgEl.querySelector('span:last-child')!.textContent = msg.content;
    
    this.messageList.appendChild(msgEl);
    this.scrollToBottom();
  }

  private appendSystemMessage(text: string) {
    const msgEl = document.createElement('div');
    msgEl.style.color = '#aaa';
    msgEl.style.fontStyle = 'italic';
    msgEl.style.fontSize = '12px';
    msgEl.textContent = text;
    this.messageList.appendChild(msgEl);
    this.scrollToBottom();
  }

  private scrollToBottom() {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }
}

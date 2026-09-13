import { NetworkManager } from '../network/NetworkManager';
import type { ChatMessagePayload, ChatHistoryPayload } from '../network/networkTypes';

export class ChatUI {
  private container: HTMLDivElement;
  private messageList: HTMLDivElement;
  private inputContainer: HTMLDivElement;
  private inputField: HTMLInputElement;
  private networkManager: NetworkManager;

  constructor(networkManager: NetworkManager) {
    this.networkManager = networkManager;
    
    this.container = document.createElement('div');
    this.container.id = 'chat-container';
    
    this.messageList = document.createElement('div');
    this.messageList.id = 'chat-message-list';
    
    this.inputContainer = document.createElement('div');
    this.inputContainer.id = 'chat-input-container';
    
    this.inputField = document.createElement('input');
    this.inputField.id = 'chat-input';
    this.inputField.type = 'text';
    this.inputField.placeholder = 'Type a message... (Press Enter)';
    this.inputField.maxLength = 255;
    
    this.inputContainer.appendChild(this.inputField);
    this.container.appendChild(this.messageList);
    this.container.appendChild(this.inputContainer);
    
    document.body.appendChild(this.container);
    
    this.applyStyles();
    this.bindEvents();
    
    // Initially hide chat if not in a session
    this.container.style.display = 'none';
  }

  private applyStyles() {
    Object.assign(this.container.style, {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      width: '350px',
      height: '250px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: '8px',
      pointerEvents: 'auto',
      zIndex: '1000',
      fontFamily: 'sans-serif',
      color: 'white',
      overflow: 'hidden'
    });

    Object.assign(this.messageList.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      fontSize: '14px'
    });

    Object.assign(this.inputContainer.style, {
      padding: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderTop: '1px solid rgba(255,255,255,0.1)'
    });

    Object.assign(this.inputField.style, {
      width: '100%',
      padding: '8px',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px',
      color: 'white',
      outline: 'none',
      fontSize: '14px'
    });
  }

  private bindEvents() {
    this.inputField.addEventListener('keydown', (e) => {
      // Prevent event bubbling so the game doesn't interpret keys (though InputManager should also block it)
      e.stopPropagation();
      
      if (e.key === 'Enter') {
        const text = this.inputField.value.trim();
        if (text.length > 0) {
          this.networkManager.sendChatMessage(text);
          this.inputField.value = '';
        }
        this.inputField.blur();
      } else if (e.key === 'Escape') {
        this.inputField.blur();
      }
    });

    // Network Events
    this.networkManager.on('session_joined', () => {
      this.container.style.display = 'flex';
      this.messageList.innerHTML = '';
      this.appendSystemMessage('Joined session.');
    });

    this.networkManager.on('session_created', () => {
      this.container.style.display = 'flex';
      this.messageList.innerHTML = '';
      this.appendSystemMessage('Session created.');
    });

    this.networkManager.on('session_left', () => {
      this.container.style.display = 'none';
      this.messageList.innerHTML = '';
    });

    this.networkManager.on('chat_history', (payload: ChatHistoryPayload) => {
      this.messageList.innerHTML = ''; // Clear for history
      payload.messages.forEach(msg => this.appendMessage(msg));
    });

    this.networkManager.on('chat_message', (payload: ChatMessagePayload) => {
      this.appendMessage(payload);
    });

    this.networkManager.on('player_joined', (payload) => {
      this.appendSystemMessage(`${payload.player.displayName} joined the session.`);
    });

    this.networkManager.on('player_left', (_payload) => {
      this.appendSystemMessage(`A player left the session.`);
    });
  }

  private appendMessage(msg: ChatMessagePayload) {
    const msgEl = document.createElement('div');
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Safety: use textContent to avoid HTML injection in the DOM just in case
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

export interface ChatWidgetOptions {
    serverUrl?: string;
    position?: 'bottom-left' | 'bottom-right';
    theme?: 'light' | 'dark';
    title?: string;
    primaryColor?: string;
}
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isStreaming?: boolean;
}

export interface StreamData {
  type: 'chunk' | 'end';
  content?: string;
  conversationId?: string;
  streamingId?:string;
}
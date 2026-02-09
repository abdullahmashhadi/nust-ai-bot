export interface ChatWidgetOptions {
    serverUrl?: string;
    position?: 'bottom-left' | 'bottom-right' | 'center';
    theme?: 'light' | 'dark';
    title?: string;
    primaryColor?: string;
    forceOpen?: boolean;
}
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  queryId?: string;
  feedback?: 'positive' | 'negative' | 'neutral';
}

export interface StreamData {
  type: 'chunk' | 'end';
  content?: string;
  conversationId?: string;
  streamingId?: string;
  queryId?: string;
}
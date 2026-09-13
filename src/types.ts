export enum AppMode {
  STUDY = 'STUDY',
  GAMING = 'GAMING',
  DEVELOPER = 'DEVELOPER'
}

export interface Shortcut {
  id: string;
  name: string;
  url: string;
  icon: string;
  color: string;
  favicon?: string;
}

export interface AIResponse {
  content: string;
  type: 'summary' | 'strategy' | 'code' | 'general';
  metadata?: any;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  folderId?: string;
  createdAt: number;
}

export interface ChatFolder {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  sourceUrl?: string;
  kind?: 'note' | 'source';
  useForAgent?: boolean;
}

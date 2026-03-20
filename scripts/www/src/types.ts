export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export type NoteType = 'thought' | 'reflection' | 'inspiration' | 'mistake';

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
  tags: string[];
  linkedExperimentId?: string;
  imageUrl?: string;
  type: NoteType;
  star?: string;
  inMethodsLibrary?: boolean;
  folderId?: string;
}

export type ExperimentStatus = 'active' | 'completed' | 'extended' | 'archived' | 'ascended';

export interface Experiment {
  id: string;
  title: string;
  startDate: number;
  endDate: number;
  status: ExperimentStatus;
  linkedNoteIds: string[];
  category?: string;
}

export interface Principle {
  id: string;
  title: string;
  content: string;
  category: string;
  timestamp: number;
}

export interface Mistake {
  id: string;
  title: string;
  content: string;
  category: string;
  timestamp: number;
}

export type View = 'inbox' | 'methods' | 'principles' | 'mistakes' | 'folder';

export interface Message {
  role: 'user' | 'model';
  content: string;
  id?: string;
  status?: 'loading' | 'complete' | 'error';
} 
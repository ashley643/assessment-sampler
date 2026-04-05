export interface QuestionSample {
  id: string;
  embedUrl: string;
  language: 'english' | 'spanish';
  sortOrder: number;
  mediaType?: 'video' | 'audio';
  gender?: string;
  grade?: string;
  excerpt?: string;
}

export interface Question {
  id: string;
  order: number;
  title: string;
  embedUrl: string;
  spanishEmbedUrl?: string;
  samples?: QuestionSample[];
}

export interface Assessment {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  playerLabel?: string;
  questions: Question[];
  childAssessments?: Assessment[];
}

export interface AccessCode {
  code: string;
  expires: string;
  label: string;
  canViewSamples: boolean;
  assessments: Assessment[];
}

export interface CodesData {
  codes: AccessCode[];
}

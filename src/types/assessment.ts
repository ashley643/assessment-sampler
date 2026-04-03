export interface Question {
  id: string;
  order: number;
  title: string;
  embedUrl: string;
  spanishEmbedUrl?: string;
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
  questions: Question[];
  childAssessments?: Assessment[]; // populated for benchmark_group type
}

export interface AccessCode {
  code: string;
  expires: string;
  label: string;
  assessments: Assessment[];
}

export interface CodesData {
  codes: AccessCode[];
}

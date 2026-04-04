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
  playerLabel?: string; // short label shown in bundle switcher sidebar
  questions: Question[];
  childAssessments?: Assessment[]; // populated for bundle type
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

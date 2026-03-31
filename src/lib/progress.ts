/**
 * Stores per-question completion state in localStorage.
 * Key: `impacter-progress-${code}`
 * Value: { [assessmentId]: { [questionId]: true } }
 */

type ProgressMap = Record<string, Record<string, boolean>>;

function storageKey(code: string): string {
  return `impacter-progress-${code.toUpperCase()}`;
}

export function getProgress(code: string): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function markQuestionComplete(
  code: string,
  assessmentId: string,
  questionId: string,
): void {
  if (typeof window === 'undefined') return;
  const progress = getProgress(code);
  if (!progress[assessmentId]) progress[assessmentId] = {};
  progress[assessmentId][questionId] = true;
  localStorage.setItem(storageKey(code), JSON.stringify(progress));
}

export function clearProgress(code: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(code));
}

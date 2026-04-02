const SESSION_KEY = 'ip_session_id';

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(SESSION_KEY);
}

function setSessionId(id: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, id);
}

export async function track(
  event_type: string,
  code: string,
  extra?: {
    assessment_id?: string;
    question_id?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    const session_id = getSessionId();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
    const device_type =
      typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';

    const res = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id,
        code,
        event_type,
        user_agent: ua,
        device_type,
        ...extra,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.session_id && data.session_id !== session_id) {
        setSessionId(data.session_id);
      }
    }
  } catch {
    // Tracking errors are non-fatal
  }
}

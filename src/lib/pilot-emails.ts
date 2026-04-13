import { Resend } from 'resend';

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = 'Impacter Pathway <pilot@impacterpathway.com>';
const INTERNAL_TO = ['ashley@impacterpathway.com'];
const ADMIN_URL = 'https://try.impacterpathway.com/admin/pilot-submissions';

const TYPE_LABELS: Record<string, string> = {
  'community-schools': 'Community Schools Survey',
  'learner-portrait':  'Learner Portrait',
  'behavioral-health': 'Behavioral Health Screener',
};

// ─── Shared styles ──────────────────────────────────────────────────────────

const NAVY   = '#1a2744';
const ACCENT = '#e07b54';
const BODY   = '#374151';
const MUTED  = '#6b7280';
const BORDER = '#e5e7eb';
const BG     = '#f9fafb';

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Impacter Pathway</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">

        <!-- Header -->
        <tr>
          <td style="background:${NAVY};padding:28px 36px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Impacter Pathway</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;text-transform:uppercase;">Pilot Program</p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px 36px 28px;">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:${NAVY};padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);">
              © ${new Date().getFullYear()} Impacter Pathway &nbsp;·&nbsp;
              <a href="https://impacterpathway.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">impacterpathway.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:7px 0;vertical-align:top;width:160px;">
        <span style="font-size:13px;color:${MUTED};">${label}</span>
      </td>
      <td style="padding:7px 0;vertical-align:top;">
        <span style="font-size:13px;color:${BODY};font-weight:500;">${value}</span>
      </td>
    </tr>`;
}

function section(title: string, rows: string): string {
  if (!rows.trim()) return '';
  return `
    <p style="margin:24px 0 10px;font-size:11px;font-weight:700;color:${MUTED};letter-spacing:0.8px;text-transform:uppercase;">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};">
      ${rows}
    </table>`;
}

// ─── Receipt email (to submitter) ────────────────────────────────────────────

export async function sendReceiptEmail(opts: {
  name: string;
  email: string;
  organization: string;
  assessmentType: string;
  launchTimeline?: string;
  expectedCount?: string;
}) {
  const typeLabel = TYPE_LABELS[opts.assessmentType] ?? opts.assessmentType;

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${NAVY};letter-spacing:-0.4px;">
      We've got your request, ${opts.name.split(' ')[0]}!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">
      Thanks for your interest in piloting the <strong>${typeLabel}</strong> with ${opts.organization}.
      Our team has received your request and will be in touch shortly to walk through next steps.
    </p>

    ${section('What you submitted', [
      row('Assessment', typeLabel),
      row('Organization', opts.organization),
      opts.launchTimeline ? row('Launch timeline', opts.launchTimeline) : '',
      opts.expectedCount  ? row('Estimated respondents', opts.expectedCount) : '',
    ].join(''))}

    <div style="margin:32px 0;padding:20px 24px;background:#f0f4ff;border-radius:10px;border-left:4px solid #3b82f6;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${NAVY};">What happens next</p>
      <p style="margin:0;font-size:13px;color:${BODY};line-height:1.6;">
        A member of our team will reach out within 1–2 business days to confirm your details and
        begin scoping your pilot. In the meantime, feel free to reply to this email with any questions.
      </p>
    </div>

    <p style="margin:28px 0 0;font-size:14px;color:${BODY};line-height:1.6;">
      Looking forward to working with you,<br />
      <strong style="color:${NAVY};">The Impacter Pathway Team</strong>
    </p>
    <p style="margin:6px 0 0;font-size:13px;">
      <a href="mailto:info@impacterpathway.com" style="color:${ACCENT};text-decoration:none;">info@impacterpathway.com</a>
    </p>
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.email,
    subject: `Your Pilot Request — Impacter Pathway`,
    html: base(content),
  });
}

// ─── Internal notification email (to team) ───────────────────────────────────

export async function sendInternalNotification(opts: {
  name: string;
  email: string;
  role?: string | null;
  organization: string;
  phone?: string | null;
  assessmentType: string;
  launchTimeline?: string;
  expectedCount?: string;
  respondents?: string[];
  gradeLevels?: string[];
  primaryGoal?: string | null;
  communityModel?: string | null;
  competencyFocus?: string | null;
  screeningScope?: string | null;
  notes?: string | null;
}) {
  const typeLabel = TYPE_LABELS[opts.assessmentType] ?? opts.assessmentType;
  const respondentStr = opts.respondents?.join(', ');
  const gradeLevelStr = opts.gradeLevels?.join(', ');

  const content = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${NAVY};letter-spacing:-0.3px;">
      New Pilot Request
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:${BODY};">
      <strong>${opts.organization}</strong> has submitted a pilot intake form.
    </p>
    <p style="margin:0 0 28px;font-size:13px;color:${MUTED};">${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>

    ${section('Contact', [
      row('Name', opts.name),
      row('Email', `<a href="mailto:${opts.email}" style="color:${ACCENT};text-decoration:none;">${opts.email}</a>`),
      row('Role', opts.role),
      row('Organization', opts.organization),
      row('Phone', opts.phone),
    ].join(''))}

    ${section('Assessment', [
      row('Type', typeLabel),
      row('Launch timeline', opts.launchTimeline),
      row('Respondent count', opts.expectedCount),
      row('Respondents', respondentStr),
      row('Grade levels', gradeLevelStr),
      row('Primary goal', opts.primaryGoal),
      row('Community model', opts.communityModel),
      row('Competency focus', opts.competencyFocus),
      row('Screening scope', opts.screeningScope),
    ].join(''))}

    ${opts.notes ? section('Notes from submitter', row('', opts.notes)) : ''}

    <div style="margin:32px 0 8px;text-align:center;">
      <a href="${ADMIN_URL}"
         style="display:inline-block;padding:13px 28px;background:${NAVY};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:-0.2px;">
        View Full Submission →
      </a>
    </div>
    <p style="margin:12px 0 0;text-align:center;font-size:12px;color:${MUTED};">
      <a href="${ADMIN_URL}" style="color:${MUTED};">${ADMIN_URL}</a>
    </p>
  `;

  return getResend().emails.send({
    from: FROM,
    to: INTERNAL_TO,
    subject: `New Pilot Request — ${opts.organization} (${typeLabel})`,
    html: base(content),
  });
}

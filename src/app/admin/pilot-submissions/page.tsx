import type { Metadata } from 'next';
import PilotSubmissionsClient from './_client';

export const metadata: Metadata = { title: 'Pilot Submissions — Impacter Admin' };

export default function Page() {
  return <PilotSubmissionsClient />;
}

import type { Metadata } from 'next';
import PilotClient from './_client';

export const metadata: Metadata = { title: 'Start a Pilot — Impacter Pathway' };

export default function Page() {
  return <PilotClient />;
}

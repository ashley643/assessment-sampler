import type { Metadata } from 'next';
import PilotClient from './_client';

export const metadata: Metadata = { title: 'Start a Pilot — Impacter Pathway' };

export default async function Page({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const params = await searchParams;
  return <PilotClient initialOpen={params.start === '1'} />;
}

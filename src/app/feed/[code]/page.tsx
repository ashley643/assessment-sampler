import type { Metadata } from 'next';
import FeedClient from './_client';

export const metadata: Metadata = { title: 'Sample Responses — Impacter Pathway' };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <FeedClient code={code.toUpperCase()} />;
}

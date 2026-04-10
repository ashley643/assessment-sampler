import type { Metadata } from 'next';
import ResponseFinderClient from './_client';

export const metadata: Metadata = { title: 'Response Finder — Impacter Admin' };

export default function Page() {
  return <ResponseFinderClient />;
}

import type { Metadata } from 'next';
import VideoAskImportClient from './_client';

export const metadata: Metadata = { title: 'VideoAsk Import — Impacter Admin' };

export default function Page() {
  return <VideoAskImportClient />;
}

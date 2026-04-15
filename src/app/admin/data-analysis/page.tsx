import type { Metadata } from 'next';
import DataAnalysisClient from './_client';

export const metadata: Metadata = { title: 'Data Analysis — Impacter Admin' };

export default function Page() {
  return <DataAnalysisClient />;
}

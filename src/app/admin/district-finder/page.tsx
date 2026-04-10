import type { Metadata } from 'next';
import DistrictFinderClient from './_client';

export const metadata: Metadata = { title: 'District Response Finder — Impacter Admin' };

export default function Page() {
  return <DistrictFinderClient />;
}

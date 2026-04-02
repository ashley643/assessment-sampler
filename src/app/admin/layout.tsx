import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — Impacter Pathway',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

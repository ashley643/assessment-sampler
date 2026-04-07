'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard':        'Activity Log — Admin',
  '/admin/codes':            'Access Codes — Admin',
  '/admin/assessments':      'Assessments — Admin',
  '/admin/bundles':          'Bundles — Admin',
  '/admin/audit':            'Audit Log — Admin',
  '/admin/response-finder':  'Response Finder — Admin',
  '/admin/district-finder':  'District Response Finder — Admin',
};

const NAV = [
  { href: '/admin/codes', label: 'Access Codes' },
  { href: '/admin/dashboard', label: 'Activity Log' },
  { href: '/admin/assessments', label: 'Assessments' },
  { href: '/admin/bundles', label: 'Bundles' },
  { href: '/admin/audit', label: 'Audit Log' },
];

const NAV_EXTERNAL = [
  { href: '/admin/response-finder', label: 'Response Finder' },
  { href: '/admin/district-finder', label: 'District Response Finder' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  // Pages that manage their own layout and don't want admin padding
  const fullBleed = pathname.startsWith('/admin/district-finder') || pathname.startsWith('/admin/response-finder');

  useEffect(() => {
    const match = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k));
    document.title = match ? match[1] : 'Admin — Impacter Pathway';
  }, [pathname]);

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static z-30 h-full md:h-auto
        w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900">Impacter Pathway</span>
            <span className="block text-xs text-gray-400 mt-0.5">Admin</span>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-gray-600"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(n.href)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {n.label}
            </Link>
          ))}
          <div className="pt-2 mt-2 border-t border-gray-100">
            {NAV_EXTERNAL.map(n => (
              <a
                key={n.href}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                {n.label}
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                  <path d="M2 9L9 2M9 2H5M9 2v4"/>
                </svg>
              </a>
            ))}
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-gray-100">
          {session?.user?.email && (
            <p className="text-xs text-gray-500 mb-2 truncate">{session.user.email}</p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/admin' })}
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-gray-500 hover:text-gray-800"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900">Impacter Pathway Admin</span>
        </div>
        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${fullBleed ? 'p-0' : 'p-6 md:p-8'}`}>{children}</main>
      </div>
    </div>
  );
}

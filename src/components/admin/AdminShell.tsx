'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV = [
  { href: '/admin/codes', label: 'Access Codes' },
  { href: '/admin/dashboard', label: 'Activity Log' },
  { href: '/admin/assessments', label: 'Assessments' },
  { href: '/admin/bundles', label: 'Bundles' },
  { href: '/admin/audit', label: 'Audit Log' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Impacter Pathway</span>
          <span className="block text-xs text-gray-400 mt-0.5">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(n.href)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {n.label}
            </Link>
          ))}
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
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}

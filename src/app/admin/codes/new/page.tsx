import AdminShell from '@/components/admin/AdminShell';
import CodeForm from '@/components/admin/CodeForm';
import Link from 'next/link';

export default function NewCodePage() {
  return (
    <AdminShell>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">New Access Code</h1>
          <div className="flex gap-3">
            <Link href="/admin/codes" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">Cancel</Link>
            <button type="submit" form="code-form" className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] transition-colors">Create</button>
          </div>
        </div>
        <CodeForm />
      </div>
    </AdminShell>
  );
}

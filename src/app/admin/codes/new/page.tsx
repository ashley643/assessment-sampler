import AdminShell from '@/components/admin/AdminShell';
import CodeForm from '@/components/admin/CodeForm';

export default function NewCodePage() {
  return (
    <AdminShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">New Access Code</h1>
        <CodeForm />
      </div>
    </AdminShell>
  );
}

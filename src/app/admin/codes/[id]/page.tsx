import AdminShell from '@/components/admin/AdminShell';
import CodeForm from '@/components/admin/CodeForm';

export default async function EditCodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit Access Code</h1>
        <CodeForm codeId={id} />
      </div>
    </AdminShell>
  );
}

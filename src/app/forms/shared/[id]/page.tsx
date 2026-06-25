import { createClient } from '@supabase/supabase-js';
import SharedFormClient from './shared-form-client';

// Server-side lazy admin initialization
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SharedFormPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getAdminClient();

  // Fetch form configuration server-side bypassing RLS securely
  const { data: form } = await supabase
    .from('custom_forms')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!form) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract glowing background blobs */}
        <div className="absolute top-1/4 left-1/4 size-80 rounded-full bg-[#00aef0]/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-80 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-8 text-center shadow-xl space-y-4">
          <div className="size-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Form Not Found</h2>
          <p className="text-sm text-slate-400">
            The link you followed is invalid, or the form has been removed by the administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!form.is_active) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract glowing background blobs */}
        <div className="absolute top-1/4 left-1/4 size-80 rounded-full bg-[#00aef0]/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-80 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-8 text-center shadow-xl space-y-4">
          <div className="size-16 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Form Inactive</h2>
          <p className="text-sm text-slate-400">
            This form is currently closed to new submissions. Please contact the workspace administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Fetch fields server-side
  const { data: fields } = await supabase
    .from('custom_form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('position', { ascending: true });

  return (
    <SharedFormClient form={form} fields={fields || []} />
  );
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only — never import in client components
let _client: SupabaseClient | null = null;

export function getImpacterClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      'https://leeevvjenekdldngwkek.supabase.co',
      process.env.IMPACTER_SERVICE_ROLE_KEY!,
    );
  }
  return _client;
}

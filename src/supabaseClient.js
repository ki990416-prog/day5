import { createClient } from '@supabase/supabase-js'

export const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-key',
)

export const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`

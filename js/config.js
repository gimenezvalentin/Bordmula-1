// ============================================================================
// Configuración de Supabase.
//
// Estos dos valores son PÚBLICOS por diseño (van en el front). Lo que protege
// los datos es la Row Level Security definida en supabase/schema.sql.
//
// Los sacás de:  Supabase → Project Settings → API
//   - Project URL   -> SUPABASE_URL
//   - Project API keys → "anon" "public"  -> SUPABASE_ANON_KEY
// ============================================================================

export const SUPABASE_URL = "https://irzypbvlszcpidadrhyp.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_QfBL0U3pidHslqcIGMRnqw_qrFAX6YC";

// Bucket de Storage donde se guardan las tapas.
export const TAPAS_BUCKET = "tapas";

// true  -> hay credenciales cargadas y la app habla con Supabase
// false -> modo demo: todo queda en el navegador (útil para probar la UI sin backend)
export const HAS_SUPABASE =
  !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_ANON_KEY.includes("TU_ANON_KEY");

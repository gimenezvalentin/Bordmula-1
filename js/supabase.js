// ============================================================================
// Cliente de Supabase (se importa el SDK desde un CDN, sin build ni npm).
//
// En "modo demo" (config.js sin credenciales) exporta null y el resto de la
// app cae a almacenamiento local.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, HAS_SUPABASE } from "./config.js";

let supabase = null;

if (HAS_SUPABASE) {
  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  );
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "bordmula.auth",
    },
  });
}

export { supabase };
export const isOnline = () => supabase !== null;

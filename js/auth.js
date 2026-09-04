// ============================================================================
// Login / logout con email + contraseña.
// Los usuarios se crean a mano en Supabase → Authentication → Users.
// El registro público está deshabilitado.
// ============================================================================

import { supabase, isOnline } from "./supabase.js";

export async function getSession() {
  if (!isOnline()) return { user: { email: "demo@local" } }; // modo demo: siempre "logueado"
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  if (!isOnline()) return { user: { email } };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (!isOnline()) return;
  await supabase.auth.signOut();
}

export function onAuthChange(cb) {
  if (!isOnline()) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

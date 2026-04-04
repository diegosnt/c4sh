import { getSupabaseClient } from './supabase-client.js'

async function getClient() {
  return getSupabaseClient()
}

export async function signIn(email, password) {
  const supabase = await getClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email, password) {
  const supabase = await getClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = await getClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const supabase = await getClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data?.session
}

export function onAuthChange(callback) {
  getClient().then(supabase => {
    supabase.auth.onAuthStateChange((_event, session) => {
      callback(session)
    })
  })
}

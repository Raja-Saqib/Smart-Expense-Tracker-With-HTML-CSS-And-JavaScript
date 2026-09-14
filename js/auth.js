import { supabase } from "../cloud/supabaseClient.js";

/**
 * Get the currently authenticated Supabase user.
 *
 * Returns:
 *   user object → logged-in user
 *   null        → no authenticated user
 */
export const getAuthenticatedUser = async () => {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user ?? null;
};

/**
 * Get the current Supabase session.
 *
 * Returns:
 *   session object → authenticated session
 *   null          → no active session
 */
export const getCurrentSession = async () => {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session ?? null;
};

/**
 * Create a new user account.
 */
export const signUp = async (email, password) => {
  const {
    data,
    error
  } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Sign in an existing user.
 */
export const signIn = async (email, password) => {
  const {
    data,
    error
  } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Sign out the current user.
 */
export const signOut = async () => {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};

/**
 * Listen for authentication/session changes.
 *
 * The callback receives:
 *   event
 *   session
 */
export const onAuthStateChange = callback => {
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );

  return subscription;
};

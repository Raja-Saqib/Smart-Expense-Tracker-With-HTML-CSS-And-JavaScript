import { supabase } from "../cloud/supabaseClient.js";

/*
 * --------------------------------------------------
 * CURRENT AUTHENTICATION STATE
 * --------------------------------------------------
 */

let currentUser = null;

/*
 * --------------------------------------------------
 * GET CURRENT USER
 * --------------------------------------------------
 */

export const getAuthenticatedUser = async () => {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    if (error.name === "AuthSessionMissingError") {
      currentUser = null;
      return null;
    }

    throw error;
  }

  currentUser = user ?? null;

  return currentUser;
};

/*
 * --------------------------------------------------
 * GET CURRENT SESSION
 * --------------------------------------------------
 */

export const getCurrentSession = async () => {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  currentUser =
    session?.user ?? null;

  return session ?? null;
};

/*
 * --------------------------------------------------
 * CACHED AUTHENTICATED USER
 *
 * Used by local application code so a guest does
 * not trigger unnecessary Supabase requests.
 * --------------------------------------------------
 */

export const getCachedAuthenticatedUser = () =>
  currentUser;

/*
 * --------------------------------------------------
 * INITIALIZE AUTH STATE
 * --------------------------------------------------
 */

export const initializeAuth = async () => {
  const session =
    await getCurrentSession();

  currentUser =
    session?.user ?? null;

  return currentUser;
};

/*
 * --------------------------------------------------
 * SIGN UP
 * --------------------------------------------------
 */

export const signUp = async (
  email,
  password
) => {
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

  currentUser =
    data?.user ?? null;

  return data;
};

/*
 * --------------------------------------------------
 * SIGN IN
 * --------------------------------------------------
 */

export const signIn = async (
  email,
  password
) => {
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

  currentUser =
    data?.user ?? null;

  return data;
};

/*
 * --------------------------------------------------
 * CHANGE PASSWORD
 *
 * For an already authenticated account.
 * --------------------------------------------------
 */

export const changePassword = async (
  currentPassword,
  newPassword
) => {
  if (!currentPassword) {
    throw new Error(
      "Current password is required."
    );
  }

  if (!newPassword) {
    throw new Error(
      "New password is required."
    );
  }

  const {
    data,
    error
  } = await supabase.auth.updateUser({
    currentPassword,
    password: newPassword
  });

  if (error) {
    throw error;
  }

  if (!data?.user) {
    throw new Error(
      "Supabase did not return the updated user."
    );
  }

  currentUser =
    data.user;

  return data.user;
};

/*
 * --------------------------------------------------
 * SIGN OUT
 * --------------------------------------------------
 */

export const signOut = async () => {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  currentUser = null;
};

/*
 * --------------------------------------------------
 * AUTH STATE LISTENER
 * --------------------------------------------------
 */

export const onAuthStateChange = callback => {
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      currentUser =
        session?.user ?? null;

      callback(
        event,
        session
      );
    }
  );

  return subscription;
};

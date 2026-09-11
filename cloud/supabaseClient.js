import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CLOUD_CONFIG } from "../config.js";

const SUPABASE_URL = CLOUD_CONFIG.SUPABASE_DB_URL;
const SUPABASE_PUBLISHABLE_KEY =
  CLOUD_CONFIG.SUPABASE_DB_PUBLISH_KEY;

if (!SUPABASE_URL) {
  throw new Error("Supabase URL is missing from config.js");
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Supabase publishable key is missing from config.js"
  );
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export const ensureAnonymousUser = async () => {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session?.user) {
    return session.user;
  }

  const { data, error } =
    await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  if (!data?.user) {
    throw new Error(
      "Anonymous Supabase user could not be created"
    );
  }

  return data.user;
};

export const getCurrentUser = async () => {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
};

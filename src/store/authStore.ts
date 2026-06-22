/**
 * Authentication state, backed by Supabase Auth (email + password).
 *
 * This store is intentionally decoupled from sync: it only tracks who is
 * signed in. The sync orchestration (usePersistence) subscribes to `user`
 * changes and drives cloudSync from there, so there's no import cycle.
 */
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isCloudConfigured } from '../lib/supabase';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** Sign-up succeeded but the account needs email confirmation before login. */
  needsEmailConfirm?: boolean;
}

interface AuthStore {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  dialogOpen: boolean;

  init: () => void;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
}

let initialized = false;

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'loading',
  user: null,
  session: null,
  dialogOpen: false,

  init: () => {
    if (initialized) return;
    initialized = true;

    if (!supabase) {
      set({ status: 'signed-out' });
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        status: data.session ? 'signed-in' : 'signed-out',
      });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'signed-in' : 'signed-out',
      });
    });
  },

  signUp: async (email, password) => {
    if (!supabase) return { ok: false, error: 'Cloud sync is not configured.' };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    // Email-confirmation ON → no session yet; OFF → session is live immediately.
    if (!data.session) return { ok: true, needsEmailConfirm: true };
    return { ok: true };
  },

  signIn: async (email, password) => {
    if (!supabase) return { ok: false, error: 'Cloud sync is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  openDialog: () => {
    if (isCloudConfigured) set({ dialogOpen: true });
  },
  closeDialog: () => set({ dialogOpen: false }),
}));

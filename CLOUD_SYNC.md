# Cloud sync

Optional account-based sync layered on top of Canvas's local-first storage.
Guests keep the full app with everything in IndexedDB; signing in mirrors
canvases to Supabase so they follow you across devices.

## How it works

- **Local-first, cloud-mirror.** IndexedDB stays the fast source of truth.
  The cloud is a mirror, so the app still works fully offline and stays instant.
- **Push.** Edits autosave to IndexedDB (500 ms), then push to Supabase on a
  ~2.5 s debounce while signed in.
- **Pull.** A full two-way merge runs on sign-in, on window focus, and via
  "Sync now". Per-canvas **last-write-wins** by `updatedAt`.
- **First sign-in.** Your existing local canvases are auto-uploaded to the
  account (empty, never-touched "Untitled N" canvases are skipped).
- **Deletes.** Soft-delete tombstones (`deleted = true`) propagate removals to
  every device instead of letting a deleted canvas resync back.
- **Offline.** Pending push/delete intents persist in `localStorage` and flush
  automatically on reconnect.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run:

   ```sql
   create table canvases (
     id text primary key,
     user_id uuid not null references auth.users on delete cascade,
     name text not null,
     data jsonb not null,
     created_at bigint not null,
     updated_at bigint not null,
     deleted boolean not null default false
   );

   alter table canvases enable row level security;

   create policy "own rows only" on canvases
     for all
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);

   create index canvases_user_idx on canvases (user_id);
   ```

3. Copy `.env.example` to `.env` and fill in **Project URL** and the
   **anon / publishable** key from **Project Settings → API**. Never use the
   `service_role` / secret key in the client.
4. `npm install` (pulls in `@supabase/supabase-js`), then `npm run dev`.

Auth uses email + password. Under **Authentication → Email**, the
"Confirm email" toggle controls whether sign-up requires a verification link;
the UI handles both (it shows a "check your email" notice when confirmation is
on). When `.env` is absent, cloud sync stays disabled and Canvas runs exactly
as before.

## Security

- The anon/publishable key is safe to ship — **Row Level Security** is what
  protects data. The policy above limits every read and write to the row owner.
- Passwords are handled entirely by Supabase Auth; they never touch app code.
- `.env` is gitignored.

## Code map

| File | Role |
|------|------|
| `src/lib/supabase.ts` | Supabase client + `isCloudConfigured` gate |
| `src/store/authStore.ts` | Session state, sign-in/up/out |
| `src/store/syncStore.ts` | Sync status (idle/syncing/offline/error) |
| `src/utils/cloudSync.ts` | Push queue, two-way merge, tombstones, offline queue |
| `src/components/auth/AuthDialog.tsx` | Email/password modal |
| `src/components/auth/AccountButton.tsx` | Account chip + sync status menu |
| `src/hooks/usePersistence.ts` | Wires autosave + sync lifecycle |

## Not in v1 (future)

- Pulling inline base64 images out of `data` into Supabase Storage (keeps
  documents small and saves egress under heavy image use).
- Google sign-in; real-time multi-user collaboration.

# Cloud sync

Optional account-based sync layered on top of Canvas's local-first storage.
Guests keep the full app with everything in IndexedDB; signing in mirrors
canvases to Supabase so they follow you across devices.

## How it works

- **Signed in: cloud is authoritative.** While signed in, the cloud's canvas
  set is the source of truth and the same on every device. IndexedDB is kept as
  a fast local cache (so the app stays instant and works offline), but it never
  overrides the cloud: throwaway blank "Untitled N" placeholders that each
  device makes on first run are pruned on sign-in/sync so all devices converge
  on exactly the cloud's canvases. (Signed out, the app is purely local-first.)
- **Push.** Edits autosave to IndexedDB (500 ms), then push to Supabase on a
  short ~0.6 s debounce while signed in — a drag still coalesces into one write,
  but changes reach other devices in ~1–2 s.
- **Pull.** A full two-way merge runs on sign-in, on window focus, via
  "Sync now", and **in realtime** — a Supabase Realtime subscription pulls
  changes within ~1 s of another device saving them. Per-canvas
  **last-write-wins** by `updatedAt`. The open canvas is refreshed live unless
  you have local edits in flight (those are never clobbered). If the realtime
  channel can't connect (see below), the app logs a warning and falls back to
  syncing on focus/sign-in/"Sync now".
- **First sign-in.** Your existing local canvases are auto-uploaded to the
  account (no work is lost), then the cloud set takes over. Blank, never-touched
  "Untitled N" canvases are never synced — they're created fresh on every device,
  so syncing them would litter the account with duplicate empty canvases. Any
  such rows left by older builds are cleaned up.
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

   -- Realtime: let signed-in devices receive each other's changes live.
   alter publication supabase_realtime add table canvases;
   ```

3. Copy `.env.example` to `.env` and fill in **Project URL** and the
   **anon / publishable** key from **Project Settings → API**. Never use the
   `service_role` / secret key in the client.
4. `npm install` (pulls in `@supabase/supabase-js`), then `npm run dev`.

> **Live sync not working across devices?** Realtime only fires if the
> `canvases` table is in the `supabase_realtime` publication (the last line of
> the SQL above). Projects created before that line was added need it run once:
> `alter publication supabase_realtime add table canvases;`. The app logs a
> console warning if the realtime channel fails to connect.

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
| `src/utils/cloudSync.ts` | Push queue, two-way merge, tombstones, offline queue, realtime |
| `src/components/auth/AuthDialog.tsx` | Email/password modal |
| `src/components/auth/AccountButton.tsx` | Account chip + sync status menu |
| `src/hooks/usePersistence.ts` | Wires autosave + sync lifecycle |

## Not in v1 (future)

- Pulling inline base64 images out of `data` into Supabase Storage (keeps
  documents small and saves egress under heavy image use).
- Google sign-in; live multi-user *co-editing* (today's realtime sync is
  single-user/multi-device last-write-wins, not concurrent collaboration).

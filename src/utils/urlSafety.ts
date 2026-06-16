/** URL allow-listing for hyperlinks and iframe embeds. */

const BARE_HOST_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+(:\d+)?(\/.*)?$/i;

/**
 * Allow only http:, https:, mailto:. Bare hostnames get an https:// prefix.
 * Everything else (javascript:, data:, file:, vbscript:, blob:, …) → null.
 */
export function sanitizeHyperlink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (BARE_HOST_RE.test(candidate)) candidate = `https://${candidate}`;
    else return null;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
}

/** http/https only; bare hosts get https:// (no mailto). */
export function sanitizeEmbedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (BARE_HOST_RE.test(candidate)) candidate = `https://${candidate}`;
    else return null;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    return null;
  } catch {
    return null;
  }
}

export interface ResolvedEmbed {
  url: string;
  trusted: boolean;
  sandbox: string;
}

const TRUSTED_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups';
// Deliberately WITHOUT allow-same-origin: combining it with allow-scripts
// would let embedded content escape the sandbox.
const UNTRUSTED_SANDBOX = 'allow-scripts allow-forms allow-presentation allow-popups';

/** Rewrite YouTube/Vimeo URLs to their embed players; classify trust. */
export function resolveEmbed(rawUrl: string): ResolvedEmbed {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      let id = url.searchParams.get('v');
      if (!id && url.pathname.startsWith('/embed/')) id = url.pathname.slice(7).split('/')[0];
      if (!id && url.pathname.startsWith('/shorts/')) id = url.pathname.slice(8).split('/')[0];
      if (id && /^[\w-]{5,20}$/.test(id)) {
        return { url: `https://www.youtube.com/embed/${id}`, trusted: true, sandbox: TRUSTED_SANDBOX };
      }
    }
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      if (id && /^[\w-]{5,20}$/.test(id)) {
        return { url: `https://www.youtube.com/embed/${id}`, trusted: true, sandbox: TRUSTED_SANDBOX };
      }
    }
    if (host === 'vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { url: `https://player.vimeo.com/video/${id}`, trusted: true, sandbox: TRUSTED_SANDBOX };
      }
    }
    if (host === 'player.vimeo.com') {
      return { url: rawUrl, trusted: true, sandbox: TRUSTED_SANDBOX };
    }
  } catch {
    // fall through to untrusted
  }
  return { url: rawUrl, trusted: false, sandbox: UNTRUSTED_SANDBOX };
}

export const IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

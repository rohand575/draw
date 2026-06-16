import { describe, expect, it } from 'vitest';
import { resolveEmbed, sanitizeEmbedUrl, sanitizeHyperlink } from './urlSafety';

describe('sanitizeHyperlink', () => {
  it('allows http, https, mailto', () => {
    expect(sanitizeHyperlink('https://example.com')).toBe('https://example.com/');
    expect(sanitizeHyperlink('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
    expect(sanitizeHyperlink('mailto:hi@example.com')).toBe('mailto:hi@example.com');
  });
  it('prefixes bare hostnames with https', () => {
    expect(sanitizeHyperlink('example.com/page')).toBe('https://example.com/page');
  });
  it('rejects dangerous schemes', () => {
    expect(sanitizeHyperlink('javascript:alert(1)')).toBeNull();
    expect(sanitizeHyperlink('data:text/html,<script>')).toBeNull();
    expect(sanitizeHyperlink('file:///etc/passwd')).toBeNull();
    expect(sanitizeHyperlink('vbscript:msgbox')).toBeNull();
    expect(sanitizeHyperlink('blob:https://x')).toBeNull();
    expect(sanitizeHyperlink('not a url')).toBeNull();
  });
});

describe('sanitizeEmbedUrl', () => {
  it('allows only http/https', () => {
    expect(sanitizeEmbedUrl('https://example.com')).toBe('https://example.com/');
    expect(sanitizeEmbedUrl('mailto:hi@example.com')).toBeNull();
    expect(sanitizeEmbedUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('resolveEmbed', () => {
  it('rewrites YouTube watch URLs to embed and trusts them', () => {
    const r = resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(r.url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(r.trusted).toBe(true);
    expect(r.sandbox).toContain('allow-same-origin');
  });
  it('rewrites youtu.be short links', () => {
    expect(resolveEmbed('https://youtu.be/dQw4w9WgXcQ').url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
  it('rewrites Vimeo URLs to the player', () => {
    expect(resolveEmbed('https://vimeo.com/12345678').url).toBe('https://player.vimeo.com/video/12345678');
  });
  it('leaves arbitrary URLs untrusted without allow-same-origin', () => {
    const r = resolveEmbed('https://some-site.dev/page');
    expect(r.trusted).toBe(false);
    expect(r.sandbox).not.toContain('allow-same-origin');
    expect(r.sandbox).toContain('allow-scripts');
  });
});

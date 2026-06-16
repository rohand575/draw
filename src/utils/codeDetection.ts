/** Code-language detection on paste + a lightweight tokenizer for highlighting. */

export type CodeLanguage = 'json' | 'javascript' | 'python' | 'sql' | 'css' | 'html' | 'shell' | 'code';

export interface DetectedCode {
  isCode: true;
  language: CodeLanguage;
}

const JS_KEYWORDS = new Set(
  'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of this super yield delete void static get set interface type enum implements public private protected readonly'.split(' ')
);
const PY_KEYWORDS = new Set(
  'def class import from return if elif else for while in not and or is None True False try except finally raise with as lambda yield global nonlocal pass break continue assert del async await print match case'.split(' ')
);
const SQL_KEYWORDS = new Set(
  'select from where insert into values update set delete create table alter drop index view join inner left right outer on group by order having limit offset as distinct union all and or not null primary key foreign references constraint default unique check between like exists case when then else end count sum avg min max'.split(' ')
);
const SHELL_KEYWORDS = new Set(
  'if then else elif fi for while do done case esac function in echo cd ls rm mv cp mkdir sudo apt npm pip git curl wget export source exit return local read set unset'.split(' ')
);
const CSS_KEYWORDS = new Set(
  'important inherit initial unset auto none flex grid block inline absolute relative fixed sticky'.split(' ')
);

const BOOL_NULL = new Set(['true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'NULL', 'nil']);

/** Detect whether pasted text is code; returns null for prose. */
export function detectCode(text: string): DetectedCode | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lines = trimmed.split('\n');

  // JSON: strict parse of an object/array payload.
  if (/^[[{]/.test(trimmed) && trimmed.length > 8) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) return { isCode: true, language: 'json' };
    } catch {
      /* not json */
    }
  }

  // Single short line is almost never code worth highlighting.
  if (lines.length < 2 && trimmed.length < 24) return null;

  // HTML
  if (/^\s*<!doctype html/i.test(trimmed) || (/^\s*<[a-z!/]/i.test(trimmed) && /<\/[a-z][\w-]*>|\/>/i.test(trimmed))) {
    return { isCode: true, language: 'html' };
  }

  // SQL
  if (/\b(select\s[\s\S]*\bfrom\b|insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i.test(trimmed)) {
    return { isCode: true, language: 'sql' };
  }

  // Shell
  if (
    /^#!/.test(trimmed) ||
    lines.filter((l) => /^\s*(\$\s|sudo\s|apt(-get)?\s|npm\s|npx\s|pip3?\s|git\s|cd\s|curl\s|wget\s|echo\s|chmod\s|mkdir\s|docker\s)/.test(l)).length >=
      Math.max(1, Math.floor(lines.length / 2))
  ) {
    return { isCode: true, language: 'shell' };
  }

  // CSS
  if (/[.#@]?[\w-]+[^{}]*\{[^{}]*:[^{}]*;?[^{}]*\}/.test(trimmed) && /:\s*[^;{}]+;/.test(trimmed) && !/[=<>]/.test(trimmed.slice(0, 80))) {
    return { isCode: true, language: 'css' };
  }

  // Python
  if (
    /^\s*(def\s+\w+\s*\(|class\s+\w+[(:]|import\s+\w|from\s+[\w.]+\s+import\s)/m.test(trimmed) ||
    (/:\s*$/m.test(trimmed) && /^\s{2,}\S/m.test(text) && /\b(print|self|elif|lambda)\b/.test(trimmed))
  ) {
    return { isCode: true, language: 'python' };
  }

  // JavaScript / TypeScript
  if (
    /\b(const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|=>|\bconsole\.\w+\(|\bimport\s+.+\s+from\s+['"]|\bexport\s+(default|const|function|class)\b/.test(
      trimmed
    )
  ) {
    return { isCode: true, language: 'javascript' };
  }

  // Generic fallback: bracket density + indented-line ratio.
  if (lines.length >= 3) {
    const brackets = (trimmed.match(/[{}[\]();<>]/g) ?? []).length;
    const density = brackets / trimmed.length;
    const indented = lines.filter((l) => /^(\s{2,}|\t)/.test(l)).length / lines.length;
    const hasOperators = /[=;:]{1}/.test(trimmed);
    if ((density > 0.04 && hasOperators) || (indented > 0.4 && density > 0.015)) {
      return { isCode: true, language: 'code' };
    }
  }
  return null;
}

export interface CodeToken {
  text: string;
  kind: 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'punctuation' | 'property' | 'boolean' | 'default';
}

export const CODE_THEME_DARK: Record<CodeToken['kind'], string> = {
  keyword: '#c792ea',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#6c7086',
  function: '#82aaff',
  punctuation: '#89ddff',
  property: '#ffcb6b',
  boolean: '#ff9e64',
  default: '#cdd6f4',
};

export const CODE_THEME_LIGHT: Record<CodeToken['kind'], string> = {
  keyword: '#9d4edd',
  string: '#2f9e44',
  number: '#e8590c',
  comment: '#868e96',
  function: '#1971c2',
  punctuation: '#0c8599',
  property: '#e67700',
  boolean: '#d6336c',
  default: '#1e1e2e',
};

function keywordsFor(lang: string): Set<string> {
  switch (lang) {
    case 'python':
      return PY_KEYWORDS;
    case 'sql':
      return SQL_KEYWORDS;
    case 'shell':
      return SHELL_KEYWORDS;
    case 'css':
      return CSS_KEYWORDS;
    default:
      return JS_KEYWORDS;
  }
}

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:=+\-*/<>!&|^%?@~]+)|(\s+)|(.)/g;

/** Tokenize one line of code for syntax-colored rendering. */
export function tokenizeLine(line: string, language: string): CodeToken[] {
  const keywords = keywordsFor(language);
  const tokens: CodeToken[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let prev: CodeToken | null = null;

  while ((m = TOKEN_RE.exec(line)) !== null) {
    const [full, comment, string, number, ident, punct] = m;
    let kind: CodeToken['kind'] = 'default';
    if (comment !== undefined) kind = 'comment';
    else if (string !== undefined) kind = 'string';
    else if (number !== undefined) kind = 'number';
    else if (ident !== undefined) {
      const lower = language === 'sql' ? ident.toLowerCase() : ident;
      if (BOOL_NULL.has(ident)) kind = 'boolean';
      else if (keywords.has(lower)) kind = 'keyword';
      else {
        // Function call lookahead, or property after dot / before colon (json & css).
        const rest = line.slice(m.index + full.length);
        if (/^\s*\(/.test(rest)) kind = 'function';
        else if (prev?.text.endsWith('.')) kind = 'property';
        else if ((language === 'json' || language === 'css') && /^\s*:/.test(rest)) kind = 'property';
      }
    } else if (punct !== undefined) kind = 'punctuation';

    const token: CodeToken = { text: full, kind };
    tokens.push(token);
    if (full.trim()) prev = token;
  }
  return tokens;
}

/** Friendly label for the badge in the code block corner. */
export function languageLabel(lang: string | undefined): string {
  switch (lang) {
    case 'javascript':
      return 'JS';
    case 'python':
      return 'PY';
    case 'json':
      return 'JSON';
    case 'sql':
      return 'SQL';
    case 'css':
      return 'CSS';
    case 'html':
      return 'HTML';
    case 'shell':
      return 'SH';
    default:
      return 'CODE';
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Build syntax-highlighted HTML for the inline code editor overlay, with
 * optional find-match ranges wrapped in highlight spans.
 */
export function buildCodeHighlightHtml(
  text: string,
  language: string,
  theme: Record<CodeToken['kind'], string>,
  matches?: { start: number; end: number; active: boolean }[]
): string {
  const lines = text.split('\n');
  let offset = 0;
  const html: string[] = [];

  for (const line of lines) {
    const lineStart = offset;
    const tokens = tokenizeLine(line, language);
    let col = 0;
    const parts: string[] = [];
    for (const tok of tokens) {
      const tokStart = lineStart + col;
      const tokEnd = tokStart + tok.text.length;
      let inner = escapeHtml(tok.text);
      if (matches?.length) {
        // Wrap overlapping match ranges (token-granular highlighting).
        for (const match of matches) {
          if (match.start < tokEnd && match.end > tokStart) {
            const bg = match.active ? 'rgba(250,204,21,0.55)' : 'rgba(252,232,170,0.35)';
            inner = `<span style="background:${bg};border-radius:2px">${inner}</span>`;
            break;
          }
        }
      }
      parts.push(`<span style="color:${theme[tok.kind]}">${inner}</span>`);
      col += tok.text.length;
    }
    html.push(parts.join('') || '&nbsp;');
    offset += line.length + 1;
  }
  return html.join('\n');
}

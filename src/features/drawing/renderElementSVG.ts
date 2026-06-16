/** SVG export rendering — mirrors renderElement but emits SVG nodes. */
import type { RoughSVG } from 'roughjs/bin/svg';
import type { CanvasElement, Theme } from '../../types';
import { CODE_BG, CODE_FONT, HAND_FONT, UI_FONT } from '../../constants';
import { generateDrawables, getTextLines, textFont, textLineHeight, CODE_PADDING } from './renderElement';
import { getElbowRoute, getElementBounds, getLineEndpoints } from '../../utils/geometry';
import { CODE_THEME_DARK, languageLabel, tokenizeLine } from '../../utils/codeDetection';
import { getMeasureCtx } from '../../utils/textWrap';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function escapeAttr(s: string): string {
  return s;
}

export function renderElementSVG(rs: RoughSVG, el: CanvasElement, theme: Theme): SVGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('opacity', String(el.opacity));
  const b = getElementBounds(el);
  const dark = theme === 'dark';

  switch (el.type) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse':
    case 'freehand':
    case 'line':
    case 'arrow': {
      for (const d of generateDrawables(rs.generator, el)) {
        g.appendChild(rs.draw(d));
      }
      if ((el.type === 'line' || el.type === 'arrow') && el.connectorLabel) {
        let mx: number;
        let my: number;
        if (el.connectorStyle === 'elbow') {
          const route = getElbowRoute(el);
          mx = (route[1].x + route[2].x) / 2;
          my = (route[1].y + route[2].y) / 2;
        } else {
          const [s, e] = getLineEndpoints(el);
          mx = (s.x + e.x) / 2;
          my = (s.y + e.y) / 2;
        }
        const ctx = getMeasureCtx();
        ctx.font = `500 13px ${UI_FONT}`;
        const w = ctx.measureText(el.connectorLabel).width;
        g.appendChild(
          svgEl('rect', {
            x: mx - w / 2 - 9,
            y: my - 12,
            width: w + 18,
            height: 24,
            rx: 12,
            fill: dark ? '#22222e' : '#ffffff',
            stroke: 'rgba(99,102,241,0.55)',
          })
        );
        const text = svgEl('text', {
          x: mx,
          y: my + 4.5,
          'text-anchor': 'middle',
          'font-family': UI_FONT,
          'font-size': 13,
          fill: dark ? '#d4d4e2' : '#37374a',
        });
        text.textContent = escapeAttr(el.connectorLabel);
        g.appendChild(text);
      }
      break;
    }
    case 'text': {
      if (el.isCode) {
        g.appendChild(
          svgEl('rect', { x: b.x, y: b.y, width: b.width, height: b.height, rx: 10, fill: CODE_BG })
        );
        const label = svgEl('text', {
          x: b.x + b.width - 10,
          y: b.y + 18,
          'text-anchor': 'end',
          'font-family': UI_FONT,
          'font-size': 10,
          'font-weight': 600,
          fill: '#8e95b3',
        });
        label.textContent = languageLabel(el.codeLanguage);
        g.appendChild(label);

        const lh = textLineHeight(el);
        const fs = el.fontSize ?? 14;
        const lines = (el.text ?? '').split('\n');
        const ctx = getMeasureCtx();
        ctx.font = textFont(el);
        lines.forEach((line, i) => {
          let x = b.x + CODE_PADDING;
          const y = b.y + CODE_PADDING + i * lh + fs * 0.85;
          for (const tok of tokenizeLine(line, el.codeLanguage ?? 'code')) {
            if (tok.text.trim()) {
              const t = svgEl('text', {
                x,
                y,
                'font-family': CODE_FONT,
                'font-size': fs,
                fill: CODE_THEME_DARK[tok.kind],
                'xml:space': 'preserve',
              });
              t.textContent = tok.text;
              g.appendChild(t);
            }
            x += ctx.measureText(tok.text).width;
          }
        });
      } else {
        const lh = textLineHeight(el);
        const fs = el.fontSize ?? 20;
        getTextLines(el).forEach((line, i) => {
          const t = svgEl('text', {
            x: el.x,
            y: el.y + lh * 0.08 + i * lh + fs * 0.8,
            'font-family': HAND_FONT,
            'font-size': fs,
            fill: el.strokeColor,
            'xml:space': 'preserve',
          });
          t.textContent = line;
          g.appendChild(t);
        });
      }
      break;
    }
    case 'image': {
      if (el.imageData) {
        g.appendChild(
          svgEl('image', { x: b.x, y: b.y, width: b.width, height: b.height, href: el.imageData })
        );
      }
      break;
    }
    case 'embed': {
      g.appendChild(
        svgEl('rect', {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          rx: 12,
          fill: dark ? '#1c1c26' : '#ffffff',
          stroke: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        })
      );
      const t = svgEl('text', {
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        'text-anchor': 'middle',
        'font-family': UI_FONT,
        'font-size': 12,
        fill: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
      });
      t.textContent = el.embedUrl ?? 'Embed';
      g.appendChild(t);
      break;
    }
    case 'frame': {
      g.appendChild(
        svgEl('rect', {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          fill: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          stroke: dark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)',
          'stroke-dasharray': '8 6',
          'stroke-width': Math.max(1, el.strokeWidth * 0.75),
        })
      );
      const t = svgEl('text', {
        x: b.x + 2,
        y: b.y - 6,
        'font-family': UI_FONT,
        'font-size': 12,
        'font-weight': 500,
        fill: dark ? 'rgba(148,163,184,0.9)' : 'rgba(100,116,139,0.95)',
      });
      t.textContent = el.frameName ?? 'Frame';
      g.appendChild(t);
      break;
    }
  }
  return g;
}

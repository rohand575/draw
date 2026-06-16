/**
 * DOM iframe layer above the canvas. The wrapper transform is synced
 * imperatively to pan/zoom so panning never re-renders React.
 */
import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { IFRAME_ALLOW, resolveEmbed } from '../../utils/urlSafety';

interface Props {
  activeEmbedId: string | null;
}

export function EmbedLayer({ activeEmbedId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const embeds = useElementStore((s) => s.elements).filter((el) => el.type === 'embed' && el.embedUrl);

  useEffect(() => {
    const apply = () => {
      const { offsetX, offsetY, zoom } = useCanvasStore.getState();
      if (wrapRef.current) {
        wrapRef.current.style.transform = `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`;
      }
    };
    apply();
    return useCanvasStore.subscribe(apply);
  }, []);

  if (embeds.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden={false}>
      <div ref={wrapRef} style={{ transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
        {embeds.map((el) => {
          const resolved = resolveEmbed(el.embedUrl!);
          const active = activeEmbedId === el.id;
          return (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: Math.abs(el.width),
                height: Math.abs(el.height),
                borderRadius: 12,
                overflow: 'hidden',
                opacity: el.opacity,
                pointerEvents: active ? 'auto' : 'none',
                boxShadow: active ? '0 0 0 2px #6366f1' : 'none',
              }}
            >
              <iframe
                src={resolved.url}
                sandbox={resolved.sandbox}
                allow={IFRAME_ALLOW}
                allowFullScreen
                title="Canvas embed"
                style={{ width: '100%', height: '100%', border: 'none', background: '#0c0c12' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

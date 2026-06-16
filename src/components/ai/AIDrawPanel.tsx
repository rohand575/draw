/** AI Draw / AI Diagram — bottom-center panel powered by GPT-4o. */
import { useEffect, useRef, useState } from 'react';
import { useAIStore } from '../../store/aiStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { historyActions } from '../../hooks/useHistory';
import { getViewportCenterWorld } from '../../utils/actions';
import { generateDrawing, type AIMode } from '../../utils/aiDrawService';
import { getElementsBounds } from '../../utils/geometry';
import { Icon } from '../ui/Icon';

export function AIDrawPanel() {
  const { isOpen, apiKey, setOpen, setApiKey } = useAIStore();
  const [mode, setMode] = useState<AIMode>('draw');
  const [prompt, setPrompt] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySectionOpen, setKeySectionOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const needsKey = !apiKey;
  const keyVisible = needsKey || keySectionOpen;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTimeout(() => promptRef.current?.focus(), 50);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    if (!apiKey) {
      setKeySectionOpen(true);
      setError('Add your OpenAI API key first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const center = getViewportCenterWorld();
      const store = useElementStore.getState();
      const elements = await generateDrawing(trimmed, apiKey, center.x, center.y, store.getMaxZIndex() + 1, mode);
      historyActions.saveSnapshot();
      store.addElements(elements);
      useToolStore.getState().setSelectedIds(elements.map((el) => el.id));
      useToolStore.getState().setActiveTool('select');
      const bounds = getElementsBounds(elements);
      if (bounds) useCanvasStore.getState().zoomToBounds(bounds, window.innerWidth, window.innerHeight, 80);
      setPrompt('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    setApiKey(keyDraft.trim());
    setKeyDraft('');
    setKeySectionOpen(false);
    promptRef.current?.focus();
  };

  return (
    <div
      className="panel animate-in pointer-events-auto fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
      style={{ width: mode === 'draw' ? 520 : 640, maxWidth: 'calc(100vw - 32px)' }}
      role="dialog"
      aria-label="AI Draw"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <Icon name="sparkles" size={14} />
        </span>
        <div className="mr-auto">
          <h2 className="text-[13.5px] leading-tight font-semibold">AI Draw</h2>
          <p className="text-[10.5px] opacity-45">Powered by GPT-4o</p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-black/[0.045] p-0.5 dark:bg-white/[0.06]" role="tablist">
          {(['draw', 'diagram'] as AIMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-[7px] px-3 py-1 text-[12px] font-medium capitalize transition-all ${
                mode === m ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-300' : 'opacity-55 hover:opacity-90'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {!needsKey && (
          <button
            type="button"
            className="ui-btn h-7 px-2 text-[11px] font-medium opacity-55"
            onClick={() => setKeySectionOpen((v) => !v)}
          >
            API key
          </button>
        )}
        <button type="button" className="ui-btn h-7 w-7" onClick={() => setOpen(false)} aria-label="Close AI panel">
          <Icon name="close" size={13} />
        </button>
      </div>

      {/* API key section */}
      {keyVisible && (
        <div className="mx-4 mt-3 rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
          <label className="text-[11.5px] font-medium opacity-65" htmlFor="openai-key">
            OpenAI API key
          </label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                id="openai-key"
                type={showKey ? 'text' : 'password'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') saveKey();
                }}
                placeholder={apiKey ? '••••••••  (key saved — paste to replace)' : 'sk-…'}
                className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 pr-8 text-[12.5px] outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-gray-800"
              />
              <button
                type="button"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-40 hover:opacity-80"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                <Icon name={showKey ? 'eyeOff' : 'eye'} size={14} />
              </button>
            </div>
            <button
              type="button"
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-600 disabled:opacity-40"
              disabled={!keyDraft.trim()}
              onClick={saveKey}
            >
              Save
            </button>
          </div>
          <p className="mt-1.5 text-[10.5px] opacity-45">Your key is stored locally and never sent anywhere except OpenAI.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 rounded-xl border border-red-300/60 bg-red-500/[0.07] px-3 py-2 text-[12px] text-red-500 dark:border-red-500/30">
          {error}
        </div>
      )}

      {/* Prompt */}
      <div className="relative p-4 pt-3">
        <textarea
          ref={promptRef}
          rows={mode === 'draw' ? 2 : 8}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') setOpen(false);
            const submit = mode === 'draw' ? e.key === 'Enter' && !e.shiftKey : e.key === 'Enter' && (e.ctrlKey || e.metaKey);
            if (submit) {
              e.preventDefault();
              void generate();
            }
          }}
          placeholder={
            mode === 'draw'
              ? 'Describe something to draw… e.g. "a lighthouse on a cliff at sunset"'
              : 'Paste a process, system description, or notes — get a structured flowchart…'
          }
          className="w-full resize-none rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:opacity-40 focus:border-indigo-400 dark:border-white/10 dark:bg-white/[0.03]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] opacity-40">
            {mode === 'draw' ? 'Enter to generate · Shift+Enter for newline' : 'Ctrl+Enter to generate'}
          </span>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!prompt.trim() || loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-1.5 text-[13px] font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:shadow-none"
          >
            <Icon name="sparkles" size={13} />
            Generate
          </button>
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 m-1 flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-white/85 backdrop-blur-sm dark:bg-gray-900/85">
            <span className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-indigo-200 border-t-indigo-500" />
            <p className="text-[13px] font-medium">{mode === 'draw' ? 'Drawing…' : 'Analyzing and building diagram…'}</p>
            <p className="text-[11px] opacity-45">
              {mode === 'draw' ? 'This usually takes a few seconds' : 'Complex diagrams may take 10–20 seconds'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

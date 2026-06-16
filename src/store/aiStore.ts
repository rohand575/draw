import { create } from 'zustand';
import { LS_OPENAI_KEY } from '../constants';

interface AIStore {
  isOpen: boolean;
  apiKey: string;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setApiKey: (key: string) => void;
}

const loadKey = (): string => {
  try {
    return localStorage.getItem(LS_OPENAI_KEY) ?? '';
  } catch {
    return '';
  }
};

export const useAIStore = create<AIStore>((set) => ({
  isOpen: false,
  apiKey: loadKey(),

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setApiKey: (key) => {
    try {
      localStorage.setItem(LS_OPENAI_KEY, key);
    } catch {
      /* ignore */
    }
    set({ apiKey: key });
  },
}));

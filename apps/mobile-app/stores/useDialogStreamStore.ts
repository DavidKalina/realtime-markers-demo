import { create } from "zustand";
import * as Haptics from "expo-haptics";
import {
  CHAR_DELAY_MS,
  AUTO_ADVANCE_MS,
} from "@/components/AreaScan/AreaScanComponents";

// --- Module-scope mutable state (non-reactive, avoids re-renders) ---

let streamTimer: ReturnType<typeof setTimeout> | null = null;
let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
let charIndex = 0;
let currentPageText = "";

// --- Store types ---

interface DialogStreamState {
  pages: string[];
  pageIndex: number;
  displayText: string;
  pageComplete: boolean;
  feedPages: (pages: string[]) => void;
  handleTap: () => void;
  restart: () => void;
  cancel: () => void;
}

// --- Streaming logic ---

function clearTimers() {
  if (streamTimer) {
    clearTimeout(streamTimer);
    streamTimer = null;
  }
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
}

function startStreaming(
  set: (partial: Partial<DialogStreamState>) => void,
  get: () => DialogStreamState,
  text: string,
) {
  clearTimers();
  charIndex = 0;
  currentPageText = text;
  set({ displayText: "", pageComplete: false });

  const tick = () => {
    const i = charIndex;
    if (i < currentPageText.length) {
      charIndex = i + 1;
      set({ displayText: currentPageText.slice(0, i + 1) });
      if (i % 4 === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      streamTimer = setTimeout(tick, CHAR_DELAY_MS);
    } else {
      streamTimer = null;
      set({ pageComplete: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      // Auto-advance if not last page
      const { pages, pageIndex } = get();
      if (pageIndex < pages.length - 1) {
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null;
          const next = pageIndex + 1;
          set({ pageIndex: next });
          startStreaming(set, get, pages[next]);
        }, AUTO_ADVANCE_MS);
      }
    }
  };

  streamTimer = setTimeout(tick, 60);
}

// --- Store ---

export const useDialogStreamStore = create<DialogStreamState>((set, get) => ({
  pages: [],
  pageIndex: 0,
  displayText: "",
  pageComplete: false,

  feedPages: (pages) => {
    clearTimers();
    if (pages.length > 0) {
      set({ pages, pageIndex: 0, displayText: "", pageComplete: false });
      startStreaming(set, get, pages[0]);
    } else {
      set({ pages, pageIndex: 0, displayText: "", pageComplete: false });
    }
  },

  handleTap: () => {
    // Cancel auto-advance
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    // If still streaming, skip to end of current page
    if (streamTimer) {
      clearTimeout(streamTimer);
      streamTimer = null;
      set({ displayText: currentPageText, pageComplete: true });
      charIndex = currentPageText.length;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      // Schedule auto-advance if not last page
      const { pages, pageIndex } = get();
      if (pageIndex < pages.length - 1) {
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null;
          const next = pageIndex + 1;
          set({ pageIndex: next });
          startStreaming(set, get, pages[next]);
        }, AUTO_ADVANCE_MS);
      }
      return;
    }

    const { pageComplete, pageIndex, pages } = get();

    // Advance to next page
    if (pageComplete && pageIndex < pages.length - 1) {
      const next = pageIndex + 1;
      set({ pageIndex: next });
      startStreaming(set, get, pages[next]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  },

  restart: () => {
    const { pages } = get();
    if (pages.length > 0) {
      set({ pageIndex: 0, displayText: "", pageComplete: false });
      startStreaming(set, get, pages[0]);
    }
  },

  cancel: () => {
    clearTimers();
    charIndex = 0;
    currentPageText = "";
    set({ pages: [], pageIndex: 0, displayText: "", pageComplete: false });
  },
}));

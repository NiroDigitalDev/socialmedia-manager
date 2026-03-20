import { create } from "zustand";

interface ArenaStore {
  currentRoundId: string | null;
  swipeDirection: "left" | "right" | "up" | null;
  showRatingOverlay: boolean;
  showRejectOverlay: boolean;

  setCurrentRound: (roundId: string | null) => void;
  setSwipeDirection: (dir: "left" | "right" | "up" | null) => void;
  setShowRatingOverlay: (show: boolean) => void;
  setShowRejectOverlay: (show: boolean) => void;
  reset: () => void;
}

export const useArenaStore = create<ArenaStore>((set) => ({
  currentRoundId: null,
  swipeDirection: null,
  showRatingOverlay: false,
  showRejectOverlay: false,

  setCurrentRound: (roundId) => set({ currentRoundId: roundId }),
  setSwipeDirection: (dir) => set({ swipeDirection: dir }),
  setShowRatingOverlay: (show) => set({ showRatingOverlay: show }),
  setShowRejectOverlay: (show) => set({ showRejectOverlay: show }),
  reset: () =>
    set({
      currentRoundId: null,
      swipeDirection: null,
      showRatingOverlay: false,
      showRejectOverlay: false,
    }),
}));

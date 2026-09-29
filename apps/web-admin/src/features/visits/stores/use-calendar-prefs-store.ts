import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CalendarPrefsState {
  /** 달력 칸에 그날 방문을 모두 보여 준다("+N건 더"로 줄이지 않는다). */
  expandAll: boolean;
  setExpandAll: (expandAll: boolean) => void;
}

/** 관리 웹 달력 보기 설정. 새로고침해도 유지되도록 브라우저에 저장한다. */
export const useCalendarPrefsStore = create<CalendarPrefsState>()(
  persist(
    (set) => ({
      expandAll: false,
      setExpandAll: (expandAll) => set({ expandAll }),
    }),
    {
      name: "carenote-admin-calendar-prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ expandAll }) => ({ expandAll }),
    },
  ),
);

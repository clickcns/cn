import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface OrganizationScopeState {
  /** 운영자가 헤더에서 고른 기관. null이면 전체 기관. */
  organizationId: string | null;
  setOrganizationId: (organizationId: string | null) => void;
}

/** 운영자(ADMIN)의 "기관 선택" 값. 새로고침해도 유지되도록 저장한다. */
export const useOrganizationScopeStore = create<OrganizationScopeState>()(
  persist(
    (set) => ({
      organizationId: null,
      setOrganizationId: (organizationId) => set({ organizationId }),
    }),
    {
      name: "carenote-admin-organization-scope",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ organizationId }) => ({ organizationId }),
    },
  ),
);

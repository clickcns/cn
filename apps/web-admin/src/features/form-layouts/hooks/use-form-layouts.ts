import { getErrorMessage } from "@repo/api-client";
import type {
  FormLayoutAdjustments,
  FormLayoutDetail,
  OriginalPdfFormId,
  SaveFormLayoutInput,
} from "@repo/shared-types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** 원본 서식마다 조정한 칸 수·저장 정보(서식 탭). */
export function useFormLayouts() {
  return useQuery({
    queryKey: queryKeys.formLayouts.list(),
    queryFn: () => api.formLayouts.list(),
  });
}

export function useFormLayout(formId: OriginalPdfFormId) {
  return useQuery({
    queryKey: queryKeys.formLayouts.detail(formId),
    queryFn: () => api.formLayouts.get(formId),
  });
}

/**
 * 조정한 자리로 그린 표본 PDF. adjustments 는 정리한 조정의 JSON 글이다(같은 조정은 캐시를 쓴다).
 * 새 PDF를 받는 동안 이전 PDF를 그대로 보여 준다.
 */
export function useFormLayoutPreview(
  formId: OriginalPdfFormId,
  adjustments: string,
) {
  return useQuery({
    queryKey: queryKeys.formLayouts.preview(formId, adjustments),
    queryFn: ({ signal }) =>
      api.formLayouts.preview(
        formId,
        { adjustments: JSON.parse(adjustments) as FormLayoutAdjustments },
        signal,
      ),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    // 지난 조정의 PDF(수백 KB)는 곧 버린다. 저장본으로 되돌릴 때만 다시 쓸 일이 있다.
    gcTime: 5_000,
  });
}

function useApplySaved() {
  const queryClient = useQueryClient();
  return async (detail: FormLayoutDetail) => {
    queryClient.setQueryData(
      queryKeys.formLayouts.detail(detail.formId),
      detail,
    );
    await queryClient.invalidateQueries({
      queryKey: queryKeys.formLayouts.list(),
    });
  };
}

export function useSaveFormLayout(formId: OriginalPdfFormId) {
  const applySaved = useApplySaved();
  return useMutation({
    mutationFn: (input: SaveFormLayoutInput) =>
      api.formLayouts.save(formId, input),
    onSuccess: async (detail) => {
      await applySaved(detail);
      toast.success("저장했습니다. 모든 기관의 원본 서식 PDF에 적용됩니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useResetFormLayout(formId: OriginalPdfFormId) {
  const applySaved = useApplySaved();
  return useMutation({
    mutationFn: () => api.formLayouts.reset(formId),
    onSuccess: async (detail) => {
      await applySaved(detail);
      toast.success("기본 자리로 되돌렸습니다");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

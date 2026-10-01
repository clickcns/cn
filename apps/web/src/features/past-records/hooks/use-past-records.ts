import {
  latestFieldValuesByForm,
  type RecipientRecordPage,
  type RecipientRecordQuery,
  type VisitDetail,
} from "@repo/shared-types";
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { visitKeys } from "@/lib/query-keys";

/** 지난 기록의 기준 방문: 그 방문보다 앞선 기록을 최신순으로 받고, 그 방문의 서식으로 불러온다. */
export type PastRecordsAnchor = Pick<
  VisitDetail,
  "id" | "recipient" | "formIds"
>;

function pastRecordsOptions(visit: PastRecordsAnchor) {
  const recipientId = visit.recipient.id;
  const query: RecipientRecordQuery = { beforeVisitId: visit.id };
  return infiniteQueryOptions({
    queryKey: visitKeys.pastRecords(recipientId, query),
    queryFn: ({ pageParam }) =>
      api.recipients.records(recipientId, { ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: RecipientRecordPage) =>
      lastPage.nextCursor ?? undefined,
  });
}

// select 는 모듈 수준 함수로 둔다: 같은 함수·같은 데이터면 react-query 가 결과를 재사용하므로
// 녹음 중 기록 화면이 자주 다시 그려져도 다시 계산하지 않는다.
const allRecords = (data: InfiniteData<RecipientRecordPage>) =>
  data.pages.flatMap((page) => page.items);

const pastFieldValues = (data: InfiniteData<RecipientRecordPage>) =>
  latestFieldValuesByForm(allRecords(data));

/** 지난 기록(최신순, "더 보기"로 이어 받는다). */
export function usePastRecords(visit: PastRecordsAnchor) {
  return useInfiniteQuery({ ...pastRecordsOptions(visit), select: allRecords });
}

/** 받아 둔 지난 기록에서 서식·칸마다 가장 최근 값(칸 옆 "지난 값"). 아직 없으면 undefined. */
export function usePastFieldValues(visit: PastRecordsAnchor) {
  return useInfiniteQuery({
    ...pastRecordsOptions(visit),
    select: pastFieldValues,
  }).data;
}

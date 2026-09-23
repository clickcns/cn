export const ROUTES = {
  LOGIN: "/login",
  VISITS: "/",
  NEW_VISIT: "/visits/new",
  VISIT_DETAIL: "/visits/:visitId",
  RECIPIENTS: "/recipients",
  RECIPIENT_DETAIL: "/recipients/:recipientId",
  ME: "/me",
} as const;

/** 방문 목록. 오늘이 아닌 날짜는 ?date=로 유지해 뒤로 가기 때 그 날짜로 돌아온다. */
export function visitsPath(date?: string): string {
  return date ? `/?date=${date}` : ROUTES.VISITS;
}

export function newVisitPath(params: {
  date?: string;
  recipientId?: string;
}): string {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  if (params.recipientId) search.set("recipientId", params.recipientId);
  const query = search.toString();
  return query ? `${ROUTES.NEW_VISIT}?${query}` : ROUTES.NEW_VISIT;
}

export function visitPath(id: string): string {
  return `/visits/${id}`;
}

export function recipientPath(id: string): string {
  return `/recipients/${id}`;
}

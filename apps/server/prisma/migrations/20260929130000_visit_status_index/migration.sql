-- 현황판의 "확정 안 된 지난 방문": 기관 안에서 상태(예정·작성 중)와 날짜(어제까지)로 찾는다.
-- 기관·일시 인덱스만 있으면 보관 기간(5년) 내내 쌓이는 지난 방문을 모두 훑는다.

-- CreateIndex
CREATE INDEX "visits_organizationId_status_scheduledAt_idx" ON "visits"("organizationId", "status", "scheduledAt");

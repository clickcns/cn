-- 방문 일시의 한국 날짜(UTC+9, 서머타임 없음). 건수만 줄 때 달력의 날짜별 건수를 DB에서 센다(GROUP BY).
-- scheduledAt(UTC로 저장)에서 DB가 계산하는 생성 열이라 앱은 읽기만 한다(쓰면 DB가 거절한다).
-- schema.prisma에 생성식을 dbgenerated 기본값으로 똑같이 적어 두어야 migrate diff가 비어 있다.
-- +9시간은 shared-types의 KST_OFFSET과 같다.
ALTER TABLE "visits"
  ADD COLUMN "scheduledDate" DATE NOT NULL GENERATED ALWAYS AS (("scheduledAt" + INTERVAL '9 hours')::date) STORED;

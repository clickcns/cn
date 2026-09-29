-- 방문한 직종. 만들 때 담당자 직종으로 정하고 담당자를 바꾸면 새 직종이 된다.
-- 같은 날 산정 제외·재택의료 월 요건·서식 규칙은 담당자의 지금 직종이 아니라 이 값을 쓴다.

-- AlterTable
ALTER TABLE "visits" ADD COLUMN "profession" "Profession";

-- 기존 방문: 방문의 필수 서식으로 판정하고(서식은 만들 때 담당자 직종으로 정했다),
-- 판정할 수 없으면 담당자의 지금 직종으로 채운다.
UPDATE "visits" v
SET "profession" = CASE
  WHEN 'HOME_CARE_DOCTOR' = ANY(v."formIds") THEN 'DOCTOR'::"Profession"
  WHEN 'HOME_CARE_NURSE' = ANY(v."formIds") THEN 'NURSE'::"Profession"
  WHEN 'HOME_CARE_SOCIAL' = ANY(v."formIds") THEN 'SOCIAL_WORKER'::"Profession"
  WHEN 'LTC_NURSING' = ANY(v."formIds") THEN 'NURSE'::"Profession"
  WHEN v."program" = 'PRIMARY_CARE' THEN 'DOCTOR'::"Profession"
  ELSE (SELECT u."profession" FROM "users" u WHERE u."id" = v."staffId")
END;

ALTER TABLE "visits" ALTER COLUMN "profession" SET NOT NULL;

-- 수급자 등록 사업.

-- AlterTable
ALTER TABLE "recipients" ADD COLUMN "programs" "Program"[] DEFAULT ARRAY[]::"Program"[];

-- 기존 수급자: 방문한 사업 중 기관이 지금 하고 등록할 수 있는 것으로 채우고, 그런 방문이 없으면
-- 기관 사업 중 등록할 수 있는 것으로 채운다(재택의료센터·장기요양 방문간호는 장기요양등급이 있어야 한다).
UPDATE "recipients" r
SET "programs" = ARRAY(
  SELECT DISTINCT v."program" FROM "visits" v
  WHERE v."recipientId" = r."id"
    AND v."program" = ANY(o."programs")
    AND (v."program" = 'PRIMARY_CARE' OR r."careGrade" IS NOT NULL)
)
FROM "organizations" o
WHERE o."id" = r."organizationId";

UPDATE "recipients" r
SET "programs" = ARRAY(
  SELECT p FROM unnest(o."programs") AS p
  WHERE p = 'PRIMARY_CARE' OR r."careGrade" IS NOT NULL
)
FROM "organizations" o
WHERE o."id" = r."organizationId" AND cardinality(r."programs") = 0;

-- 재택의료센터 수급자는 일차의료 방문진료를 따로 두지 않는다(의사 방문은 재택의료센터 방문에서 별지 제4호를 함께 쓴다).
UPDATE "recipients"
SET "programs" = array_remove("programs", 'PRIMARY_CARE')
WHERE 'HOME_CARE_CENTER' = ANY("programs");

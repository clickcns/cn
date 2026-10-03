-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'DOWNLOAD', 'PERMISSION');

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorUsername" TEXT NOT NULL,
    "actorName" TEXT,
    "actorRole" "Role",
    "organizationIds" TEXT[],
    "ip" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "label" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "recipientIds" TEXT[],
    "subjectCount" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "detail" JSONB,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_logs_at_idx" ON "access_logs"("at");

-- CreateIndex
CREATE INDEX "access_logs_actorId_at_idx" ON "access_logs"("actorId", "at");

-- CreateIndex
CREATE INDEX "access_logs_recipientIds_idx" ON "access_logs" USING GIN ("recipientIds");

-- CreateIndex
CREATE INDEX "access_logs_organizationIds_idx" ON "access_logs" USING GIN ("organizationIds");


-- 접속기록은 고칠 수 없고, 3년이 지난 행만 지울 수 있다(위·변조 방지). "at"은 UTC로 저장된다.
CREATE FUNCTION "access_logs_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'access_logs: 접속기록은 고칠 수 없습니다';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'access_logs: 접속기록은 한꺼번에 지울 수 없습니다';
  END IF;
  IF OLD."at" > (now() AT TIME ZONE 'UTC') - interval '3 years' THEN
    RAISE EXCEPTION 'access_logs: 3년이 지나지 않은 접속기록은 지울 수 없습니다';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "access_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "access_logs"
  FOR EACH ROW EXECUTE FUNCTION "access_logs_guard"();

CREATE TRIGGER "access_logs_no_truncate"
  BEFORE TRUNCATE ON "access_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "access_logs_guard"();

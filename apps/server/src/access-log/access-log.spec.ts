import "reflect-metadata";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import {
  ACCESS_LOG_MAX_SUBJECTS,
  AccessLogQuerySchema,
  accessSubjects,
  accessTargetText,
  changedFieldNames,
  searchConditions,
} from "@repo/shared-types";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import {
  ACCESS_LOG_KEY,
  NO_ACCESS_LOG_KEY,
  fromParam,
  fromResult,
  listOf,
  type AccessLogSpec,
} from "./access-log.decorator.js";
import {
  accessActor,
  accessLogWhere,
  buildAccessLog,
  permissionChanges,
  scopeOrganizationId,
  type ResolvedTarget,
} from "./access-log.entry.js";

/** 테스트는 apps/server에서 돈다(pnpm test). */
const SRC = join(process.cwd(), "src");

function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "generated" ? [] : controllerFiles(path);
    }
    return entry.name.endsWith(".controller.ts") ? [path] : [];
  });
}

const staff: AuthenticatedUser = {
  id: "u1",
  username: "nurse1",
  name: "김간호",
  role: "STAFF",
  profession: "NURSE",
  organizationId: "org1",
  sessionId: "s1",
};

function request(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/x",
    route: { path: "/api/x" },
    ip: "10.0.0.1",
    query: {},
    params: {},
    body: undefined,
    user: staff,
    ...overrides,
  } as unknown as Request;
}

describe("접속기록 표시", () => {
  it("모든 API가 @AccessLog나 @NoAccessLog 중 하나를 단다", async () => {
    const missing: string[] = [];
    let routes = 0;
    for (const file of controllerFiles(SRC)) {
      const module = (await import(pathToFileURL(file).href)) as Record<
        string,
        unknown
      >;
      for (const exported of Object.values(module)) {
        if (
          typeof exported !== "function" ||
          Reflect.getMetadata(PATH_METADATA, exported) === undefined
        ) {
          continue;
        }
        const proto = (exported as { prototype: object }).prototype;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler = (proto as Record<string, unknown>)[name];
          if (
            name === "constructor" ||
            typeof handler !== "function" ||
            Reflect.getMetadata(METHOD_METADATA, handler) === undefined
          ) {
            continue;
          }
          routes += 1;
          const marked =
            Reflect.getMetadata(ACCESS_LOG_KEY, handler) ??
            Reflect.getMetadata(NO_ACCESS_LOG_KEY, handler);
          if (!marked) missing.push(`${exported.name}.${name}`);
        }
      }
    }
    assert.ok(routes > 50, `API ${routes}개만 찾았다`);
    assert.deepEqual(missing, []);
  });
});

describe("접속기록 한 줄", () => {
  const actorOf = (req: Request, result?: unknown) => accessActor(req, result);
  const visitTarget: ResolvedTarget = {
    type: "visit",
    id: "v1",
    recipientIds: ["r1"],
    organizationId: "org9",
    before: null,
  };

  it("대상·정보주체·기관과 경로 값(id 빼고)·검색 조건을 남긴다", () => {
    const req = request({
      params: { id: "v1", version: "2" },
      query: { style: "standard", page: "" },
      route: { path: "/api/visits/:id/versions/:version" },
    });
    const row = buildAccessLog(
      { action: "VIEW", label: "확정본 보기", target: fromParam("visit") },
      req,
      { status: 200, result: {} },
      {
        actor: actorOf(req),
        target: visitTarget,
        subjects: { ids: ["r1"], count: 1 },
        organizationIds: ["org9"],
      },
    );
    assert.equal(row.actorUsername, "nurse1");
    assert.equal(row.targetType, "visit");
    assert.equal(row.targetId, "v1");
    assert.deepEqual(row.recipientIds, ["r1"]);
    assert.deepEqual(row.organizationIds, ["org9"]);
    assert.equal(row.path, "/api/visits/:id/versions/:version");
    assert.deepEqual(row.detail, { version: "2", style: "standard" });
  });

  it("바꾸는 요청은 바꾼 칸 이름만 남기고 값(기록 내용·비밀번호)은 남기지 않는다", () => {
    const req = request({
      method: "PUT",
      params: { id: "v1" },
      body: {
        forms: { HC_NURSE: { memo: "욕창" } },
        startedAt: "x",
        password: "1234",
      },
    });
    const row = buildAccessLog(
      { action: "UPDATE", label: "방문 기록 저장", target: fromParam("visit") },
      req,
      { status: 200, result: {} },
      {
        actor: actorOf(req),
        target: visitTarget,
        subjects: { ids: ["r1"], count: 1 },
        organizationIds: ["org9"],
      },
    );
    assert.deepEqual(row.detail, {
      fields: ["forms", "password", "startedAt"],
    });
    assert.ok(!JSON.stringify(row.detail).includes("욕창"));
    assert.ok(!JSON.stringify(row.detail).includes("1234"));
  });

  it("로그인: 성공은 응답의 사용자, 실패는 다듬은 입력 아이디와 LOGIN_FAILED·사용자가 본 문구", () => {
    const login: AccessLogSpec = { action: "LOGIN", label: "로그인" };
    const okRequest = request({
      method: "POST",
      user: undefined,
      body: { username: "Admin" },
    });
    const okResult = {
      user: {
        id: "u9",
        username: "admin",
        name: "운영자",
        role: "ADMIN",
        organizationId: null,
      },
    };
    const ok = buildAccessLog(
      login,
      okRequest,
      { status: 200, result: okResult },
      {
        actor: actorOf(okRequest, okResult),
        target: null,
        subjects: { ids: [], count: 0 },
        organizationIds: [],
      },
    );
    assert.equal(ok.action, "LOGIN");
    assert.equal(ok.actorId, "u9");

    const failedRequest = request({
      method: "POST",
      user: undefined,
      body: { username: " Admin ", password: "x" },
    });
    const failedActor = actorOf(failedRequest);
    assert.equal(failedActor.id, null);
    assert.equal(failedActor.username, "admin");
    const failed = buildAccessLog(
      login,
      failedRequest,
      { status: 429, error: "요청이 너무 많습니다" },
      {
        actor: failedActor,
        target: null,
        subjects: { ids: [], count: 0 },
        organizationIds: ["org1"],
      },
    );
    assert.equal(failed.action, "LOGIN_FAILED");
    assert.equal(failed.status, 429);
    assert.deepEqual(failed.detail, {
      fields: ["password", "username"],
      error: "요청이 너무 많습니다",
    });
  });

  it("권한 변경: 성공하면 바뀐 권한 칸의 이전·새 값, 그대로인 칸은 빼고 새로 만들면 이전 값은 없다", () => {
    const before = {
      role: "STAFF" as const,
      profession: "NURSE" as const,
      organizationId: "org1",
      isActive: true,
    };
    assert.deepEqual(
      permissionChanges(before, { ...before, role: "MANAGER", name: "x" }),
      { role: { before: "STAFF", after: "MANAGER" } },
    );
    assert.deepEqual(permissionChanges(null, before), {
      role: { before: null, after: "STAFF" },
      profession: { before: null, after: "NURSE" },
      organizationId: { before: null, after: "org1" },
      isActive: { before: null, after: true },
    });
    const req = request({
      method: "PATCH",
      params: { id: "u2" },
      body: { role: "MANAGER" },
    });
    const userTarget: ResolvedTarget = {
      type: "user",
      id: "u2",
      recipientIds: [],
      organizationId: "org1",
      before,
    };
    const resolved = {
      actor: actorOf(req),
      target: userTarget,
      subjects: { ids: [], count: 0 },
      organizationIds: ["org1"],
    };
    const spec: AccessLogSpec = {
      action: "PERMISSION",
      label: "사용자 정보·권한 변경",
      target: fromParam("user"),
    };
    const ok = buildAccessLog(
      spec,
      req,
      { status: 200, result: { ...before, role: "MANAGER" } },
      resolved,
    );
    assert.deepEqual(ok.detail, {
      fields: ["role"],
      changes: { role: { before: "STAFF", after: "MANAGER" } },
    });
    const rejected = buildAccessLog(
      spec,
      req,
      { status: 409, error: "확정하지 않은 방문이 있습니다" },
      resolved,
    );
    assert.deepEqual(rejected.detail, {
      fields: ["role"],
      error: "확정하지 않은 방문이 있습니다",
    });
  });

  it("목록 등 대상이 없는 기록의 기관: 운영자는 요청한 기관, 그 외는 자기 기관(요청과 상관없이)", () => {
    const query = { organizationId: "org-other" };
    assert.equal(
      scopeOrganizationId(actorOf(request({ query })), request({ query })),
      "org1",
    );
    const admin = { ...staff, role: "ADMIN" as const, organizationId: null };
    const adminRequest = request({ user: admin, query });
    assert.equal(
      scopeOrganizationId(actorOf(adminRequest), adminRequest),
      "org-other",
    );
    const adminAll = request({ user: admin });
    assert.equal(scopeOrganizationId(actorOf(adminAll), adminAll), null);
  });

  it("목록 대상 표시는 수급자 id 꺼내기와 수 세기를 담는다", () => {
    const target = listOf(
      (result: { items: { recipientId: string }[] }) =>
        result.items.map((item) => item.recipientId),
      (result) => result.items.length,
    );
    assert.equal(target.kind, "list");
    if (target.kind !== "list") return;
    const result = { items: [{ recipientId: "a" }, { recipientId: "a" }] };
    assert.deepEqual(accessSubjects(target.recipients?.(result) ?? []), {
      ids: ["a"],
      count: 1,
    });
    assert.equal(target.count?.(result), 2);
    assert.deepEqual(fromResult("recipient"), {
      kind: "recipient",
      from: "result",
    });
  });
});

describe("접속기록 조회 범위", () => {
  const query = AccessLogQuerySchema.parse({
    from: "2026-10-01",
    to: "2026-10-31",
    recipientId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-0000000000aa",
  });

  it("기관 관리자는 요청과 상관없이 자기 기관이 든 기록, 운영자는 고른 기관", () => {
    const manager = { ...staff, role: "MANAGER" as const };
    assert.deepEqual(accessLogWhere(manager, query).organizationIds, {
      has: "org1",
    });
    const admin = { ...staff, role: "ADMIN" as const, organizationId: null };
    assert.deepEqual(accessLogWhere(admin, query).organizationIds, {
      has: "00000000-0000-4000-8000-0000000000aa",
    });
    assert.equal(
      accessLogWhere(admin, { ...query, organizationId: undefined })
        .organizationIds,
      undefined,
    );
  });

  it("기간은 한국 날짜 끝 포함, 정보주체는 배열에 들어 있는지", () => {
    const where = accessLogWhere({ ...staff, role: "MANAGER" }, query);
    assert.deepEqual(where.at, {
      gte: new Date("2026-09-30T15:00:00.000Z"),
      lt: new Date("2026-10-31T15:00:00.000Z"),
    });
    assert.deepEqual(where.recipientIds, {
      has: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("시작일이 종료일보다 늦으면 거절", () => {
    assert.equal(
      AccessLogQuerySchema.safeParse({ from: "2026-10-02", to: "2026-10-01" })
        .success,
      false,
    );
  });
});

describe("접속기록 도우미", () => {
  it("검색 조건은 빈 값·비밀 칸을 뺀다", () => {
    assert.deepEqual(
      searchConditions({ q: "김", page: "", password: "x", to: undefined }),
      { q: "김" },
    );
  });

  it("바꾼 칸 이름은 정렬하고 undefined는 뺀다", () => {
    assert.deepEqual(changedFieldNames({ b: 1, a: undefined, c: null }), [
      "b",
      "c",
    ]);
    assert.deepEqual(changedFieldNames(null), []);
  });

  it("정보주체는 상한까지 남기고 수는 모두 센다", () => {
    const ids = Array.from({ length: ACCESS_LOG_MAX_SUBJECTS + 10 }, (_, i) =>
      String(i),
    );
    const subjects = accessSubjects([...ids, null, "0"]);
    assert.equal(subjects.ids.length, ACCESS_LOG_MAX_SUBJECTS);
    assert.equal(subjects.count, ACCESS_LOG_MAX_SUBJECTS + 10);
  });

  it("대상 글: 정보주체 이름 셋까지와 외 n명, 없으면 대상 이름", () => {
    const recipients = ["가", "나", "다", "라"].map((name, i) => ({
      id: String(i),
      name,
    }));
    assert.equal(
      accessTargetText({ recipients, subjectCount: 6, target: null }),
      "가, 나, 다 외 3명",
    );
    assert.equal(
      accessTargetText({
        recipients: [],
        subjectCount: 0,
        target: { type: "user", id: "u", name: "김간호" },
      }),
      "김간호",
    );
  });
});

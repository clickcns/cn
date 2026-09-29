# syntax=docker/dockerfile:1
#
# 케어노트 이미지 3개: server(NestJS) · web(현장 웹) · web-admin(관리 웹, /admin 아래).
# 빌드 컨텍스트는 레포 루트다(pnpm 워크스페이스·lockfile이 루트에 있다).
#   docker build --target server    -t cn-server .
#   docker build --target web       -t cn-web .
#   docker build --target web-admin -t cn-web-admin .
# CI는 .github/workflows/docker-*.yml 이 target을 골라 GHCR에 올린다.

ARG NODE_IMAGE=node:24-alpine

# ===== 공통: pnpm 준비와 소스 =====
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate && \
    pnpm config set store-dir /pnpm/store
WORKDIR /app
# 소스는 작아서 통째로 넣는다. node_modules·dist·.env 는 .dockerignore 가 거른다.
COPY . .

# ===== SERVER =====
FROM base AS server-build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@repo/server..."
# prisma.config.ts 가 DATABASE_URL 을 읽는다. generate 는 접속하지 않으므로 더미 값이면 된다.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# 서버는 shared-types 의 dist(CJS)를 쓴다. Prisma client 는 src/generated 로 생성돼 dist 에 함께 컴파일된다.
RUN pnpm --filter @repo/shared-types build && \
    pnpm --filter @repo/server prisma:generate && \
    pnpm --filter @repo/server build && \
    test -f apps/server/dist/main.js && \
    test -f apps/server/dist/speech/stt.proto
# prod 의존만 담은 독립 디렉터리로 뽑는다(심볼릭 링크 없이 실제 파일).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @repo/server deploy --prod --legacy /prod/server && \
    rm -rf /prod/server/dist && cp -r apps/server/dist /prod/server/dist
# 워크스페이스 패키지의 빌드 결과(dist)가 따라왔는지, 런타임 모듈이 풀리는지 확인한다.
RUN cd /prod/server && \
    test -f node_modules/@repo/shared-types/dist/index.js && \
    node -e "require('@repo/shared-types'); ['@nestjs/core','@prisma/client/runtime/client','@prisma/adapter-pg','@grpc/grpc-js'].forEach((m) => require.resolve(m))"

FROM ${NODE_IMAGE} AS server
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=server-build --chown=node:node /prod/server ./
USER node
ENV NODE_ENV=production
ENV PORT=3210
EXPOSE 3210
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]

# ===== WEB (현장 웹, 도메인 루트 /) =====
FROM base AS web-build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@repo/web..."
RUN pnpm --filter @repo/web build

FROM nginx:1.29-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

# ===== WEB-ADMIN (관리 웹, /admin 아래) =====
FROM base AS web-admin-build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@repo/web-admin..."
RUN pnpm --filter @repo/web-admin build

FROM nginx:1.29-alpine AS web-admin
COPY apps/web-admin/nginx.conf /etc/nginx/conf.d/default.conf
# vite base 가 /admin/ 이라 파일도 /admin 아래에 둔다(인그레스가 경로를 그대로 넘긴다).
COPY --from=web-admin-build /app/apps/web-admin/dist /usr/share/nginx/html/admin
EXPOSE 80

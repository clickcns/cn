import { randomUUID } from "node:crypto";
import type { Options } from "pino-http";

function serializeError(err: Record<string, unknown>) {
  const status = (err.status as number) ?? 500;
  const isClientError = status >= 400 && status < 500;
  const isProduction = process.env.NODE_ENV === "production";

  return {
    type: err.name as string,
    message: err.message as string,
    status,
    ...(isClientError
      ? { errors: err.errors }
      : { stack: isProduction ? undefined : (err.stack as string) }),
  };
}

function serializeRequest(req: Record<string, unknown>) {
  const headers = req.headers as Record<string, string> | undefined;
  return {
    id: req.id as string,
    method: req.method as string,
    url: req.url as string,
    remoteAddress: req.remoteAddress as string,
    userAgent: headers?.["user-agent"],
  };
}

function serializeResponse(res: Record<string, unknown>) {
  return {
    statusCode: res.statusCode as number,
    responseTime: res.responseTime as number,
  };
}

export function getPinoHttpConfig(): Options {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    level: isProduction ? "info" : "debug",
    transport: isProduction
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, levelFirst: true },
        },
    genReqId: () => randomUUID(),
    autoLogging: {
      ignore: (req) => req.url === "/api/health",
    },
    // 요청 본문(비밀번호·기록 내용)은 로그에 남기지 않는다.
    serializers: {
      err: serializeError,
      req: serializeRequest,
      res: serializeResponse,
    },
  };
}

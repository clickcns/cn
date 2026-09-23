import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { ApiErrorBody } from "@repo/shared-types";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import { ZodValidationException } from "nestjs-zod";
import type { ZodError } from "zod";

/** 모든 오류를 shared-types ApiErrorBody 형태로 응답한다. */
@Catch(Error)
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    logger.setContext(ErrorFilter.name);
  }

  catch(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (error instanceof ZodValidationException) {
      const zodError = error.getZodError() as ZodError;
      const message =
        zodError.issues[0]?.message ?? "입력값이 올바르지 않습니다";
      this.logger.warn(
        { path: request.url, method: request.method, errors: zodError.issues },
        "Validation failed",
      );
      this.send(response, request, 400, message, zodError.issues);
      return;
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      // 업로드 크기 초과(multer)는 영어 문구로 오므로 바꾼다.
      const message =
        error instanceof PayloadTooLargeException
          ? "파일이 너무 큽니다"
          : this.extractMessage(error);
      const payload = {
        statusCode: status,
        errorType: error.name,
        path: request.url,
        method: request.method,
      };
      if (status >= 500) {
        this.logger.error({ ...payload, stack: error.stack }, message);
      } else {
        this.logger.warn(payload, message);
      }
      this.send(response, request, status, message);
      return;
    }

    this.logger.error(
      {
        errorType: error.name,
        path: request.url,
        method: request.method,
        stack: error.stack,
      },
      `Unhandled Exception: ${error.message}`,
    );
    this.send(
      response,
      request,
      500,
      "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요",
    );
  }

  private send(
    response: Response,
    request: Request,
    statusCode: number,
    message: string,
    errors?: unknown,
  ): void {
    const body: ApiErrorBody = {
      statusCode,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };
    response.status(statusCode).json(body);
  }

  private extractMessage(error: HttpException): string {
    const errorResponse = error.getResponse();
    if (typeof errorResponse === "string") return errorResponse;
    if (
      typeof errorResponse === "object" &&
      errorResponse !== null &&
      "message" in errorResponse
    ) {
      const { message } = errorResponse;
      return Array.isArray(message) ? message.join(", ") : String(message);
    }
    return error.message;
  }
}

import { ConflictException, NotFoundException } from "@nestjs/common";

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

/**
 * Prisma 오류를 한국어 HTTP 예외로 바꾼다.
 * - P2002 고유 제약 위반 → 409 (conflict)
 * - P2025 대상 없음 → 404 (notFound), 또는 조건부 갱신이 맞는 행을 못 찾음 → 409 (staleWrite)
 * - P2003 외래 키 위반(참조 대상 없음) → 404 (foreignKey)
 */
export function handlePrismaError(
  error: unknown,
  handlers: {
    conflict?: string;
    notFound?: string;
    staleWrite?: string;
    foreignKey?: string;
  },
): never {
  if (handlers.conflict && isPrismaError(error, "P2002")) {
    throw new ConflictException(handlers.conflict);
  }
  if (isPrismaError(error, "P2025")) {
    if (handlers.staleWrite) throw new ConflictException(handlers.staleWrite);
    if (handlers.notFound) throw new NotFoundException(handlers.notFound);
  }
  if (handlers.foreignKey && isPrismaError(error, "P2003")) {
    throw new NotFoundException(handlers.foreignKey);
  }
  throw error;
}

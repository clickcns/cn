import { BadRequestException, Param, ParseUUIDPipe } from "@nestjs/common";

/** 경로의 :id가 UUID가 아니면 한국어 400을 돌려준다. */
export const UuidParam = (name = "id") =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () => new BadRequestException("잘못된 id 형식입니다"),
    }),
  );

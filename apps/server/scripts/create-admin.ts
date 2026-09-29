/**
 * 운영자(ADMIN) 계정을 만든다. 새 DB에 처음 들어갈 계정용이며, 이미 있으면 건드리지 않는다
 * (비밀번호는 관리 웹 헤더의 [비밀번호 변경]으로 바꾼다).
 *
 *   pnpm db:admin:prod                     # .env.production 의 DATABASE_URL
 *   ADMIN_USERNAME=ops pnpm db:admin:prod  # 아이디를 바꿀 때
 *
 * 비밀번호는 ADMIN_PASSWORD(8자 이상)를 쓰고, 없으면 임의로 만들어 한 번만 보여 준다.
 */
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { USERNAME_REGEX } from "@repo/shared-types";
import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/user/password-hash.js";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });
dotenv.config({ path: ".env", override: false });

const MIN_PASSWORD_LENGTH = 8;

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  if (!USERNAME_REGEX.test(username)) {
    throw new Error(`아이디 형식이 올바르지 않습니다: ${username}`);
  }
  const givenPassword = process.env.ADMIN_PASSWORD;
  if (
    givenPassword !== undefined &&
    givenPassword.length < MIN_PASSWORD_LENGTH
  ) {
    throw new Error(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다`);
  }
  const password = givenPassword ?? randomBytes(18).toString("base64url");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL이 없습니다");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { role: true },
    });
    if (existing) {
      console.log(
        `이미 있는 계정입니다(${username}, ${existing.role}). 바꾸지 않았습니다.`,
      );
      return;
    }
    await prisma.user.create({
      data: {
        username,
        name: "운영자",
        role: "ADMIN",
        password: await hashPassword(password),
      },
    });
    console.log(`운영자 계정을 만들었습니다: ${username}`);
    if (givenPassword === undefined) {
      console.log(`비밀번호(한 번만 표시): ${password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

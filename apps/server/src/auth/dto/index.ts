import {
  ChangePasswordSchema,
  LoginSchema,
  RefreshSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";

export class LoginDto extends createZodDto(LoginSchema) {}
export class RefreshDto extends createZodDto(RefreshSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

import { dialablePhone } from "@repo/shared-types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 전화번호 → `tel:` 링크 */
export function toTelHref(phone: string): string {
  return `tel:${dialablePhone(phone)}`;
}

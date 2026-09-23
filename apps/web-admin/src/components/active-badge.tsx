import { Badge } from "@/components/ui/badge";

/** 계정·수급자의 활성 여부 배지. */
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">활성</Badge>
  ) : (
    <Badge variant="neutral">비활성</Badge>
  );
}

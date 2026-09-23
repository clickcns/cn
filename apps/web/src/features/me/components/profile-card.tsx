import { ROLE_LABELS, type AuthUser } from "@repo/shared-types";
import { Card } from "@/components/ui/card";

export function ProfileCard({ user }: { user: AuthUser }) {
  const rows = [
    { label: "아이디", value: user.username },
    { label: "역할", value: ROLE_LABELS[user.role] },
    { label: "소속 기관", value: user.organizationName ?? "소속 기관 없음" },
  ];

  return (
    <Card className="gap-5">
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="bg-primary-soft text-primary flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
        >
          {user.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold">{user.name}</p>
          <p className="text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>

      <dl className="divide-border border-border divide-y border-t">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex min-h-14 items-center justify-between gap-4 py-3"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

import type { ReactNode } from "react";

/** 사례 정보 창의 한 구역: 제목·설명과 내용. */
export function CaseSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="text-muted-foreground text-[13px]">{description}</p>
      </div>
      {children}
    </section>
  );
}

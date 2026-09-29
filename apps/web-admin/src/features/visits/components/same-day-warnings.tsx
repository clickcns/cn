import { TriangleAlertIcon } from "lucide-react";

/** 같은 날 함께 있으면 재택의료 급여를 산정하지 않는 방문 안내(등록·변경을 막지는 않는다). */
export function SameDayWarnings({ warnings }: { warnings: readonly string[] }) {
  return warnings.map((warning) => (
    <p
      key={warning}
      role="status"
      className="bg-warning-soft text-warning flex items-start gap-2 rounded-md px-3 py-2 text-sm"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {warning}
    </p>
  ));
}

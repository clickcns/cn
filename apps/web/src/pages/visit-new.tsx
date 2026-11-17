import { isIsoDate } from "@repo/shared-types";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/page-header";
import { NewVisitForm } from "@/features/visits/components/new-visit-form";
import { useToday } from "@/hooks/use-now";
import { visitsPath } from "@/lib/routes";

export default function NewVisitPage() {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const today = useToday();
  const date = isIsoDate(dateParam) ? dateParam : today;
  const recipientId = searchParams.get("recipientId") ?? undefined;

  return (
    <>
      <PageHeader title="방문 추가" backTo={visitsPath(date)} />
      <NewVisitForm defaultDate={date} defaultRecipientId={recipientId} />
    </>
  );
}

import { Users } from "lucide-react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, PageError, PageLoading } from "@/components/ui/page-state";
import { RecipientCard } from "@/features/recipients/components/recipient-card";
import { RecipientSearchInput } from "@/features/recipients/components/recipient-search-input";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export default function RecipientsPage() {
  // 검색어를 주소에 두어 상세에서 뒤로 왔을 때 그대로 남게 한다.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const recipientsQuery = useRecipients(debouncedSearch);
  const recipients = recipientsQuery.data ?? [];

  const changeSearch = (value: string) => {
    setSearchParams(value ? { q: value } : {}, { replace: true });
  };

  return (
    <>
      <PageHeader title="수급자" />

      <div className="flex flex-col gap-4">
        <RecipientSearchInput
          value={search}
          onChange={changeSearch}
          className="md:max-w-md"
        />

        {recipientsQuery.isPending ? (
          <PageLoading />
        ) : recipientsQuery.isError ? (
          <PageError
            error={recipientsQuery.error}
            fallback="수급자 목록을 불러오지 못했습니다"
            onRetry={() => void recipientsQuery.refetch()}
          />
        ) : recipients.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={
              debouncedSearch.trim()
                ? "검색 결과가 없습니다"
                : "등록된 수급자가 없습니다"
            }
            description={
              debouncedSearch.trim()
                ? "이름·차트번호·생년월일(예: 19420819)을 다시 확인해 주세요."
                : "수급자 등록은 기관 관리자에게 요청해 주세요."
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground" aria-live="polite">
              수급자{" "}
              <strong className="text-foreground">{recipients.length}명</strong>
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recipients.map((recipient) => (
                <li key={recipient.id}>
                  <RecipientCard recipient={recipient} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

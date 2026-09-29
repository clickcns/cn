import type { Recipient } from "@repo/shared-types";
import { HeartHandshakeIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { ListCount } from "@/components/ui/list-count";
import { PageHeader } from "@/components/ui/page-header";
import {
  useOrganizationColumnNames,
  useScopeOrganizationId,
} from "@/features/organizations/hooks/use-organization-scope";
import { CreateRecipientDialog } from "@/features/recipients/components/create-recipient-dialog";
import { EditRecipientDialog } from "@/features/recipients/components/edit-recipient-dialog";
import { RecipientTable } from "@/features/recipients/components/recipient-table";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export default function RecipientsPage() {
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Recipient | null>(null);

  const scopeOrganizationId = useScopeOrganizationId();
  const organizationNames = useOrganizationColumnNames();
  const q = useDebouncedValue(search.trim(), 300);

  const recipientsQuery = useRecipients({
    q: q || undefined,
    organizationId: scopeOrganizationId,
    includeInactive: includeInactive ? "true" : "false",
  });
  const recipients = recipientsQuery.data ?? [];

  const openEdit = (recipient: Recipient) => {
    setEditTarget(recipient);
    setEditOpen(true);
  };

  return (
    <>
      <PageHeader
        title="수급자"
        description="방문 의료·간호·복지를 받는 수급자를 등록하고 정보를 관리합니다."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            수급자 등록
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative w-80">
              <SearchIcon
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                type="search"
                aria-label="수급자 검색"
                placeholder="이름·차트번호·생년월일로 검색"
                className="pl-9"
                value={search}
                maxLength={50}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm select-none">
              <Checkbox
                checked={includeInactive}
                onCheckedChange={(checked) =>
                  setIncludeInactive(checked === true)
                }
              />
              비활성 포함
            </label>
          </div>
          {recipientsQuery.isSuccess && (
            <ListCount
              count={recipients.length}
              unit="명"
              isFetching={recipientsQuery.isFetching}
            />
          )}
        </div>

        {recipientsQuery.isPending ? (
          <LoadingState message="수급자 목록을 불러오는 중입니다…" />
        ) : recipientsQuery.isError ? (
          <ErrorState
            error={recipientsQuery.error}
            title="수급자 목록을 불러오지 못했습니다"
            onRetry={() => void recipientsQuery.refetch()}
          />
        ) : recipients.length === 0 ? (
          q ? (
            <EmptyState
              icon={SearchIcon}
              title={`"${q}"에 맞는 수급자가 없습니다`}
              description={
                includeInactive
                  ? "검색어를 확인해 주세요."
                  : "비활성 수급자까지 찾으려면 '비활성 포함'을 켜 주세요."
              }
            />
          ) : (
            <EmptyState
              icon={HeartHandshakeIcon}
              title="등록된 수급자가 없습니다"
              description="수급자를 등록하면 방문 일정을 잡을 수 있습니다."
              action={
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  <PlusIcon />
                  수급자 등록
                </Button>
              }
            />
          )
        ) : (
          <RecipientTable
            recipients={recipients}
            organizationNames={organizationNames}
            onEdit={openEdit}
          />
        )}
      </Card>

      <CreateRecipientDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditRecipientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        recipient={editTarget}
      />
    </>
  );
}

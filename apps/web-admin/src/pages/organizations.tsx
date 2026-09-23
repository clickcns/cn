import type { Organization } from "@repo/shared-types";
import { Building2Icon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/data-state";
import { ListCount } from "@/components/ui/list-count";
import { PageHeader } from "@/components/ui/page-header";
import { OrganizationFormDialog } from "@/features/organizations/components/organization-form-dialog";
import { OrganizationTable } from "@/features/organizations/components/organization-table";
import { useOrganizations } from "@/features/organizations/hooks/use-organizations";

export default function OrganizationsPage() {
  const organizationsQuery = useOrganizations();
  const organizations = organizationsQuery.data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<Organization | null>(null);

  const openDialog = (organization: Organization | null) => {
    setTarget(organization);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="기관"
        description="케어노트를 쓰는 장기요양기관을 등록하고 관리합니다. 운영자만 볼 수 있습니다."
        actions={
          <Button onClick={() => openDialog(null)}>
            <PlusIcon />
            기관 등록
          </Button>
        }
      />

      <Card>
        {organizationsQuery.isSuccess && (
          <ListCount
            count={organizations.length}
            unit="개 기관"
            isFetching={organizationsQuery.isFetching}
            className="justify-end border-b px-5 py-3"
          />
        )}

        {organizationsQuery.isPending ? (
          <LoadingState message="기관 목록을 불러오는 중입니다…" />
        ) : organizationsQuery.isError ? (
          <ErrorState
            error={organizationsQuery.error}
            title="기관 목록을 불러오지 못했습니다"
            onRetry={() => void organizationsQuery.refetch()}
          />
        ) : organizations.length === 0 ? (
          <EmptyState
            icon={Building2Icon}
            title="등록된 기관이 없습니다"
            description="기관을 등록한 뒤 그 기관의 관리자·간호사 계정을 추가하세요."
            action={
              <Button variant="outline" onClick={() => openDialog(null)}>
                <PlusIcon />
                기관 등록
              </Button>
            }
          />
        ) : (
          <OrganizationTable
            organizations={organizations}
            onEdit={(organization) => openDialog(organization)}
          />
        )}
      </Card>

      <OrganizationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={target}
      />
    </>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateRecipientSchema } from "@repo/shared-types";
import { Building2Icon } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { OrganizationSelectField } from "@/features/organizations/components/organization-select-field";
import {
  useScopeOrganizationId,
  useShowsAllOrganizations,
} from "@/features/organizations/hooks/use-organization-scope";
import {
  useOrganizationNameMap,
  useOrganizationPrograms,
} from "@/features/organizations/hooks/use-organizations";
import { RecipientFields } from "@/features/recipients/components/recipient-fields";
import { useCreateRecipient } from "@/features/recipients/hooks/use-recipients";
import { EMPTY_RECIPIENT_FIELDS } from "@/features/recipients/lib/recipient-form";

interface CreateRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRecipientDialog({
  open,
  onOpenChange,
}: CreateRecipientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <CreateRecipientForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateRecipientForm({ onDone }: { onDone: () => void }) {
  const user = useCurrentUser();
  const scopeOrganizationId = useScopeOrganizationId();
  // 운영자가 헤더에서 "전체"를 보고 있을 때만 등록할 기관을 직접 고른다.
  const choosesOrganization = useShowsAllOrganizations();
  const organizationNames = useOrganizationNameMap();
  const programsOf = useOrganizationPrograms();
  const createRecipient = useCreateRecipient();
  // 헤더에서 고른 기관(운영자)이나 자기 기관(기관 관리자). 운영자가 전체를 보면 폼에서 고른다.
  const fixedOrganizationId = scopeOrganizationId ?? user?.organizationId;
  /** 기관 사업이 하나뿐이면 미리 고른다. */
  const initialPrograms = (organizationId: string | null | undefined) => {
    const programs = organizationId ? programsOf(organizationId) : [];
    return programs.length === 1 ? [...programs] : [];
  };

  const form = useForm({
    resolver: zodResolver(CreateRecipientSchema),
    defaultValues: {
      ...EMPTY_RECIPIENT_FIELDS,
      programs: initialPrograms(fixedOrganizationId),
      // 기관 관리자는 보내지 않는다(서버가 자기 기관으로 고정한다).
      organizationId: scopeOrganizationId,
    },
  });
  const chosenOrganizationId = useWatch({
    control: form.control,
    name: "organizationId",
  });
  const targetOrganizationId = choosesOrganization
    ? chosenOrganizationId || undefined
    : fixedOrganizationId;
  const organizationPrograms = targetOrganizationId
    ? programsOf(targetOrganizationId)
    : undefined;

  const onSubmit = form.handleSubmit((values) => {
    if (choosesOrganization && !values.organizationId) {
      form.setError("organizationId", { message: "기관을 선택해 주세요" });
      return;
    }
    createRecipient.mutate(values, { onSuccess: onDone });
  });

  const organizationLabel = scopeOrganizationId
    ? organizationNames.get(scopeOrganizationId)
    : user?.organizationName;

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
        <DialogHeader>
          <DialogTitle>수급자 등록</DialogTitle>
          <DialogDescription>
            방문 의료·간호·복지를 받는 수급자를 등록합니다. 이름과 등록 사업 외
            항목은 나중에 채워도 됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {choosesOrganization ? (
            <OrganizationSelectField
              control={form.control}
              name="organizationId"
              id="create-recipient-organization"
              // 등록 사업은 기관 사업 안에서 고르므로 기관을 바꾸면 다시 고른다.
              onValueChange={(organizationId) =>
                form.setValue("programs", initialPrograms(organizationId))
              }
            />
          ) : (
            organizationLabel && (
              <p className="bg-muted/70 text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                <Building2Icon className="size-4" />
                <span>
                  등록 기관:{" "}
                  <span className="text-foreground font-medium">
                    {organizationLabel}
                  </span>
                </span>
              </p>
            )
          )}
          <RecipientFields
            idPrefix="create-recipient"
            organizationPrograms={organizationPrograms}
            programsRequired
          />
        </DialogBody>
        <FormDialogFooter
          submitText="등록"
          onCancel={onDone}
          isPending={createRecipient.isPending}
        />
      </form>
    </FormProvider>
  );
}

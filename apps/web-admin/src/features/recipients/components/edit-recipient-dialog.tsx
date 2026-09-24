import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateRecipientSchema, type Recipient } from "@repo/shared-types";
import { FormProvider, useForm } from "react-hook-form";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { SwitchField } from "@/components/ui/switch-field";
import { useOrganizationPrograms } from "@/features/organizations/hooks/use-organizations";
import { RecipientFields } from "@/features/recipients/components/recipient-fields";
import { useUpdateRecipient } from "@/features/recipients/hooks/use-recipients";
import { toEditRecipientFormValues } from "@/features/recipients/lib/recipient-form";

interface EditRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: Recipient | null;
}

export function EditRecipientDialog({
  open,
  onOpenChange,
  recipient,
}: EditRecipientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {recipient && (
          <EditRecipientForm
            key={recipient.id}
            recipient={recipient}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRecipientForm({
  recipient,
  onDone,
}: {
  recipient: Recipient;
  onDone: () => void;
}) {
  const updateRecipient = useUpdateRecipient();
  const programsOf = useOrganizationPrograms();
  const form = useForm({
    resolver: zodResolver(UpdateRecipientSchema),
    defaultValues: toEditRecipientFormValues(recipient),
  });

  const onSubmit = form.handleSubmit((values) => {
    updateRecipient.mutate(
      { id: recipient.id, input: values },
      { onSuccess: onDone },
    );
  });

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
        <DialogHeader>
          <DialogTitle>수급자 정보 수정</DialogTitle>
          <DialogDescription>
            비워 둔 선택 항목은 지워진 상태로 저장됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          <RecipientFields
            idPrefix="edit-recipient"
            organizationPrograms={programsOf(recipient.organizationId)}
            programsRequired={false}
          />
          <SwitchField
            control={form.control}
            name="isActive"
            id="edit-recipient-active"
            label="활성 수급자"
            description="서비스가 끝난 수급자는 끄세요. 기록은 남고 새 방문 등록 목록에서 빠집니다."
          />
        </DialogBody>
        <FormDialogFooter
          submitText="저장"
          onCancel={onDone}
          isPending={updateRecipient.isPending}
        />
      </form>
    </FormProvider>
  );
}

import type { Recipient } from "@repo/shared-types";
import { PencilIcon } from "lucide-react";
import { ActiveBadge } from "@/components/active-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatBirthDate,
  formatCareGrade,
  formatGender,
  orDash,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface RecipientTableProps {
  recipients: Recipient[];
  /** 운영자가 전체 기관을 볼 때 기관 이름을 보여 준다. */
  organizationNames?: Map<string, string>;
  onEdit: (recipient: Recipient) => void;
}

export function RecipientTable({
  recipients,
  organizationNames,
  onEdit,
}: RecipientTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>이름</TableHead>
          {organizationNames && <TableHead>기관</TableHead>}
          <TableHead>등급</TableHead>
          <TableHead>성별</TableHead>
          <TableHead>생년월일</TableHead>
          <TableHead>연락처</TableHead>
          <TableHead>보호자</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="w-0 text-right">
            <span className="sr-only">관리</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recipients.map((recipient) => (
          <TableRow
            key={recipient.id}
            className={cn(!recipient.isActive && "text-muted-foreground")}
          >
            <TableCell className="font-medium">{recipient.name}</TableCell>
            {organizationNames && (
              <TableCell>
                {orDash(organizationNames.get(recipient.organizationId))}
              </TableCell>
            )}
            <TableCell className="whitespace-nowrap">
              {formatCareGrade(recipient.careGrade)}
            </TableCell>
            <TableCell>{formatGender(recipient.gender)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatBirthDate(recipient.birthDate)}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {orDash(recipient.phone)}
            </TableCell>
            <TableCell>
              {recipient.guardianName || recipient.guardianPhone ? (
                <div className="grid leading-tight">
                  <span>{orDash(recipient.guardianName)}</span>
                  {recipient.guardianPhone && (
                    <span className="text-muted-foreground text-[13px] whitespace-nowrap">
                      {recipient.guardianPhone}
                    </span>
                  )}
                </div>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <ActiveBadge isActive={recipient.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(recipient)}
              >
                <PencilIcon />
                수정
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

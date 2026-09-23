import { PROGRAM_LABELS, type Organization } from "@repo/shared-types";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, orDash } from "@/lib/format";

interface OrganizationTableProps {
  organizations: Organization[];
  onEdit: (organization: Organization) => void;
}

export function OrganizationTable({
  organizations,
  onEdit,
}: OrganizationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>기관 이름</TableHead>
          <TableHead>기관 코드</TableHead>
          <TableHead>사업</TableHead>
          <TableHead className="text-right">사용자 수</TableHead>
          <TableHead className="text-right">수급자 수</TableHead>
          <TableHead>등록일</TableHead>
          <TableHead className="w-0 text-right">
            <span className="sr-only">관리</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizations.map((organization) => (
          <TableRow key={organization.id}>
            <TableCell className="font-medium">{organization.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {orDash(organization.code)}
            </TableCell>
            <TableCell>
              {orDash(
                organization.programs
                  .map((program) => PROGRAM_LABELS[program])
                  .join(", "),
              )}
            </TableCell>
            <TableCell className="text-right">
              {organization.userCount.toLocaleString("ko-KR")}명
            </TableCell>
            <TableCell className="text-right">
              {organization.recipientCount.toLocaleString("ko-KR")}명
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(organization.createdAt)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(organization)}
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

import { CompassIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-state";
import { HOME_ROUTE } from "@/lib/routes";

export default function NotFoundPage() {
  return (
    <Card className="mt-6">
      <title>페이지 없음 · 케어노트 관리</title>
      <EmptyState
        icon={CompassIcon}
        title="찾는 화면이 없습니다"
        description="주소가 바뀌었거나 잘못 입력되었을 수 있습니다."
        action={
          <Button variant="outline" asChild>
            <Link to={HOME_ROUTE}>방문 기록으로</Link>
          </Button>
        }
      />
    </Card>
  );
}

import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-state";
import { ROUTES } from "@/lib/routes";

export default function NotFoundPage() {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        className="w-full"
        icon={<SearchX />}
        title="페이지를 찾을 수 없습니다"
        description="주소가 바뀌었거나 없는 화면입니다."
        action={
          <Button asChild>
            <Link to={ROUTES.VISITS} replace>
              처음 화면으로
            </Link>
          </Button>
        }
      />
    </main>
  );
}

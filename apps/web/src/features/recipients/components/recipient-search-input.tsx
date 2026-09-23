import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RecipientSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

export function RecipientSearchInput({
  value,
  onChange,
  id,
  className,
}: RecipientSearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
      <Input
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="이름으로 찾기"
        aria-label="수급자 이름 검색"
        // 서버 검색어 제한과 같게 막아, 길게 붙여넣어도 오류가 나지 않게 한다.
        maxLength={50}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-14 pl-12 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground absolute top-1/2 right-0.5 -translate-y-1/2"
          aria-label="검색어 지우기"
          onClick={() => onChange("")}
        >
          <X />
        </Button>
      )}
    </div>
  );
}

import {
  MAP_APP_LABELS,
  MAP_APPS,
  mapSearchQuery,
  mapSearchUrl,
} from "@repo/shared-types";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** 주소를 지도 앱(네이버·카카오·구글)에서 여는 버튼들. 휴대폰에 앱이 있으면 앱으로 열린다. */
export function MapLinks({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  return (
    <div className={cn("grid max-w-md grid-cols-3 gap-2", className)}>
      {MAP_APPS.map((app) => (
        <Button key={app} variant="outline" size="sm" className="px-2" asChild>
          <a
            href={mapSearchUrl(app, address)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {MAP_APP_LABELS[app]}
          </a>
        </Button>
      ))}
    </div>
  );
}

/** [지도] 버튼: 누르면 열 지도 앱을 고른다(방문 카드처럼 자리가 좁은 곳). */
export function MapMenuButton({
  address,
  label,
  className,
}: {
  address: string;
  /** 화면 읽기 프로그램용 이름(누구 주소인지) */
  label: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          className={cn("px-3", className)}
        >
          <Navigation />
          지도
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-64 gap-3">
        <div className="grid gap-0.5">
          <p className="font-semibold">지도에서 열기</p>
          <p className="text-muted-foreground text-sm">
            {mapSearchQuery(address)}
          </p>
        </div>
        <MapLinks address={address} className="grid-cols-1" />
      </PopoverContent>
    </Popover>
  );
}

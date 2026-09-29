/*
 * 방문 주소를 지도 앱에서 열기. 웹 주소라 휴대폰에 앱이 있으면 앱으로, 없으면 브라우저로 열린다.
 */

export const MAP_APPS = ["NAVER", "KAKAO", "GOOGLE"] as const;
export type MapApp = (typeof MAP_APPS)[number];
export const MAP_APP_LABELS: Record<MapApp, string> = {
  NAVER: "네이버 지도",
  KAKAO: "카카오맵",
  GOOGLE: "구글 지도",
};

/**
 * 지도에서 찾을 주소. "도로명주소, 상세주소" 형식에서 상세주소(동·호수·층)를 빼야
 * 지도 앱이 건물을 찾는다. 쉼표가 없으면 그대로 쓴다.
 */
export function mapSearchQuery(address: string): string {
  const trimmed = address.trim();
  return trimmed.split(",")[0]!.trim() || trimmed;
}

/** 주소를 그 지도 앱에서 찾는 주소(URL). */
export function mapSearchUrl(app: MapApp, address: string): string {
  const query = encodeURIComponent(mapSearchQuery(address));
  switch (app) {
    case "NAVER":
      return `https://map.naver.com/p/search/${query}`;
    case "KAKAO":
      return `https://map.kakao.com/link/search/${query}`;
    case "GOOGLE":
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
}

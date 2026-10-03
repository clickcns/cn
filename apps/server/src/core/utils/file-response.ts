import { StreamableFile } from "@nestjs/common";

/**
 * 서버가 만든 파일 응답. 한글 파일 이름은 RFC 5987(filename*)로 붙인다 — api-client의 fileDownload가
 * 이 이름을 읽는다. inline이면 브라우저에서 바로 열린다.
 */
export function fileResponse(
  body: Uint8Array,
  {
    type,
    filename,
    fallbackName,
    inline = false,
  }: {
    type: string;
    filename: string;
    /** filename*을 모르는 오래된 클라이언트용 ASCII 이름 */
    fallbackName: string;
    inline?: boolean;
  },
): StreamableFile {
  return new StreamableFile(body, {
    type,
    disposition: `${inline ? "inline" : "attachment"}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

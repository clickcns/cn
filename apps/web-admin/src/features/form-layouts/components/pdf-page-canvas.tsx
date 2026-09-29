import { useEffect, useRef, useState } from "react";
import { renderFirstPage } from "@/features/form-layouts/lib/render-pdf-page";

/** 미리보기 PDF의 첫 장. 부모가 정한 크기(쪽 크기 × scale)를 채운다. */
export function PdfPageCanvas({
  pdf,
  scale,
}: {
  pdf: Blob | undefined;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pdf) return;
    const job = renderFirstPage(pdf, scale);
    job.promise
      .then((image) => {
        const canvas = canvasRef.current;
        if (!image || !canvas) return;
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        setFailed(false);
      })
      .catch(() => setFailed(true));
    return job.cancel;
  }, [pdf, scale]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {failed && (
        <p className="text-destructive bg-card/90 absolute inset-x-0 top-4 mx-auto w-fit rounded-md px-3 py-2 text-sm">
          미리보기를 그리지 못했습니다. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
    </>
  );
}

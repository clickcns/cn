import { getDocument, GlobalWorkerOptions, PDFWorker } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** 미리보기마다 워커를 새로 띄우면 수백 ms가 든다. 하나를 띄워 계속 쓴다(문서를 닫아도 남는다). */
let worker: PDFWorker | undefined;

/**
 * PDF 첫 장을 새 캔버스에 그린다(pt × scale, 기기 픽셀 배율만큼 선명하게). 다 그린 뒤에 화면
 * 캔버스로 옮겨 그리는 동안 이전 그림이 깜박이지 않게 한다. cancel 은 그리던 것을 멈춘다.
 */
export function renderFirstPage(
  pdf: Blob,
  scale: number,
): { promise: Promise<HTMLCanvasElement | null>; cancel: () => void } {
  let cancelled = false;
  let cancelRender: (() => void) | undefined;

  const promise = (async () => {
    worker ??= new PDFWorker();
    const task = getDocument({
      data: new Uint8Array(await pdf.arrayBuffer()),
      worker,
    });
    try {
      const page = await (await task.promise).getPage(1);
      const viewport = page.getViewport({
        scale: scale * (window.devicePixelRatio || 1),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      if (cancelled) return null;
      const render = page.render({ canvas, viewport });
      cancelRender = () => render.cancel();
      await render.promise;
      return cancelled ? null : canvas;
    } finally {
      void task.destroy();
    }
  })();

  return {
    // 멈춘 경우의 오류(RenderingCancelledException)는 그림 없음으로 본다.
    promise: promise.catch((error: unknown) => {
      if (cancelled) return null;
      throw error;
    }),
    cancel: () => {
      cancelled = true;
      cancelRender?.();
    },
  };
}

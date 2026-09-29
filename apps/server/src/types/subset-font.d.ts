/** subset-font(HarfBuzz 부분 글꼴)에는 타입이 없어 쓰는 부분만 적는다. */
declare module "subset-font" {
  interface SubsetFontOptions {
    targetFormat?: "sfnt" | "truetype" | "woff" | "woff2";
    preserveNameIds?: number[];
    noLayoutClosure?: boolean;
  }
  export default function subsetFont(
    font: Buffer | Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}

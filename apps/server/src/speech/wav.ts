/** STT 서버가 받는 PCM 형식: 16kHz·모노·16비트(little-endian). */
export const STT_SAMPLE_RATE = 16_000;
const BYTES_PER_SECOND = STT_SAMPLE_RATE * 2;

export class WavFormatError extends Error {}

export interface PcmAudio {
  /** WAV 헤더를 뗀 PCM 데이터 */
  pcm: Buffer;
  seconds: number;
}

/**
 * 16kHz·모노·16비트 PCM WAV에서 PCM 데이터만 꺼낸다. 다른 형식이면 WavFormatError.
 * 브라우저가 녹음을 이 형식으로 바꿔 올린다(서버에 ffmpeg가 필요 없게).
 */
export function readPcmWav(buffer: Buffer): PcmAudio {
  if (
    buffer.length < 12 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new WavFormatError("WAV 파일이 아닙니다");
  }

  let formatOk = false;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === "fmt ") {
      const audioFormat = buffer.readUInt16LE(body);
      const channels = buffer.readUInt16LE(body + 2);
      const sampleRate = buffer.readUInt32LE(body + 4);
      const bitsPerSample = buffer.readUInt16LE(body + 14);
      formatOk =
        audioFormat === 1 &&
        channels === 1 &&
        sampleRate === STT_SAMPLE_RATE &&
        bitsPerSample === 16;
      if (!formatOk) {
        throw new WavFormatError(
          "16kHz·모노·16비트 PCM WAV만 받을 수 있습니다",
        );
      }
    } else if (id === "data") {
      if (!formatOk) throw new WavFormatError("WAV 형식 정보가 없습니다");
      // 스트리밍 녹음기는 크기를 0xFFFFFFFF로 적기도 한다 → 파일 끝까지.
      const end = Math.min(body + size, buffer.length);
      // 16비트 샘플 경계에 맞춘다.
      const pcm = buffer.subarray(body, end - ((end - body) % 2));
      return { pcm, seconds: pcm.length / BYTES_PER_SECOND };
    }
    // 청크 크기가 홀수면 1바이트 패딩이 붙는다.
    offset = body + size + (size % 2);
  }
  throw new WavFormatError("WAV에 음성 데이터가 없습니다");
}

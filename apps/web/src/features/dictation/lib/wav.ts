/** STT 서버가 받는 형식: 16kHz·모노·16비트 PCM WAV. */
const SAMPLE_RATE = 16_000;

/**
 * 브라우저 녹음(webm·mp4 등) → 16kHz·모노 WAV.
 * OfflineAudioContext로 디코딩하면 그 컨텍스트의 샘플레이트(16kHz)로 바뀌어 나온다.
 * 서버에 ffmpeg 없이 바로 음성인식에 넣을 수 있다.
 */
export async function toWav16kMono(recording: Blob): Promise<Blob> {
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const decoded = await context.decodeAudioData(await recording.arrayBuffer());
  return encodeWav(mixToMono(decoded), decoded.sampleRate);
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      mono[i]! += data[i]! / buffer.numberOfChannels;
    }
  }
  return mono;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // fmt 청크 크기
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 모노
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // 초당 바이트
  view.setUint16(32, 2, true); // 샘플당 바이트
  view.setUint16(34, 16, true); // 비트
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(
      44 + i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

import { encodeFloat32Wav } from "./encodeFloatWav";

interface FinalizeRequest {
  chunksByChannel: Float32Array[][];
  sampleRate: number;
}

self.onmessage = (event: MessageEvent<FinalizeRequest>) => {
  try {
    const channels = event.data.chunksByChannel.map((channelChunks) => {
      const length = channelChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const channel = new Float32Array(length);
      let offset = 0;
      for (const chunk of channelChunks) {
        channel.set(chunk, offset);
        offset += chunk.length;
      }
      return channel;
    });
    const wav = encodeFloat32Wav(channels, event.data.sampleRate);
    self.postMessage({ ok: true, wav }, { transfer: [wav] });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

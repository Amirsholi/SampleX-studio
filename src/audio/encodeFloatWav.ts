export function encodeFloat32Wav(channelData: Float32Array[], sampleRate: number) {
  if (!channelData.length || !channelData[0]?.length) throw new Error("No PCM audio was captured.");
  const frameCount = Math.min(...channelData.map((channel) => channel.length));
  const channelCount = channelData.length;
  const bytesPerSample = 4;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 32, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      view.setFloat32(offset, channelData[channel][frame] ?? 0, true);
      offset += bytesPerSample;
    }
  }
  return arrayBuffer;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

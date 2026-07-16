import type { SelectionRange } from "../types";

export interface WavProcessingOptions {
  fadeMs?: number;
  zeroCrossingSearchMs?: number;
  removeDcOffset?: boolean;
  dither?: boolean;
  random?: () => number;
}

export interface ProcessedPcmSelection {
  channels: Float32Array[];
  startFrame: number;
  endFrame: number;
}

const DEFAULT_OPTIONS = {
  fadeMs: 5,
  zeroCrossingSearchMs: 5,
  removeDcOffset: true,
  dither: true,
};

export function exportSelectionAsWav(
  buffer: AudioBuffer,
  selection: SelectionRange,
  options: WavProcessingOptions = {},
): Blob {
  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, channel) => buffer.getChannelData(channel),
  );
  const wav = encodePcmSelectionAsWav(channels, buffer.sampleRate, selection, options);
  return new Blob([wav], { type: "audio/wav" });
}

export function encodePcmSelectionAsWav(
  channelData: Float32Array[],
  sampleRate: number,
  selection: SelectionRange,
  options: WavProcessingOptions = {},
) {
  const processed = processPcmSelection(channelData, sampleRate, selection, options);
  const channelCount = processed.channels.length;
  const frameCount = processed.channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  const random = options.random ?? Math.random;
  const dither = options.dither ?? DEFAULT_OPTIONS.dither;

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const noise = dither ? (random() - random()) / 32_768 : 0;
      const value = (processed.channels[channel][frame] ?? 0) + noise;
      const clamped = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
      offset += bytesPerSample;
    }
  }

  return arrayBuffer;
}

export function processPcmSelection(
  channelData: Float32Array[],
  sampleRate: number,
  selection: SelectionRange,
  options: WavProcessingOptions = {},
): ProcessedPcmSelection {
  if (!channelData.length || !channelData[0]?.length) throw new Error("Audio contains no samples.");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid audio sample rate.");

  const totalFrames = Math.min(...channelData.map((channel) => channel.length));
  const requestedStart = clamp(Math.floor(selection.start * sampleRate), 0, totalFrames - 1);
  const requestedEnd = clamp(Math.ceil(selection.end * sampleRate), requestedStart + 1, totalFrames);
  const searchFrames = Math.max(0, Math.round(
    sampleRate * (options.zeroCrossingSearchMs ?? DEFAULT_OPTIONS.zeroCrossingSearchMs) / 1000,
  ));
  let startFrame = findQuietBoundary(channelData, requestedStart, searchFrames, 0, requestedEnd - 1);
  let endFrame = findQuietBoundary(channelData, requestedEnd, searchFrames, startFrame + 1, totalFrames);
  if (endFrame <= startFrame) {
    startFrame = requestedStart;
    endFrame = requestedEnd;
  }

  const frameCount = endFrame - startFrame;
  const removeDcOffset = options.removeDcOffset ?? DEFAULT_OPTIONS.removeDcOffset;
  const fadeFrames = Math.min(
    Math.max(0, Math.round(sampleRate * (options.fadeMs ?? DEFAULT_OPTIONS.fadeMs) / 1000)),
    Math.floor(frameCount / 2),
  );
  const channels = channelData.map((source) => {
    const output = source.slice(startFrame, endFrame);
    const dcOffset = removeDcOffset
      ? output.reduce((sum, value) => sum + value, 0) / Math.max(1, output.length)
      : 0;

    for (let frame = 0; frame < output.length; frame += 1) {
      let gain = 1;
      if (fadeFrames > 0 && frame < fadeFrames) gain = frame / fadeFrames;
      if (fadeFrames > 0 && frame >= output.length - fadeFrames) {
        gain = Math.min(gain, (output.length - 1 - frame) / fadeFrames);
      }
      output[frame] = (output[frame] - dcOffset) * gain;
    }
    return output;
  });

  return { channels, startFrame, endFrame };
}

function findQuietBoundary(
  channels: Float32Array[],
  target: number,
  radius: number,
  minimum: number,
  maximum: number,
) {
  const from = clamp(target - radius, minimum, maximum);
  const to = clamp(target + radius, minimum, maximum);
  let bestFrame = clamp(target, minimum, maximum);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let frame = from; frame <= to; frame += 1) {
    let amplitude = 0;
    for (const channel of channels) {
      const before = channel[Math.max(0, frame - 1)] ?? 0;
      const after = channel[Math.min(channel.length - 1, frame)] ?? 0;
      amplitude += Math.abs(before) + Math.abs(after);
    }
    const distancePenalty = Math.abs(frame - target) / Math.max(1, radius) * 0.02;
    const score = amplitude / channels.length + distancePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestFrame = frame;
    }
  }
  return bestFrame;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

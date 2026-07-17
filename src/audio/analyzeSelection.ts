import type { AnalysisResult, SelectionRange } from "../types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function analyzeSelection(buffer: AudioBuffer, range: SelectionRange): AnalysisResult {
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  return analyzePcm(channelData, buffer.sampleRate, range);
}

export function analyzePcm(channelData: Float32Array[], sampleRate: number, range: SelectionRange): AnalysisResult {
  const samples = extractMonoRange(channelData, sampleRate, range);
  const duration = samples.length / sampleRate;
  const channels = detectChannels(channelData, sampleRate, range);

  if (samples.length < sampleRate * 0.25) {
    return {
      bpm: null,
      key: null,
      frequencyHz: null,
      note: null,
      confidence: 0,
      duration,
      channels,
    };
  }

  const bpmResult = estimateBpm(samples, sampleRate);
  const pitchResult = estimatePitchAndKey(samples, sampleRate);
  const confidence = Math.round(((bpmResult.confidence + pitchResult.confidence) / 2) * 100);

  return {
    bpm: bpmResult.bpm,
    key: pitchResult.key,
    frequencyHz: pitchResult.frequencyHz,
    note: pitchResult.frequencyHz ? frequencyToNote(pitchResult.frequencyHz) : null,
    confidence,
    duration,
    channels,
  };
}

function extractMonoRange(channelData: Float32Array[], sampleRate: number, range: SelectionRange) {
  const startFrame = Math.max(0, Math.floor(range.start * sampleRate));
  const endFrame = Math.min(channelData[0]?.length ?? 0, Math.ceil(range.end * sampleRate));
  const length = Math.max(1, endFrame - startFrame);
  const mono = new Float32Array(length);
  const channelEnergy = new Array<number>(channelData.length).fill(0);

  channelData.forEach((channel, channelIndex) => {
    for (let index = 0; index < length; index += 1) {
      const value = channel[startFrame + index] ?? 0;
      mono[index] += value / channelData.length;
      channelEnergy[channelIndex] += value * value;
    }
  });

  let monoEnergy = 0;
  for (const value of mono) monoEnergy += value * value;
  const strongestEnergy = Math.max(...channelEnergy);
  if (strongestEnergy > 0 && monoEnergy / strongestEnergy < 0.05) {
    const strongestChannel = channelEnergy.indexOf(strongestEnergy);
    return channelData[strongestChannel].slice(startFrame, endFrame);
  }

  return mono;
}

function detectChannels(channelData: Float32Array[], sampleRate: number, range: SelectionRange): "Mono" | "Stereo" {
  if (channelData.length < 2) return "Mono";
  const start = Math.max(0, Math.floor(range.start * sampleRate));
  const end = Math.min(channelData[0].length, Math.ceil(range.end * sampleRate));
  const stride = Math.max(1, Math.floor((end - start) / 50_000));
  let difference = 0;
  let energy = 0;
  for (let index = start; index < end; index += stride) {
    const left = channelData[0][index] ?? 0;
    const right = channelData[1][index] ?? 0;
    const delta = left - right;
    difference += delta * delta;
    energy += left * left + right * right;
  }
  return difference / Math.max(energy, 1e-9) < 0.0001 ? "Mono" : "Stereo";
}

function estimateBpm(samples: Float32Array, sampleRate: number) {
  const targetRate = 11_025;
  const reduced = downsample(samples, sampleRate, targetRate);
  const analysisRate = sampleRate / Math.max(1, Math.round(sampleRate / targetRate));
  const frameSize = 512;
  const hopSize = 128;
  const bands = splitFrequencyBands(reduced, analysisRate);
  const bandEnergy = bands.map((band) => frameEnergy(band, frameSize, hopSize));
  if ((bandEnergy[0]?.length ?? 0) < 12) return { bpm: null, confidence: 0 };

  const novelty = bandEnergy[0].map((_, index) => {
    let onset = 0;
    for (const energy of bandEnergy) {
      const current = Math.log1p((energy[index] ?? 0) * 1_000);
      const previous = Math.log1p((energy[index - 1] ?? energy[index] ?? 0) * 1_000);
      onset += Math.max(0, current - previous);
    }
    return index < 3 ? 0 : onset;
  });
  if (Math.max(...novelty) < 0.025) return { bpm: null, confidence: 0 };
  const centered = novelty.map((value, index) => {
    const from = Math.max(0, index - 8);
    const to = Math.min(novelty.length, index + 9);
    let localMean = 0;
    for (let cursor = from; cursor < to; cursor += 1) localMean += novelty[cursor];
    return Math.max(0, value - localMean / Math.max(1, to - from));
  });
  const framesPerSecond = analysisRate / hopSize;
  const peaks = findOnsetPeaks(centered, framesPerSecond);
  if (peaks.length < 4) return { bpm: null, confidence: 0 };

  let bestBpm = 0;
  let bestScore = 0;
  let secondScore = 0;

  for (let bpm = 55; bpm <= 200; bpm += 1) {
    const lag = (60 / bpm) * framesPerSecond;
    const score = periodicityScore(centered, lag) + periodicityScore(centered, lag * 2) * 0.18;
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestBpm = bpm;
    } else if (Math.abs(bpm - bestBpm) > 4 && score > secondScore) {
      secondScore = score;
    }
  }

  if (!bestBpm || bestScore < 0.08) return { bpm: null, confidence: 0 };
  const peakBpm = estimateBpmFromPeaks(centered, framesPerSecond);
  if (!peakBpm) return { bpm: null, confidence: 0 };
  if (Math.abs(peakBpm - bestBpm) <= 4) bestBpm = peakBpm;
  else {
    const ratio = Math.max(peakBpm, bestBpm) / Math.min(peakBpm, bestBpm);
    if (ratio < 1.9 || ratio > 2.1) return { bpm: null, confidence: 0 };
    bestBpm = peakBpm;
  }

  return {
    bpm: bestBpm,
    confidence: Math.max(0, Math.min(1, bestScore * 0.7 + (bestScore - secondScore) * 1.8)),
  };
}

function estimateBpmFromPeaks(novelty: number[], framesPerSecond: number) {
  const peaks = findOnsetPeaks(novelty, framesPerSecond);
  if (peaks.length < 4) return null;
  const tempos = peaks.slice(1).map((peak, index) => {
    let bpm = 60 * framesPerSecond / (peak - peaks[index]);
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return bpm;
  }).filter(Number.isFinite);
  if (!tempos.length) return null;
  const tempo = median(tempos);
  const deviation = median(tempos.map((value) => Math.abs(value - tempo)));
  return deviation <= tempo * 0.08 ? Math.round(tempo) : null;
}

function findOnsetPeaks(novelty: number[], framesPerSecond: number) {
  const mean = novelty.reduce((sum, value) => sum + value, 0) / Math.max(1, novelty.length);
  const variance = novelty.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, novelty.length);
  const threshold = mean + Math.sqrt(variance) * 0.5;
  const minimumGap = Math.max(1, Math.floor(framesPerSecond * 0.16));
  const peaks: number[] = [];
  for (let index = 1; index < novelty.length - 1; index += 1) {
    if (novelty[index] <= threshold || novelty[index] < novelty[index - 1] || novelty[index] <= novelty[index + 1]) continue;
    if (!peaks.length || index - peaks[peaks.length - 1] >= minimumGap) peaks.push(index);
  }
  return peaks;
}

function downsample(samples: Float32Array, sampleRate: number, targetRate: number) {
  const factor = Math.max(1, Math.round(sampleRate / targetRate));
  if (factor === 1) return samples;
  const output = new Float32Array(Math.floor(samples.length / factor));
  for (let index = 0; index < output.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < factor; offset += 1) sum += samples[index * factor + offset] ?? 0;
    output[index] = sum / factor;
  }
  return output;
}

function splitFrequencyBands(samples: Float32Array, sampleRate: number) {
  const low = new Float32Array(samples.length);
  const mid = new Float32Array(samples.length);
  const high = new Float32Array(samples.length);
  const lowPole = Math.exp(-2 * Math.PI * 180 / sampleRate);
  const midPole = Math.exp(-2 * Math.PI * 2_000 / sampleRate);
  let lowState = 0;
  let midState = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    lowState = lowPole * lowState + (1 - lowPole) * value;
    midState = midPole * midState + (1 - midPole) * value;
    low[index] = lowState;
    mid[index] = midState - lowState;
    high[index] = value - midState;
  }
  return [low, mid, high];
}

function frameEnergy(samples: Float32Array, frameSize: number, hopSize: number) {
  const energies: number[] = [];
  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    let energy = 0;
    for (let index = 0; index < frameSize; index += 1) energy += samples[offset + index] ** 2;
    energies.push(energy / frameSize);
  }
  return energies;
}

function periodicityScore(novelty: number[], lag: number) {
  if (lag < 1 || lag >= novelty.length - 1) return 0;
  const lower = Math.floor(lag);
  const fraction = lag - lower;
  let score = 0;
  let energyA = 0;
  let energyB = 0;
  for (let index = lower + 1; index < novelty.length; index += 1) {
    const delayed = novelty[index - lower] * (1 - fraction) + novelty[index - lower - 1] * fraction;
    score += novelty[index] * delayed;
    energyA += novelty[index] ** 2;
    energyB += delayed ** 2;
  }
  return score / Math.sqrt(energyA * energyB || 1);
}

function estimatePitchAndKey(samples: Float32Array, sampleRate: number) {
  const windowSize = 4096;
  const hopSize = 2048;
  const maximumFrames = 48;
  const availableFrames = Math.max(1, Math.floor((samples.length - windowSize) / hopSize) + 1);
  const frameStride = Math.max(1, Math.ceil(availableFrames / maximumFrames));
  const chroma = new Array<number>(12).fill(0);
  const pitches: number[] = [];

  for (let frameIndex = 0; frameIndex < availableFrames; frameIndex += frameStride) {
    const offset = frameIndex * hopSize;
    if (offset + windowSize > samples.length) break;
    const frame = samples.subarray(offset, offset + windowSize);
    const rms = Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / frame.length);
    if (rms < 0.01) {
      continue;
    }

    const frequency = estimateFundamental(frame, sampleRate);
    if (!frequency || frequency < 45 || frequency > 1800) {
      continue;
    }

    pitches.push(frequency);
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const pitchClass = mod(Math.round(midi), 12);
    chroma[pitchClass] += rms;
  }

  if (pitches.length === 0) {
    return { frequencyHz: null, key: null, confidence: 0 };
  }

  const frequencyHz = median(pitches);
  const keyResult = estimateKeyFromChroma(chroma);

  return {
    frequencyHz,
    key: keyResult.key,
    confidence: keyResult.confidence,
  };
}

function estimateFundamental(frame: Float32Array, sampleRate: number) {
  const minFrequency = 45;
  const maxFrequency = 1800;
  const minLag = Math.floor(sampleRate / maxFrequency);
  const maxLag = Math.min(Math.floor(sampleRate / minFrequency), frame.length - 1);
  let bestCorrelation = 0;
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;
    for (let index = 0; index < frame.length - lag; index += 1) {
      const a = frame[index];
      const b = frame[index + lag];
      correlation += a * b;
      normA += a * a;
      normB += b * b;
    }

    const normalized = correlation / Math.sqrt(normA * normB || 1);
    correlations[lag] = normalized;
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
    }
  }

  if (bestCorrelation < 0.35) {
    return null;
  }

  const threshold = Math.max(0.35, bestCorrelation * 0.9);
  let selectedLag = 0;
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    const current = correlations[lag];
    if (current >= threshold && current >= correlations[lag - 1] && current > correlations[lag + 1]) {
      selectedLag = lag;
      break;
    }
  }
  if (!selectedLag) return null;

  const before = correlations[selectedLag - 1];
  const center = correlations[selectedLag];
  const after = correlations[selectedLag + 1];
  const denominator = before - 2 * center + after;
  const offset = Math.abs(denominator) > 1e-9 ? 0.5 * (before - after) / denominator : 0;
  return sampleRate / (selectedLag + Math.max(-0.5, Math.min(0.5, offset)));
}

function estimateKeyFromChroma(chroma: number[]) {
  const total = chroma.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { key: null, confidence: 0 };
  }

  const normalized = chroma.map((value) => value / total);
  let bestKey = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondScore = Number.NEGATIVE_INFINITY;

  for (let tonic = 0; tonic < 12; tonic += 1) {
    const majorScore = profileScore(normalized, rotateProfile(MAJOR_PROFILE, tonic));
    const minorScore = profileScore(normalized, rotateProfile(MINOR_PROFILE, tonic));

    for (const candidate of [
      { key: `${NOTE_NAMES[tonic]} Major`, score: majorScore },
      { key: `${NOTE_NAMES[tonic]} Minor`, score: minorScore },
    ]) {
      if (candidate.score > bestScore) {
        secondScore = bestScore;
        bestScore = candidate.score;
        bestKey = candidate.key;
      } else if (candidate.score > secondScore) {
        secondScore = candidate.score;
      }
    }
  }

  const confidence = Math.max(0, Math.min(1, (bestScore - secondScore) / Math.max(0.01, Math.abs(bestScore))));
  return { key: bestKey, confidence };
}

function rotateProfile(profile: number[], tonic: number) {
  const rotated = new Array<number>(12);
  for (let index = 0; index < 12; index += 1) {
    rotated[(index + tonic) % 12] = profile[index];
  }
  return rotated;
}

function profileScore(chroma: number[], profile: number[]) {
  const profileTotal = profile.reduce((sum, value) => sum + value, 0);
  return chroma.reduce((sum, value, index) => sum + value * (profile[index] / profileTotal), 0);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function frequencyToNote(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[mod(midi, 12)]}${octave}`;
}

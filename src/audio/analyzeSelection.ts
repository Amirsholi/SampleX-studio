import type { AnalysisResult, SelectionRange } from "../types";
import { magnitudeSpectrum } from "./spectrum";

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

  for (const channel of channelData) {
    for (let index = 0; index < length; index += 1) {
      mono[index] += (channel[startFrame + index] ?? 0) / channelData.length;
    }
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
  const targetRate = 22_050;
  const reduced = downsample(samples, sampleRate, targetRate);
  const analysisRate = sampleRate / Math.max(1, Math.round(sampleRate / targetRate));
  const frameSize = 1024;
  const hopSize = 256;
  const novelty: number[] = [];
  let previous = new Float64Array(frameSize / 2 + 1);

  for (let offset = 0; offset + frameSize <= reduced.length; offset += hopSize) {
    const spectrum = magnitudeSpectrum(reduced.subarray(offset, offset + frameSize), frameSize);
    let flux = 0;
    const highestBin = Math.min(spectrum.length - 1, Math.floor(8_000 * frameSize / analysisRate));
    for (let bin = 2; bin <= highestBin; bin += 1) {
      const value = Math.log1p(spectrum[bin]);
      const delta = value - previous[bin];
      if (delta > 0) flux += delta * (0.7 + bin / highestBin * 0.3);
      previous[bin] = value;
    }
    novelty.push(flux);
  }

  if (novelty.length < 16) {
    return { bpm: null, confidence: 0 };
  }

  const centered = novelty.map((value, index) => {
    const from = Math.max(0, index - 8);
    const to = Math.min(novelty.length, index + 9);
    let localMean = 0;
    for (let cursor = from; cursor < to; cursor += 1) localMean += novelty[cursor];
    return Math.max(0, value - localMean / (to - from));
  });
  const framesPerSecond = analysisRate / hopSize;
  let bestBpm = 0;
  let bestScore = 0;
  let secondScore = 0;

  for (let bpm = 55; bpm <= 205; bpm += 1) {
    const lag = (60 / bpm) * framesPerSecond;
    const harmonicScore = periodicityScore(centered, lag)
      + periodicityScore(centered, lag / 2) * 0.2;
    const tempoPrior = 1 + 0.16 * Math.exp(-Math.pow((bpm - 120) / 48, 2));
    const score = harmonicScore * tempoPrior;
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestBpm = bpm;
    } else if (Math.abs(bpm - bestBpm) > 4 && score > secondScore) {
      secondScore = score;
    }
  }

  if (!bestBpm || bestScore <= 0) {
    const fallback = estimateBpmFromPeaks(centered, framesPerSecond);
    return { bpm: fallback, confidence: fallback ? 0.25 : 0 };
  }

  const peakBpm = estimateBpmFromPeaks(centered, framesPerSecond);
  if (peakBpm) {
    const ratio = Math.max(peakBpm, bestBpm) / Math.min(peakBpm, bestBpm);
    if (ratio > 1.9 && ratio < 2.1 && peakBpm >= 85 && peakBpm <= 170) bestBpm = peakBpm;
  }

  return {
    bpm: bestBpm,
    confidence: Math.max(0, Math.min(1, (bestScore - secondScore) / Math.max(bestScore, 1e-9) * 3)),
  };
}

function estimateBpmFromPeaks(novelty: number[], framesPerSecond: number) {
  const mean = novelty.reduce((sum, value) => sum + value, 0) / Math.max(1, novelty.length);
  const variance = novelty.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, novelty.length);
  const threshold = mean + Math.sqrt(variance) * 0.55;
  const peaks: number[] = [];
  const minimumGap = Math.max(1, Math.floor(framesPerSecond * 0.18));
  for (let index = 1; index < novelty.length - 1; index += 1) {
    if (novelty[index] > threshold && novelty[index] >= novelty[index - 1] && novelty[index] > novelty[index + 1]) {
      if (!peaks.length || index - peaks[peaks.length - 1] >= minimumGap) peaks.push(index);
    }
  }
  if (peaks.length < 4) return null;
  const tempos = peaks.slice(1).map((peak, index) => {
    let bpm = 60 * framesPerSecond / (peak - peaks[index]);
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return bpm;
  }).filter(Number.isFinite);
  return tempos.length ? Math.round(median(tempos)) : null;
}

function estimatePitchAndKey(samples: Float32Array, sampleRate: number) {
  const windowSize = 4096;
  const hopSize = 2048;
  const chroma = buildSpectralChroma(samples, sampleRate);
  const pitches: number[] = [];

  for (let offset = 0; offset + windowSize < samples.length; offset += hopSize) {
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

function buildSpectralChroma(samples: Float32Array, sampleRate: number) {
  const frameSize = 4096;
  const hopSize = 2048;
  const chroma = new Array<number>(12).fill(0);
  const frameLimit = 320;
  const availableFrames = Math.max(1, Math.floor((samples.length - frameSize) / hopSize) + 1);
  const frameStride = Math.max(1, Math.ceil(availableFrames / frameLimit));

  for (let frameIndex = 0; frameIndex < availableFrames; frameIndex += frameStride) {
    const offset = frameIndex * hopSize;
    if (offset + frameSize > samples.length) break;
    const spectrum = magnitudeSpectrum(samples.subarray(offset, offset + frameSize), frameSize);
    const minimumBin = Math.max(2, Math.ceil(55 * frameSize / sampleRate));
    const maximumBin = Math.min(spectrum.length - 2, Math.floor(5_000 * frameSize / sampleRate));
    for (let bin = minimumBin; bin <= maximumBin; bin += 1) {
      const magnitude = spectrum[bin];
      if (magnitude <= spectrum[bin - 1] || magnitude < spectrum[bin + 1]) continue;
      const frequency = bin * sampleRate / frameSize;
      const midi = 69 + 12 * Math.log2(frequency / 440);
      const nearest = Math.round(midi);
      const distance = Math.abs(midi - nearest);
      const pitchClass = mod(nearest, 12);
      const tuningWeight = Math.max(0, 1 - distance * 2);
      chroma[pitchClass] += Math.sqrt(magnitude) * tuningWeight / Math.sqrt(frequency);
    }
  }
  return chroma;
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
  const chromaMean = chroma.reduce((sum, value) => sum + value, 0) / chroma.length;
  const profileMean = profile.reduce((sum, value) => sum + value, 0) / profile.length;
  let numerator = 0;
  let chromaEnergy = 0;
  let profileEnergy = 0;
  for (let index = 0; index < chroma.length; index += 1) {
    const chromaValue = chroma[index] - chromaMean;
    const profileValue = profile[index] - profileMean;
    numerator += chromaValue * profileValue;
    chromaEnergy += chromaValue * chromaValue;
    profileEnergy += profileValue * profileValue;
  }
  return numerator / Math.sqrt(chromaEnergy * profileEnergy || 1);
}

function downsample(samples: Float32Array, sampleRate: number, targetRate: number) {
  const factor = Math.max(1, Math.round(sampleRate / targetRate));
  if (factor === 1) return samples;
  const output = new Float32Array(Math.floor(samples.length / factor));
  for (let index = 0; index < output.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < factor; offset += 1) sum += samples[index * factor + offset];
    output[index] = sum / factor;
  }
  return output;
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
    energyA += novelty[index] * novelty[index];
    energyB += delayed * delayed;
  }
  return score / Math.sqrt(energyA * energyB || 1);
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

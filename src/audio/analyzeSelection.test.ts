import { describe, expect, it } from "vitest";
import { analyzePcm } from "./analyzeSelection";

const SAMPLE_RATE = 44_100;

describe("audio analysis baseline", () => {
  it("recognizes a steady 120 BPM click track", () => {
    const duration = 8;
    const signal = new Float32Array(SAMPLE_RATE * duration);
    const beatInterval = SAMPLE_RATE / 2;
    for (let beat = 0; beat < signal.length; beat += beatInterval) {
      for (let sample = 0; sample < 700 && beat + sample < signal.length; sample += 1) {
        signal[beat + sample] += Math.exp(-sample / 90) * Math.sin(2 * Math.PI * 110 * sample / SAMPLE_RATE);
      }
    }

    const result = analyzePcm([signal], SAMPLE_RATE, { start: 0, end: duration });
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
  });

  it("recognizes a monophonic A4 tone", () => {
    const duration = 1.5;
    const signal = Float32Array.from(
      { length: Math.floor(SAMPLE_RATE * duration) },
      (_, sample) => Math.sin(2 * Math.PI * 440 * sample / SAMPLE_RATE) * 0.5,
    );

    const result = analyzePcm([signal], SAMPLE_RATE, { start: 0, end: duration });
    expect(result.frequencyHz).toBeGreaterThan(435);
    expect(result.frequencyHz).toBeLessThan(445);
    expect(result.note).toBe("A4");
  });

  it("builds tonal context from a polyphonic C major chord", () => {
    const duration = 3;
    const frequencies = [261.63, 329.63, 392];
    const signal = Float32Array.from(
      { length: Math.floor(SAMPLE_RATE * duration) },
      (_, sample) => frequencies.reduce(
        (sum, frequency) => sum + Math.sin(2 * Math.PI * frequency * sample / SAMPLE_RATE) / frequencies.length,
        0,
      ) * 0.55,
    );

    const result = analyzePcm([signal], SAMPLE_RATE, { start: 0, end: duration });
    expect(result.key).toBe("C Major");
  });

  it("does not lose analysis when stereo channels are out of phase", () => {
    const duration = 1.5;
    const left = Float32Array.from(
      { length: Math.floor(SAMPLE_RATE * duration) },
      (_, sample) => Math.sin(2 * Math.PI * 440 * sample / SAMPLE_RATE) * 0.5,
    );
    const right = Float32Array.from(left, (sample) => -sample);

    const result = analyzePcm([left, right], SAMPLE_RATE, { start: 0, end: duration });
    expect(result.frequencyHz).toBeGreaterThan(435);
    expect(result.frequencyHz).toBeLessThan(445);
    expect(result.channels).toBe("Stereo");
  });

  it("rejects selections that are too short for meaningful analysis", () => {
    const signal = new Float32Array(Math.floor(SAMPLE_RATE * 0.1));
    const result = analyzePcm([signal], SAMPLE_RATE, { start: 0, end: 0.1 });

    expect(result.bpm).toBeNull();
    expect(result.key).toBeNull();
    expect(result.frequencyHz).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

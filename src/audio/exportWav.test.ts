import { describe, expect, it } from "vitest";
import { encodePcmSelectionAsWav, processPcmSelection } from "./exportWav";

describe("WAV export processing", () => {
  it("writes a valid stereo PCM16 header", () => {
    const left = new Float32Array(1_000).fill(0.25);
    const right = new Float32Array(1_000).fill(-0.25);
    const wav = encodePcmSelectionAsWav([left, right], 48_000, { start: 0, end: 1_000 / 48_000 }, {
      dither: false,
      fadeMs: 0,
      removeDcOffset: false,
      zeroCrossingSearchMs: 0,
    });
    const view = new DataView(wav);

    expect(readAscii(view, 0, 4)).toBe("RIFF");
    expect(readAscii(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(4_000);
  });

  it("removes DC offset without normalizing the signal", () => {
    const source = Float32Array.from({ length: 200 }, (_, index) => 0.2 + Math.sin(index / 8) * 0.1);
    const result = processPcmSelection([source], 1_000, { start: 0, end: 0.2 }, {
      fadeMs: 0,
      zeroCrossingSearchMs: 0,
    });
    const output = result.channels[0];
    const mean = output.reduce((sum, value) => sum + value, 0) / output.length;
    const peak = Math.max(...output.map(Math.abs));

    expect(Math.abs(mean)).toBeLessThan(1e-6);
    expect(peak).toBeLessThan(0.2);
  });

  it("fades both cut boundaries to silence", () => {
    const source = new Float32Array(1_000).fill(0.75);
    const result = processPcmSelection([source], 1_000, { start: 0, end: 1 }, {
      fadeMs: 10,
      removeDcOffset: false,
      zeroCrossingSearchMs: 0,
    });
    const output = result.channels[0];

    expect(output[0]).toBe(0);
    expect(output[5]).toBeCloseTo(0.375, 5);
    expect(output[20]).toBeCloseTo(0.75, 5);
    expect(output[output.length - 1]).toBe(0);
  });

  it("moves a cut toward a nearby quiet boundary", () => {
    const source = new Float32Array(100).fill(0.8);
    source[18] = 0.01;
    source[19] = 0;
    source[20] = 0.01;
    source[79] = 0.01;
    source[80] = 0;
    source[81] = 0.01;
    const result = processPcmSelection([source], 1_000, { start: 0.021, end: 0.079 }, {
      fadeMs: 0,
      removeDcOffset: false,
      zeroCrossingSearchMs: 4,
    });

    expect(result.startFrame).toBeGreaterThanOrEqual(18);
    expect(result.startFrame).toBeLessThanOrEqual(20);
    expect(result.endFrame).toBeGreaterThanOrEqual(79);
    expect(result.endFrame).toBeLessThanOrEqual(81);
  });

  it("uses deterministic TPDF dithering when a random source is provided", () => {
    const silence = new Float32Array(8);
    const values = [1, 0, 0.75, 0.25];
    let index = 0;
    const wav = encodePcmSelectionAsWav([silence], 8_000, { start: 0, end: 0.001 }, {
      fadeMs: 0,
      removeDcOffset: false,
      zeroCrossingSearchMs: 0,
      random: () => values[index++ % values.length],
    });
    const view = new DataView(wav);
    const samples = Array.from({ length: 8 }, (_, sample) => view.getInt16(44 + sample * 2, true));

    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });
});

function readAscii(view: DataView, offset: number, length: number) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
}

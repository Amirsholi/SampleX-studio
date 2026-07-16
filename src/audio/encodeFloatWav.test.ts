import { describe, expect, it } from "vitest";
import { encodeFloat32Wav } from "./encodeFloatWav";

describe("Float32 WAV encoding", () => {
  it("preserves stereo PCM samples without lossy encoding", () => {
    const left = Float32Array.from([0, 0.125, -0.5, 0.999]);
    const right = Float32Array.from([0, -0.25, 0.75, -1]);
    const wav = encodeFloat32Wav([left, right], 48_000);
    const view = new DataView(wav);

    expect(view.getUint16(20, true)).toBe(3);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(32);
    expect(view.getFloat32(44 + 3 * 8, true)).toBeCloseTo(0.999, 6);
    expect(view.getFloat32(44 + 3 * 8 + 4, true)).toBe(-1);
  });
});

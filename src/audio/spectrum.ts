const windowCache = new Map<number, Float64Array>();

export function magnitudeSpectrum(input: Float32Array, size: number) {
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error("FFT size must be a power of two.");
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  const window = hannWindow(size);
  const length = Math.min(input.length, size);
  let mean = 0;
  for (let index = 0; index < length; index += 1) mean += input[index];
  mean /= Math.max(1, length);
  for (let index = 0; index < length; index += 1) real[index] = (input[index] - mean) * window[index];

  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      const temporary = real[index];
      real[index] = real[reversed];
      real[reversed] = temporary;
    }
  }

  for (let width = 2; width <= size; width <<= 1) {
    const angle = -2 * Math.PI / width;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < size; start += width) {
      let rotationReal = 1;
      let rotationImaginary = 0;
      for (let offset = 0; offset < width / 2; offset += 1) {
        const even = start + offset;
        const odd = even + width / 2;
        const oddReal = real[odd] * rotationReal - imaginary[odd] * rotationImaginary;
        const oddImaginary = real[odd] * rotationImaginary + imaginary[odd] * rotationReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextRotationReal = rotationReal * stepReal - rotationImaginary * stepImaginary;
        rotationImaginary = rotationReal * stepImaginary + rotationImaginary * stepReal;
        rotationReal = nextRotationReal;
      }
    }
  }

  const spectrum = new Float64Array(size / 2 + 1);
  for (let bin = 0; bin < spectrum.length; bin += 1) {
    spectrum[bin] = Math.hypot(real[bin], imaginary[bin]);
  }
  return spectrum;
}

function hannWindow(size: number) {
  const cached = windowCache.get(size);
  if (cached) return cached;
  const window = Float64Array.from(
    { length: size },
    (_, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (size - 1)),
  );
  windowCache.set(size, window);
  return window;
}

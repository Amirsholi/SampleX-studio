class SampleXPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.blocks = [];
    this.frames = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === "FLUSH") {
        this.flush();
        this.port.postMessage({ type: "FLUSHED" });
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input?.length) return true;
    if (this.blocks.length !== input.length) this.blocks = Array.from({ length: input.length }, () => []);
    for (let channel = 0; channel < input.length; channel += 1) {
      const block = new Float32Array(input[channel]);
      this.blocks[channel].push(block);
      if (output[channel]) output[channel].set(input[channel]);
    }
    this.frames += input[0].length;
    if (this.frames >= 16_384) this.flush();
    return true;
  }

  flush() {
    if (!this.frames || !this.blocks.length) return;
    const channels = this.blocks.map((blocks) => {
      const channel = new Float32Array(this.frames);
      let offset = 0;
      for (const block of blocks) {
        channel.set(block, offset);
        offset += block.length;
      }
      return channel;
    });
    this.port.postMessage({ type: "PCM_CHUNK", channels }, channels.map((channel) => channel.buffer));
    this.blocks = Array.from({ length: this.blocks.length }, () => []);
    this.frames = 0;
  }
}

registerProcessor("samplex-pcm-capture", SampleXPcmCapture);

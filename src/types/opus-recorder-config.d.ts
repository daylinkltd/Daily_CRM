// Augments the vendored `opus-recorder` subset in ./opus-recorder.d.ts with
// the one extra config option the voice-note composer needs.
//
// `sourceNode` makes the recorder use an AudioNode (and its AudioContext)
// the caller already built, instead of calling `getUserMedia` itself. The
// composer relies on that: it requests the mic itself, directly in the
// click handler, so the browser reliably shows its permission prompt and
// so `getUserMedia` failures can be diagnosed (denied vs. no device vs.
// insecure context) rather than swallowed inside `recorder.start()`.
//
// Ambient module declarations merge, so `RecorderConfig` gains this field
// without editing the hand-written subset.
declare module "opus-recorder" {
  interface RecorderConfig {
    /**
     * Pre-built media source. When set, the recorder skips `getUserMedia`
     * and adopts `sourceNode.context` as its AudioContext — meaning the
     * caller also owns stopping the stream's tracks and closing that
     * context (`stop()` only clears streams the recorder opened itself).
     */
    sourceNode?: MediaStreamAudioSourceNode;
  }
}

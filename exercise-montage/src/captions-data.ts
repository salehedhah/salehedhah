import type { Caption } from "@remotion/captions";

// Hand-timed captions: word boundaries anchored to detected silence gaps
// (ffmpeg silencedetect), durations within each gap weighted by character
// count. Automatic Whisper transcription was unavailable (model host
// blocked by network policy), so timings are a heuristic approximation.
export const captions: Caption[] = [
  { text: " سأعطيكم", startMs: 0, endMs: 638, timestampMs: 319, confidence: null },
  { text: " تمرين،", startMs: 638, endMs: 1094, timestampMs: 866, confidence: null },
  { text: " إذا", startMs: 1200, endMs: 1357, timestampMs: 1279, confidence: null },
  { text: " قمتوا", startMs: 1357, endMs: 1617, timestampMs: 1487, confidence: null },
  { text: " بذلك،", startMs: 1617, endMs: 1826, timestampMs: 1722, confidence: null },
  { text: " ستصبحون", startMs: 1962, endMs: 2172, timestampMs: 2067, confidence: null },
  { text: " مستحيلين.", startMs: 2172, endMs: 2412, timestampMs: 2292, confidence: null, pageBreakAfter: true },
  { text: " لا", startMs: 2412, endMs: 2580, timestampMs: 2496, confidence: null },
  { text: " أحد", startMs: 2580, endMs: 2833, timestampMs: 2707, confidence: null },
  { text: " سيصدق", startMs: 2833, endMs: 3253, timestampMs: 3043, confidence: null },
  { text: " أنكم", startMs: 3253, endMs: 3590, timestampMs: 3422, confidence: null },
  { text: " نفسكم.", startMs: 3590, endMs: 4011, timestampMs: 3801, confidence: null, pageBreakAfter: true },
  { text: " عندما", startMs: 4011, endMs: 4431, timestampMs: 4221, confidence: null },
  { text: " بدأت", startMs: 4431, endMs: 4768, timestampMs: 4600, confidence: null },
  { text: " على", startMs: 4768, endMs: 5020, timestampMs: 4894, confidence: null },
  { text: " اليوتيوب،", startMs: 5020, endMs: 5693, timestampMs: 5357, confidence: null },
  { text: " كنت", startMs: 5693, endMs: 5946, timestampMs: 5820, confidence: null },
  { text: " أتحدث", startMs: 5946, endMs: 6366, timestampMs: 6156, confidence: null },
  { text: " بطريقة", startMs: 6366, endMs: 6871, timestampMs: 6619, confidence: null },
  { text: " غبية.", startMs: 6984, endMs: 7323, timestampMs: 7154, confidence: null, pageBreakAfter: true },
  { text: " أما", startMs: 7323, endMs: 7578, timestampMs: 7451, confidence: null },
  { text: " الآن،", startMs: 7578, endMs: 7917, timestampMs: 7748, confidence: null },
  { text: " أصبحت", startMs: 7917, endMs: 8341, timestampMs: 8129, confidence: null },
  { text: " أفضل", startMs: 8341, endMs: 8680, timestampMs: 8511, confidence: null },
  { text: " شخص", startMs: 8826, endMs: 9023, timestampMs: 8925, confidence: null },
  { text: " في", startMs: 9023, endMs: 9155, timestampMs: 9089, confidence: null },
  { text: " العالم.", startMs: 9155, endMs: 9550, timestampMs: 9353, confidence: null },
];

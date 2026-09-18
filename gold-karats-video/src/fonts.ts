import { loadFont as loadTajawal } from "@remotion/google-fonts/Tajawal";
import { loadFont as loadArefRuqaa } from "@remotion/google-fonts/ArefRuqaa";

export const { fontFamily: lightFontFamily } = loadTajawal("normal", {
  weights: ["300", "500"],
  subsets: ["arabic"],
});

export const { fontFamily: boldFontFamily } = loadArefRuqaa("normal", {
  weights: ["700"],
  subsets: ["arabic"],
});

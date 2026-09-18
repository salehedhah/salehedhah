import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { TikTokPage } from "@remotion/captions";
import { theme } from "../theme";
import { captionFontFamily } from "../fonts";

const STROKE = [-3, 3].flatMap((x) => [-3, 3].map((y) => `${x}px ${y}px 0 ${theme.stroke}`));
const TEXT_SHADOW = [...STROKE, "0 10px 24px rgba(0,0,0,0.55)"].join(", ");

export const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTimeMs = (frame / fps) * 1000;
  const absoluteTimeMs = page.startMs + currentTimeMs;

  const enter = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
    output: "perceptual-scale",
  });

  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        bottom: 130,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignContent: "flex-end",
        scale: enter,
        opacity: enter,
      }}
    >
      {page.tokens.map((token, i) => {
        const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
        const hasPassed = absoluteTimeMs >= token.toMs;

        const pop = isActive
          ? interpolate(
              absoluteTimeMs,
              [token.fromMs, token.fromMs + 60],
              [0.85, 1.08],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", output: "perceptual-scale" },
            )
          : 1;

        return (
          <span
            key={`${token.fromMs}-${i}`}
            style={{
              position: "relative",
              display: "inline-block",
              whiteSpace: "pre",
              fontFamily: captionFontFamily,
              fontWeight: 900,
              fontSize: 66,
              lineHeight: 1.25,
              color: isActive || hasPassed ? theme.gold : theme.white,
              textShadow: TEXT_SHADOW,
              scale: pop,
            }}
          >
            {token.text}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  right: 4,
                  bottom: -6,
                  height: 6,
                  borderRadius: 3,
                  background: theme.gold,
                  boxShadow: `0 0 14px 2px ${theme.goldDeep}`,
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
};

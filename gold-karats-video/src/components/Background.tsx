import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { boldFontFamily } from "../fonts";
import { Petal } from "./Petal";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const watermarkScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.06],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ribbonProgress = interpolate(
    frame,
    [0, 0.6 * durationInFrames, durationInFrames],
    [-0.3, 0.6, 1.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      name="Background"
      style={{
        backgroundColor: theme.background,
        overflow: "hidden",
      }}
    >
      {/* Ghosted watermark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          translate: "-50% -50%",
          scale: watermarkScale,
          fontFamily: boldFontFamily,
          fontSize: width * 0.62,
          color: theme.gold,
          opacity: 0.14,
          filter: "blur(2px)",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        ذهب
      </div>

      {/* Diagonal gold ribbon */}
      <div
        style={{
          position: "absolute",
          top: height * ribbonProgress - height * 0.15,
          left: -width * 0.3,
          width: width * 1.6,
          height: height * 0.16,
          background: `linear-gradient(90deg, ${theme.gold}00, ${theme.gold}CC, ${theme.gold}00)`,
          rotate: "-16deg",
        }}
      />

      <Petal top={-40} right={-60} size={340} startRotation={20} spin={14} />
      <Petal bottom={-60} left={-80} size={380} startRotation={-30} spin={-16} />
    </AbsoluteFill>
  );
};

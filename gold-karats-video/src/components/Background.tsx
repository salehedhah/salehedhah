import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { boldFontFamily } from "../fonts";
import { Bokeh } from "./Bokeh";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const watermarkPulse = interpolate(
    Math.sin(frame / 70),
    [-1, 1],
    [0.08, 0.16],
  );

  const ribbonProgress = interpolate(
    frame,
    [0, 0.55 * durationInFrames, durationInFrames],
    [-0.35, 0.55, 1.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      name="Background"
      style={{
        background: `radial-gradient(120% 90% at 50% 32%, ${theme.backgroundMid} 0%, ${theme.backgroundDeep} 72%)`,
        overflow: "hidden",
      }}
    >
      {/* Ghosted outlined watermark */}
      <div
        style={{
          position: "absolute",
          top: "46%",
          left: "50%",
          translate: "-50% -50%",
          fontFamily: boldFontFamily,
          fontSize: width * 0.68,
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: "transparent",
          WebkitTextStroke: `1.5px rgba(217, 175, 86, ${watermarkPulse})`,
        }}
      >
        ذهب
      </div>

      {/* Warm glow behind the card */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          translate: "-50% -50%",
          width: width * 1.1,
          height: width * 1.1,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.glow} 0%, transparent 65%)`,
        }}
      />

      {/* Thin diagonal light beam */}
      <div
        style={{
          position: "absolute",
          top: height * ribbonProgress - height * 0.15,
          left: -width * 0.3,
          width: width * 1.6,
          height: 3,
          background: `linear-gradient(90deg, ${theme.gold}00, ${theme.goldSoft}CC, ${theme.gold}00)`,
          rotate: "-16deg",
          boxShadow: `0 0 24px 3px ${theme.glow}`,
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: `inset 0 0 ${width * 0.5}px ${width * 0.22}px ${theme.backgroundDeep}`,
        }}
      />

      <Bokeh top={90} right={-30} size={210} driftX={-40} driftY={30} opacity={0.5} delay={0} />
      <Bokeh bottom={140} left={-40} size={170} driftX={30} driftY={-25} opacity={0.4} delay={40} />
      <Bokeh top={height * 0.5} left={20} size={70} driftX={-15} driftY={20} opacity={0.35} delay={80} />
      <Bokeh bottom={80} right={40} size={60} driftX={15} driftY={-15} opacity={0.3} delay={120} />
    </AbsoluteFill>
  );
};

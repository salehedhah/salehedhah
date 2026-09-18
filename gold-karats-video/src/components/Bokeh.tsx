import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type BokehProps = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  driftX: number;
  driftY: number;
  opacity: number;
  delay?: number;
};

export const Bokeh: React.FC<BokehProps> = ({
  top,
  bottom,
  left,
  right,
  size,
  driftX,
  driftY,
  opacity,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(
    frame,
    [0, durationInFrames],
    [0, 1],
  );

  const pulse = interpolate(
    Math.sin((frame + delay) / 22),
    [-1, 1],
    [0.7, 1],
  );

  return (
    <div
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.goldSoft} 0%, ${theme.gold} 40%, transparent 72%)`,
        opacity: opacity * pulse,
        filter: "blur(22px)",
        translate: `${driftX * progress}px ${driftY * progress}px`,
      }}
    />
  );
};

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type SparkleSpec = {
  top: number;
  left: number;
  size: number;
  period: number;
  offset: number;
};

const SPARKLES: SparkleSpec[] = [
  { top: 210, left: 70, size: 26, period: 90, offset: 0 },
  { top: 340, left: 640, size: 20, period: 110, offset: 35 },
  { top: 980, left: 90, size: 22, period: 100, offset: 60 },
  { top: 1080, left: 610, size: 18, period: 130, offset: 15 },
  { top: 560, left: 40, size: 16, period: 95, offset: 80 },
];

const Sparkle: React.FC<SparkleSpec> = ({ top, left, size, period, offset }) => {
  const frame = useCurrentFrame();
  const cycle = (frame + offset) % period;

  const scale = interpolate(cycle, [0, 6, 14, 20], [0, 1.1, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotate = interpolate(cycle, [0, period], [0, 40]);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        fontSize: size,
        color: theme.goldSoft,
        scale,
        rotate: `${rotate}deg`,
        textShadow: `0 0 12px ${theme.gold}`,
      }}
    >
      ✦
    </div>
  );
};

export const SparkleField: React.FC = () => {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}
    </>
  );
};

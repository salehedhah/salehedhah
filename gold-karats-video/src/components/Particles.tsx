import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

const PARTICLE_COUNT = 16;

const Particle: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const baseX = random(`p-x-${index}`) * width;
  const baseY = random(`p-y-${index}`) * height;
  const size = 3 + random(`p-size-${index}`) * 6;
  const swayAmp = 16 + random(`p-sway-${index}`) * 26;
  const swayFreq = 0.9 + random(`p-freq-${index}`) * 1.4;
  const phase = random(`p-phase-${index}`) * Math.PI * 2;
  const riseSpeed = 70 + random(`p-rise-${index}`) * 130;

  const progress = frame / durationInFrames;
  const y = baseY - progress * riseSpeed;
  const x = baseX + Math.sin(progress * Math.PI * 2 * swayFreq + phase) * swayAmp;

  const twinkle = interpolate(
    Math.sin(frame / (10 + swayFreq * 6) + phase),
    [-1, 1],
    [0.15, 0.85],
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: theme.goldSoft,
        opacity: twinkle,
        boxShadow: `0 0 ${size * 2}px ${theme.gold}`,
      }}
    />
  );
};

export const Particles: React.FC = () => {
  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <Particle key={i} index={i} />
      ))}
    </>
  );
};

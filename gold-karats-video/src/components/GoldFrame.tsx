import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

const ARM = 46;
const THICKNESS = 2;
const INSET = 26;
const STAGGER = 5;
const DRAW_DURATION = 24;

type Corner = {
  key: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  delay: number;
};

const CORNERS: Corner[] = [
  { key: "tl", top: INSET, left: INSET, delay: 0 },
  { key: "tr", top: INSET, right: INSET, delay: STAGGER },
  { key: "bl", bottom: INSET, left: INSET, delay: STAGGER * 2 },
  { key: "br", bottom: INSET, right: INSET, delay: STAGGER * 3 },
];

export const GoldFrame: React.FC = () => {
  const frame = useCurrentFrame();

  const pulse = interpolate(Math.sin(frame / 45), [-1, 1], [0.65, 0.95]);

  return (
    <AbsoluteFill name="GoldFrame" style={{ pointerEvents: "none" }}>
      {CORNERS.map(({ key, top, bottom, left, right, delay }) => {
        const len = interpolate(frame, [delay, delay + DRAW_DURATION], [0, ARM], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const edgeH: React.CSSProperties =
          right !== undefined ? { right: 0 } : { left: 0 };
        const edgeV: React.CSSProperties =
          bottom !== undefined ? { bottom: 0 } : { top: 0 };

        return (
          <div
            key={key}
            style={{ position: "absolute", top, bottom, left, right }}
          >
            <div
              style={{
                position: "absolute",
                ...edgeH,
                width: len,
                height: THICKNESS,
                background: theme.goldGradient,
                opacity: pulse,
              }}
            />
            <div
              style={{
                position: "absolute",
                ...edgeV,
                width: THICKNESS,
                height: len,
                background: theme.goldGradient,
                opacity: pulse,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

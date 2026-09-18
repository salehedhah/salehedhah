import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";

const ARM = 46;
const THICKNESS = 2;
const INSET = 26;

const cornerStyle = (
  vertical: React.CSSProperties,
  horizontal: React.CSSProperties,
): React.CSSProperties => ({
  position: "absolute",
  ...vertical,
  ...horizontal,
});

export const GoldFrame: React.FC = () => {
  const line = (props: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    background: theme.goldGradient,
    opacity: 0.75,
    ...props,
  });

  return (
    <AbsoluteFill name="GoldFrame" style={{ pointerEvents: "none" }}>
      {/* top-left */}
      <div style={cornerStyle({ top: INSET }, { left: INSET })}>
        <div style={line({ width: ARM, height: THICKNESS })} />
        <div style={line({ width: THICKNESS, height: ARM })} />
      </div>
      {/* top-right */}
      <div style={cornerStyle({ top: INSET }, { right: INSET })}>
        <div style={line({ width: ARM, height: THICKNESS, right: 0 })} />
        <div style={line({ width: THICKNESS, height: ARM, right: 0 })} />
      </div>
      {/* bottom-left */}
      <div style={cornerStyle({ bottom: INSET }, { left: INSET })}>
        <div style={line({ width: ARM, height: THICKNESS, bottom: 0 })} />
        <div style={line({ width: THICKNESS, height: ARM, bottom: 0 })} />
      </div>
      {/* bottom-right */}
      <div style={cornerStyle({ bottom: INSET }, { right: INSET })}>
        <div style={line({ width: ARM, height: THICKNESS, right: 0, bottom: 0 })} />
        <div style={line({ width: THICKNESS, height: ARM, right: 0, bottom: 0 })} />
      </div>
    </AbsoluteFill>
  );
};

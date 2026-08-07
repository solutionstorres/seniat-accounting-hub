import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { ModuleScene } from "./scenes/ModuleScene";
import { COLORS, SECTIONS } from "./theme";
import { body } from "./fonts";

export const SCENE_LEN = 62;
export const INTRO_LEN = 140;
export const OUTRO_LEN = 150;
export const TOTAL = INTRO_LEN + SECTIONS.length * SCENE_LEN + OUTRO_LEN;

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = interpolate(frame, [0, durationInFrames], [0, 100]);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: "rgba(255,255,255,0.08)" }}>
      <div style={{ width: `${w}%`, height: "100%", background: COLORS.accent }} />
    </div>
  );
};

const Watermark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: 44,
      top: 36,
      fontFamily: body,
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: 4,
      color: "rgba(243,247,255,0.5)",
    }}
  >
    CONTAVE
  </div>
);

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Series>
      <Series.Sequence durationInFrames={INTRO_LEN}>
        <Intro />
      </Series.Sequence>
      {SECTIONS.map((s, i) => (
        <Series.Sequence key={s.shot} durationInFrames={SCENE_LEN}>
          <ModuleScene section={s} index={i} />
        </Series.Sequence>
      ))}
      <Series.Sequence durationInFrames={OUTRO_LEN}>
        <Outro />
      </Series.Sequence>
    </Series>
    <Watermark />
    <ProgressBar />
  </AbsoluteFill>
);

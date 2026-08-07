import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { display, body } from "../fonts";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(s, [0, 1], [70, 0]);
  const sub = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  const line = interpolate(spring({ frame: frame - 8, fps, config: { damping: 200 } }), [0, 1], [0, 620]);
  const tag = spring({ frame: frame - 28, fps, config: { damping: 18, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 150, paddingRight: 150 }}>
      <div
        style={{
          fontFamily: body,
          color: COLORS.accent,
          letterSpacing: 10,
          fontSize: 34,
          fontWeight: 600,
          opacity: s,
          transform: `translateY(${y / 2}px)`,
        }}
      >
        SISTEMA CONTABLE VENEZOLANO
      </div>
      <div
        style={{
          fontFamily: display,
          color: COLORS.text,
          fontSize: 190,
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 18,
          opacity: s,
          transform: `translateY(${y}px)`,
        }}
      >
        ContaVE
      </div>
      <div style={{ height: 8, width: line, background: COLORS.accent, marginTop: 34, borderRadius: 8 }} />
      <div
        style={{
          fontFamily: body,
          color: COLORS.muted,
          fontSize: 52,
          marginTop: 34,
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [40, 0])}px)`,
        }}
      >
        Video tutorial · Recorrido por todos los módulos
      </div>
      <div
        style={{
          marginTop: 46,
          alignSelf: "flex-start",
          padding: "18px 38px",
          borderRadius: 999,
          border: `2px solid ${COLORS.primary}`,
          background: "rgba(29,111,224,0.18)",
          color: COLORS.text,
          fontFamily: body,
          fontSize: 38,
          fontWeight: 600,
          transform: `scale(${interpolate(tag, [0, 1], [0.7, 1])})`,
          opacity: tag,
        }}
      >
        Conforme a la normativa del SENIAT
      </div>
    </AbsoluteFill>
  );
};

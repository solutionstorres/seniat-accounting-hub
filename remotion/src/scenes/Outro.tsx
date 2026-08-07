import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { display, body } from "../fonts";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const s2 = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: 140 }}>
      <div
        style={{
          fontFamily: display,
          color: COLORS.text,
          fontSize: 130,
          fontWeight: 700,
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
        }}
      >
        Todo tu ciclo contable
      </div>
      <div style={{ height: 8, width: interpolate(s, [0, 1], [0, 520]), background: COLORS.accent, marginTop: 30, borderRadius: 8 }} />
      <div
        style={{
          fontFamily: body,
          color: COLORS.muted,
          fontSize: 50,
          marginTop: 40,
          maxWidth: 1300,
          lineHeight: 1.35,
          opacity: s2,
        }}
      >
        Facturación, libros fiscales, retenciones, tesorería multimoneda e informes, en un solo sistema.
      </div>
      <div
        style={{
          marginTop: 56,
          padding: "20px 46px",
          borderRadius: 999,
          background: COLORS.accent,
          color: "#10243F",
          fontFamily: body,
          fontWeight: 700,
          fontSize: 40,
          opacity: s2,
        }}
      >
        ContaVE · Sección Ayuda
      </div>
    </AbsoluteFill>
  );
};

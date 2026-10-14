import { useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";

import type { CalcResult, WallInput } from "../calc";
import { fmt } from "../calc";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";

export function WallDiagram({ wall, result }: { wall: WallInput; result: CalcResult }) {
  const styles = useStyles();
  const [w, setW] = useState(0);
  const scale = w / Math.max(wall.length, 1);
  const rowH = Math.max(12, Math.min(26, (result.courseHeight * scale)));
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const courses = [...result.courses].reverse();

  return (
    <View testID="wall-diagram" style={styles.wrap} onLayout={onLayout}>
      {w > 0 &&
        courses.map((c) => (
          <View key={c.index} style={[styles.row, { height: rowH }]}>
            {c.segments.flat().map((p, i) => (
              <View
                key={i}
                style={[
                  styles.piece,
                  { left: p.start * scale, width: Math.max(p.len * scale, 1) },
                  p.isCut && styles.cut,
                ]}
              >
                {p.isCut && p.len * scale > 22 && rowH >= 14 && (
                  <Text numberOfLines={1} style={styles.label}>
                    {fmt(p.cutLen)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  row: { position: "relative", width: "100%" },
  piece: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderWidth: 0.5,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cut: { backgroundColor: c.brandTertiary },
  label: { fontFamily: fonts.mono, fontSize: 9, color: c.onBrandTertiary },
}));

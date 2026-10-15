import { useState } from "react";
import { LayoutChangeEvent, ScrollView, Text, View } from "react-native";

import type { CalcResult, WallInput } from "../calc";
import { cutLabel, fmt, pieceKey } from "../calc";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";

const MIN_SCALE = 1.6; // px per cm, so every cut label fits (scroll sideways on long walls)
const GUTTER = 44; // left column with course heights (like the height table)

export function WallDiagram({ wall, result, selected }: { wall: WallInput; result: CalcResult; selected?: string | null }) {
  const styles = useStyles();
  const [w, setW] = useState(0);
  const scale = Math.max(w / Math.max(wall.length, 1), MIN_SCALE);
  const innerW = wall.length * scale;
  const baseH = Math.max(22, Math.min(30, result.courseHeight * scale));
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const rowHs = result.courses.map((c) => Math.max(18, (baseH * c.height) / result.courseHeight));
  const courses = [...result.courses].reverse();
  const totalH = rowHs.reduce((n, h) => n + h, 0);
  // cm from the bottom -> px from the bottom (course rows have their own drawing heights)
  const yToPx = (y: number) => {
    let px = 0;
    for (let i = 0; i < result.courses.length; i++) {
      const c = result.courses[i];
      if (y <= c.bottom + c.height + 0.01 || i === result.courses.length - 1) {
        return px + (rowHs[i] * Math.min(Math.max(y - c.bottom, 0), c.height)) / Math.max(c.height, 0.1);
      }
      px += rowHs[i];
    }
    return px;
  };

  return (
    <View testID="wall-diagram" style={styles.outer}>
      <Text testID="diagram-height" style={styles.dimText}>
        ↕ {fmt(wall.height)} cm
      </Text>
      <View style={styles.wrap}>
        <View style={{ width: GUTTER }}>
          {courses.map((c) => (
            <View key={c.index} style={[styles.gutterRow, { height: rowHs[c.index - 1] }]}>
              <Text style={[styles.gutterText, Math.abs(c.bottom + c.height - result.layHeight) < 0.05 && styles.gutterLay]}>
                {fmt(c.bottom + c.height)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.flex} onLayout={onLayout}>
          {w > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={innerW > w} scrollEnabled={innerW > w + 1}>
              <View style={{ width: innerW, height: totalH }}>
                {courses.map((c) => {
                  const rowH = rowHs[c.index - 1];
                  return (
                    <View key={c.index} style={[styles.row, { height: rowH }]}>
                      {c.segments.flat().map((p, i) => (
                        <View
                          key={i}
                          testID={p.isCut ? `diagram-cut-${c.index}-${i}` : undefined}
                          style={[
                            styles.piece,
                            { left: p.start * scale, width: Math.max(p.len * scale, 1) },
                            p.h !== null && c.isTop === false && { top: Math.min(rowH * (1 - Math.min(1, p.h / c.brickHeight)), rowH - 16) },
                            p.h !== null && c.isTop && p.h < c.brickHeight && { top: Math.min(rowH * (1 - p.h / c.brickHeight), rowH - 16) },
                            p.isCut && styles.cut,
                            p.brick && styles.brick,
                            c.isKim && !p.isCut && styles.kim,
                            p.isCut && selected === pieceKey(p) && styles.cutOn,
                          ]}
                        >
                          {p.brick && (
                            <Text numberOfLines={1} style={styles.label}>
                              cegły {c.full} × {p.from}
                            </Text>
                          )}
                          {p.isCut && (
                            <Text numberOfLines={1} style={[styles.label, selected === pieceKey(p) && styles.labelOn]}>
                              {cutLabel(p)}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  );
                })}
                {wall.openings.map((o, i) => {
                  const bottom = yToPx(o.y);
                  const top = yToPx(Math.min(o.y + o.height, wall.height));
                  return (
                    <View
                      key={`o${i}`}
                      testID={`diagram-opening-${i}`}
                      pointerEvents="none"
                      style={[styles.opening, { left: o.x * scale, width: Math.max(o.width * scale, 2), bottom, height: Math.max(top - bottom, 2) }]}
                    >
                      <Text numberOfLines={1} style={styles.openText}>
                        {fmt(o.width)}×{fmt(o.height)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
      <Text testID="diagram-length" style={styles.dimText}>
        ← {fmt(wall.length)} cm →{wall.openings.length ? `   wycięcia: ${wall.openings.map((o) => `${fmt(o.width)}×${fmt(o.height)} (od lewej ${fmt(o.x)}, od dołu ${fmt(o.y)})`).join(", ")}` : ""}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  outer: { gap: 4 },
  wrap: { flexDirection: "row", borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  flex: { flex: 1 },
  gutterRow: { justifyContent: "flex-start", borderBottomWidth: 0.5, borderColor: c.divider, backgroundColor: c.surface, paddingLeft: 2 },
  gutterText: { fontFamily: fonts.mono, fontSize: 9, color: c.muted },
  gutterLay: { color: c.brandSecondary, fontFamily: fonts.display },
  dimText: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface },
  opening: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: c.error,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  openText: { fontFamily: fonts.mono, fontSize: 9, color: c.error },
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
  brick: { backgroundColor: c.surfaceSecondary, borderStyle: "dashed" },
  kim: { backgroundColor: c.info },
  cutOn: { backgroundColor: c.brandPrimary },
  labelOn: { color: c.onBrandPrimary },
  label: { fontFamily: fonts.mono, fontSize: 9, color: c.onBrandTertiary },
}));

import { useState } from "react";
import { LayoutChangeEvent, ScrollView, Text, View } from "react-native";

import type { CalcResult, WallInput } from "../calc";
import { cutLabel } from "../calc";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";

const MIN_SCALE = 1.6; // px per cm, so every cut label fits (scroll sideways on long walls)

export function WallDiagram({ wall, result }: { wall: WallInput; result: CalcResult }) {
  const styles = useStyles();
  const [w, setW] = useState(0);
  const scale = Math.max(w / Math.max(wall.length, 1), MIN_SCALE);
  const innerW = wall.length * scale;
  const baseH = Math.max(22, Math.min(30, result.courseHeight * scale));
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const courses = [...result.courses].reverse();

  return (
    <View testID="wall-diagram" style={styles.wrap} onLayout={onLayout}>
      {w > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={innerW > w} scrollEnabled={innerW > w + 1}>
          <View style={{ width: innerW }}>
            {courses.map((c) => {
              const rowH = Math.max(18, (baseH * c.height) / result.courseHeight);
              return (
                <View key={c.index} style={[styles.row, { height: rowH }]}>
                  {c.segments.flat().map((p, i) => (
                    <View
                      key={i}
                      testID={p.isCut ? `diagram-cut-${c.index}-${i}` : undefined}
                      style={[
                        styles.piece,
                        { left: p.start * scale, width: Math.max(p.len * scale, 1) },
                        p.h !== null && c.isTop === false && { top: rowH * (1 - Math.min(1, p.h / c.brickHeight)) },
                        p.h !== null && c.isTop && p.h < c.brickHeight && { top: rowH * (1 - p.h / c.brickHeight) },
                        p.isCut && styles.cut,
                      ]}
                    >
                      {p.isCut && (
                        <Text numberOfLines={1} style={styles.label}>
                          {cutLabel(p)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
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

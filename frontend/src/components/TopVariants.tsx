import { Pressable, ScrollView, Text, View } from "react-native";

import type { CalcResult } from "../calc";
import { cutsWord, fmt } from "../calc";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";

// Row of top-finish variants with their cut counts; the chosen one is dark, the best one is marked
export function TopVariants({ result, onPick, testID }: { result: CalcResult; onPick?: (key: string) => void; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>GÓRA ŚCIANY — WARIANT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {result.variants.map((v) => {
          const on = v.key === result.variant;
          const best = v.key === result.bestVariant;
          return (
            <Pressable
              key={v.key}
              testID={`${testID}-${v.key.replace(":", "-")}`}
              disabled={!onPick}
              onPress={() => onPick?.(v.key)}
              style={[styles.opt, on && styles.on]}
            >
              <Text style={[styles.label, on && styles.textOn]}>{v.label}</Text>
              <Text style={[styles.cuts, on && styles.textOn]}>
                {v.cuts} {cutsWord(v.cuts)}
              </Text>
              <Text style={[styles.cuts, on && styles.textOn]}>muruj na {fmt(v.lay)}</Text>
              {best && <Text style={styles.badge}>NAJMNIEJ CIĘĆ</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: 6 },
  title: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface },
  row: { gap: 8 },
  opt: {
    flexShrink: 0,
    minHeight: 64,
    minWidth: 112,
    borderWidth: 2,
    borderColor: c.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  on: { backgroundColor: c.surfaceInverse },
  label: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  cuts: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface },
  textOn: { color: c.onSurfaceInverse },
  badge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: c.onBrandPrimary,
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
}));

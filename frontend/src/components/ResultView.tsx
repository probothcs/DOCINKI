import { Text, View } from "react-native";

import type { CalcResult, Settings, WallInput } from "../calc";
import { fmt } from "../calc";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";
import { SectionTitle } from "./ui";
import { WallDiagram } from "./WallDiagram";

export function ResultView({ wall, result, settings }: { wall: WallInput; result: CalcResult; settings: Settings }) {
  const styles = useStyles();
  return (
    <View style={styles.gap}>
      <View style={styles.header}>
        <Text testID="result-wall-name" style={styles.title}>
          {wall.name ? `ŚCIANA ${wall.name}` : "ŚCIANA"}
        </Text>
        <Text testID="result-wall-dims" style={styles.dims}>
          {fmt(wall.length)} × {fmt(wall.height)} × {fmt(wall.thickness)} cm
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="WARSTWY" value={String(result.courseCount)} testID="stat-courses" />
        <Stat label="PEŁNE" value={String(result.totalFull)} testID="stat-full" />
        <Stat label="DOCINKI" value={String(result.totalCuts)} testID="stat-cuts" accent />
      </View>

      <View testID="result-params" style={styles.params}>
        <Text style={styles.paramText}>Moduł bloczka: {fmt(result.module)} cm (tol. {settings.tolerance100}/100)</Text>
        <Text style={styles.paramText}>Wysokość warstwy: {result.courseHeight.toLocaleString("pl-PL")} cm</Text>
        <Text style={styles.paramText}>Luz: {fmt(settings.luz)} cm · Min. kawałek: {fmt(settings.minPiece)} cm</Text>
      </View>
      {result.heightWarning && (
        <View testID="height-warning" style={styles.warn}>
          <Text style={styles.warnText}>
            UWAGA: wysokość warstwy odbiega od {settings.blockHeight} cm o więcej niż 2,5%. Sprawdź wysokość ściany.
          </Text>
        </View>
      )}

      <WallDiagram wall={wall} result={result} />

      <SectionTitle>Zestawienie cięć</SectionTitle>
      {result.cutGroups.length === 0 ? (
        <View style={styles.okBox} testID="no-cuts">
          <Text style={styles.okText}>IDEALNIE DOPASOWANE — BRAK DOCINEK</Text>
        </View>
      ) : (
        <View style={styles.table}>
          {result.cutGroups.map((g) => (
            <View key={g.len} style={styles.groupRow} testID={`cut-group-${g.len}`}>
              <Text style={styles.groupLen}>{fmt(g.len)} cm</Text>
              <Text style={styles.groupCount}>× {g.count}</Text>
            </View>
          ))}
        </View>
      )}

      <SectionTitle>Warstwy (od dołu)</SectionTitle>
      <View style={styles.table}>
        {result.courses.map((c) => (
          <View key={c.index} style={styles.courseRow} testID={`course-row-${c.index}`}>
            <View style={styles.courseLeft}>
              <Text style={styles.courseNo}>W{c.index}</Text>
              <Text style={styles.courseSub}>{c.startsHalf ? "od ½" : "od pełnego"}</Text>
            </View>
            <View style={styles.courseMid}>
              <Text style={styles.courseFull}>{c.full} pełnych</Text>
              <Text style={styles.seq} numberOfLines={3}>
                {c.segments.map((seg) => seg.map((p) => (p.isCut ? `[${fmt(p.cutLen)}]` : "■")).join(" ")).join("  |  ")}
              </Text>
            </View>
            <Text style={styles.courseCuts}>{c.cuts.length ? c.cuts.map(fmt).join(" / ") : "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Stat({ label, value, testID, accent }: { label: string; value: string; testID: string; accent?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.stat, accent && styles.statAccent]}>
      <Text testID={testID} style={[styles.statValue, accent && styles.statValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, accent && styles.statValueAccent]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  gap: { gap: 16 },
  header: { gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface },
  dims: { fontFamily: fonts.mono, fontSize: 18, color: c.onSurface },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 2, borderColor: c.border, padding: 12, backgroundColor: c.surface },
  statAccent: { backgroundColor: c.brandPrimary },
  statValue: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface },
  statValueAccent: { color: c.onBrandPrimary },
  statLabel: { fontFamily: fonts.mono, fontSize: 11, color: c.onSurface },
  params: { gap: 2, backgroundColor: c.surfaceSecondary, padding: 12, borderWidth: 2, borderColor: c.border },
  paramText: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceSecondary },
  warn: { backgroundColor: c.warning, padding: 12, borderWidth: 2, borderColor: c.border },
  warnText: { fontFamily: fonts.mono, fontSize: 12, color: c.onWarning },
  okBox: { backgroundColor: c.success, padding: 16, borderWidth: 2, borderColor: c.border },
  okText: { fontFamily: fonts.display, fontSize: 16, color: c.onSuccess },
  table: { borderWidth: 2, borderColor: c.border },
  groupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  groupLen: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  groupCount: { fontFamily: fonts.mono, fontSize: 20, color: c.brandSecondary },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  courseLeft: { width: 64 },
  courseNo: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface },
  courseSub: { fontFamily: fonts.mono, fontSize: 10, color: c.muted },
  courseMid: { flex: 1, gap: 2 },
  courseFull: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface },
  seq: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
  courseCuts: { fontFamily: fonts.display, fontSize: 18, color: c.brandSecondary, maxWidth: 120, textAlign: "right" },
}));

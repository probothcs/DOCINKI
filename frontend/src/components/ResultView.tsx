import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import type { CalcResult, CutGroup, Settings, WallInput } from "../calc";
import { cutLabel, cutLocations, fmt, groupKey } from "../calc";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";
import { SectionTitle } from "./ui";
import { WallDiagram } from "./WallDiagram";

export function ResultView({
  wall,
  result,
  settings,
  selected,
  onSelect,
}: {
  wall: WallInput;
  result: CalcResult;
  settings: Settings;
  selected?: string | null;
  onSelect?: (key: string) => void;
}) {
  const styles = useStyles();
  const locations = useMemo(() => {
    const m = cutLocations(result);
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.join(", ")]));
  }, [result]);
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
        <Text testID="result-height-plan" style={styles.paramText}>
          Wysokość: {result.courseCount} × {fmt(result.courseHeight)} = {fmt(result.stackHeight)} cm
          {result.topBrick !== null
            ? ` + zaprawa ${fmt(settings.mortar)} + ${result.topIsCut ? "docinka wys." : "cegła"} ${fmt(result.topBrick)} = ${fmt(wall.height)} cm`
            : ""}
        </Text>
        {result.topBrick !== null && !result.topIsCut && (
          <Text style={styles.paramText}>
            Góra: {result.topFull} × cegła {fmt(result.topBrick)} (pełne)
          </Text>
        )}
        <Text style={styles.paramText}>Luz: {fmt(settings.luz)} cm · Min. kawałek: {fmt(settings.minPiece)} cm</Text>
      </View>
      {result.heightWarning && (
        <View testID="height-warning" style={styles.warn}>
          <Text style={styles.warnText}>
            UWAGA: nie da się dobrać warstw z zakresu {fmt(settings.minModule)}–{fmt(settings.maxModule)} cm i cegieł{" "}
            {settings.topBricks.join("/")}. Górną warstwę trzeba dociąć na wysokość.
          </Text>
        </View>
      )}

      <WallDiagram wall={wall} result={result} selected={selected} />

      <SectionTitle>Zestawienie cięć</SectionTitle>
      {result.cutGroups.length === 0 ? (
        <View style={styles.okBox} testID="no-cuts">
          <Text style={styles.okText}>IDEALNIE DOPASOWANE — BRAK DOCINEK</Text>
        </View>
      ) : (
        <>
          <Text style={styles.hintTap}>Dotknij docinkę, aby zobaczyć gdzie jest na rysunku</Text>
          <View style={styles.table}>
            <CutGroupsList
              groups={result.cutGroups}
              blockLength={settings.blockLength}
              prefix="cut-group-"
              selected={selected}
              onSelect={onSelect}
              locations={locations}
            />
          </View>
        </>
      )}

      <SectionTitle>Warstwy (od dołu)</SectionTitle>
      <View style={styles.table}>
        {result.courses.map((c) => (
          <View key={c.index} style={styles.courseRow} testID={`course-row-${c.index}`}>
            <View style={styles.courseLeft}>
              <Text style={styles.courseNo}>{c.isTop ? "GÓRA" : `W${c.index}`}</Text>
              <Text style={styles.courseSub}>{c.startsHalf ? "od ½" : "od pełnego"}</Text>
            </View>
            <View style={styles.courseMid}>
              <Text style={styles.courseFull}>
                {c.full} pełnych{c.isTop ? ` · cegła ${fmt(c.brickHeight)}` : ""}
              </Text>
              <Text style={styles.seq} numberOfLines={3}>
                {c.segments.map((seg) => seg.map((p) => (p.isCut ? `[${cutLabel(p)}]` : "■")).join(" ")).join("  |  ")}
              </Text>
            </View>
            <Text style={styles.courseCuts}>{c.cuts.length ? c.cuts.map(cutLabel).join(" / ") : "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CutGroupsList({
  groups,
  blockLength,
  prefix,
  selected,
  onSelect,
  locations,
}: {
  groups: CutGroup[];
  blockLength: number;
  prefix: string;
  selected?: string | null;
  onSelect?: (key: string) => void;
  locations?: Record<string, string>;
}) {
  const styles = useStyles();
  return (
    <View style={styles.listBg}>
      {groups.map((g) => {
        const key = groupKey(g);
        const on = selected === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect?.(key)}
            style={[styles.groupRow, on && styles.groupRowOn]}
            testID={`${prefix}${g.h !== null ? `${g.len}x${g.h}` : g.len}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupLen, on && styles.onSel]}>{cutLabel(g)} cm</Text>
              <Text style={[styles.courseSub, on && styles.onSel]}>
                {g.h !== null ? "dł. × wys. · " : ""}z bloczka {fmt(blockLength)}×{fmt(g.from)}
              </Text>
              {!!locations?.[key] && (
                <Text style={[styles.loc, on && styles.onSel]} numberOfLines={3}>
                  Gdzie: {locations[key]}
                </Text>
              )}
            </View>
            <Text style={[styles.groupCount, on && styles.onSel]}>× {g.count}</Text>
          </Pressable>
        );
      })}
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
  listBg: { backgroundColor: c.surface },
  groupRowOn: { backgroundColor: c.brandPrimary },
  onSel: { color: c.onBrandPrimary },
  loc: { fontFamily: fonts.mono, fontSize: 11, color: c.onSurfaceSecondary, marginTop: 2 },
  hintTap: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: -8 },
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

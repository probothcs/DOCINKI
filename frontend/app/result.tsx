import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { calculate, cutLocations, mergeGroups, normalizeSettings } from "@/src/calc";
import { AddWallActions } from "@/src/components/AddWallActions";
import { CutGroupsList, ResultView } from "@/src/components/ResultView";
import { useToast } from "@/src/components/toast";
import { Button } from "@/src/components/ui";
import { fonts } from "@/src/fonts";
import {
  addDrafts,
  Draft,
  getBatchMeta,
  isValidDraft,
  loadBatch,
  removeDraft,
  setBatchProject,
  setEditIndex,
  updateDraft,
  useDrafts,
  useSettings,
} from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

export default function ResultScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id, add } = useLocalSearchParams<{ id?: string; add?: string }>();
  const settings = useSettings();
  const [saving, setSaving] = useState(false);
  const saved = useQuery({ queryKey: ["wall", id], queryFn: () => api.getWall(id!), enabled: !!id });

  const drafts = useDrafts();
  const draftItems = useMemo(
    () =>
      id
        ? []
        : drafts
            .map((d, i) => ({ d, i }))
            .filter(({ d }) => isValidDraft(d))
            .map(({ d, i }) => ({ d, i, r: calculate(d, settings) })),
    [id, drafts, settings],
  );
  const total = useMemo(() => {
    const rs = draftItems.map((x) => x.r);
    return {
      groups: mergeGroups(rs),
      full: rs.reduce((n, r) => n + r.totalFull, 0),
      cuts: rs.reduce((n, r) => n + r.totalCuts, 0),
      top: rs.reduce((n, r) => n + r.topFull, 0),
      // finishing bricks needed on top, per brick height
      bricks: Object.entries(
        rs.reduce<Record<string, number>>((m, r) => {
          if (r.topKind === "brick" && r.topBrick !== null && r.topFull) m[r.topBrick] = (m[r.topBrick] ?? 0) + r.topFull;
          return m;
        }, {}),
      ),
      halves: rs.reduce((n, r) => n + (r.halfTop ? r.topFull : 0), 0),
      kimFull: rs.reduce((n, r) => n + r.kimFull, 0),
      kimCuts: rs.reduce((n, r) => n + r.kimCuts, 0),
      cutCount: rs.reduce((n, r) => n + r.cutCount, 0),
    };
  }, [draftItems]);
  const [projectName, setProjectName] = useState(getBatchMeta().project);
  const defaultName = draftItems[0]?.d.name
    ? `${draftItems[0].d.name}${draftItems.length > 1 ? "…" : ""}`
    : `Projekt ${new Date().toLocaleDateString("pl-PL")}`;
  const [adding, setAdding] = useState(add === "1");
  const [selected, setSelected] = useState<string | null>(null);
  const toggleSel = (k: string) => setSelected((cur) => (cur === k ? null : k));
  const totalLocations = useMemo(() => {
    const m: Record<string, string[]> = {};
    draftItems.forEach(({ r }, n) =>
      Object.entries(cutLocations(r)).forEach(([k, v]) => (m[k] ??= []).push(`Ś${n + 1}: ${v.join(", ")}`)),
    );
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.join(" · ")]));
  }, [draftItems]);
  // saved walls are recalculated with their own saved settings (keeps old records in the current format)
  const savedSettings = useMemo(() => (saved.data ? normalizeSettings(saved.data.settings) : null), [saved.data]);
  const savedResult = useMemo(
    () => (saved.data && savedSettings ? calculate(saved.data, savedSettings) : null),
    [saved.data, savedSettings],
  );

  const save = async () => {
    if (!draftItems.length) return;
    setSaving(true);
    try {
      const count = draftItems.length;
      const word = count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "ściany" : "ścian";
      const meta = getBatchMeta();
      const project = projectName.trim() || defaultName;
      setBatchProject(project);
      for (const { d, r } of draftItems) {
        const { notes: _n, savedId: _s, failed: _f, ...wall } = d;
        await api.saveWall({
          ...wall,
          kimlaga: d.kimlaga ?? settings.defaultKimlaga,
          allowBrick: d.allowBrick ?? settings.defaultAllowBrick,
          topVariant: r.variant,
          project,
          settings,
          result: r,
        });
      }
      // replace previously saved versions of these walls
      const old = [...draftItems.map((x) => x.d.savedId).filter((x): x is string => !!x), ...meta.pendingDeletes];
      await Promise.all(old.map((oid) => api.deleteWall(oid).catch(() => null)));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await qc.invalidateQueries({ queryKey: ["walls"] });
      toast(count > 1 ? `Zapisano projekt: ${count} ${word}` : "Projekt zapisany");
      router.replace("/(tabs)/history");
    } catch {
      toast("Nie udało się zapisać", "error");
    } finally {
      setSaving(false);
    }
  };

  const onAdd = (ds: Draft[]) => {
    setAdding(false);
    addDrafts(ds);
    if (ds.length > 1) router.push({ pathname: "/review", params: { from: "result" } });
    else router.push({ pathname: "/edit", params: { from: "result" } });
  };

  const editDraft = (i: number) => {
    setEditIndex(i);
    router.push({ pathname: "/edit", params: { from: "result" } });
  };

  const remove = async () => {
    if (!id) return;
    try {
      await api.deleteWall(id);
      qc.invalidateQueries({ queryKey: ["walls"] });
      toast("Usunięto");
      router.back();
    } catch {
      toast("Nie udało się usunąć", "error");
    }
  };

  const editAgain = () => {
    if (!saved.data) return;
    const { name, length, height, thickness, openings, photo_path, topVariant, kimlaga, allowBrick } = saved.data;
    loadBatch(
      [{ name, length, height, thickness, openings, photo_path, topVariant, kimlaga: kimlaga ?? false, allowBrick: allowBrick ?? true, savedId: saved.data.id }],
      saved.data.project ?? "",
    );
    router.push("/edit");
  };

  // open this wall (and the rest of its project) as an editable batch to add more walls
  const openBatch = async () => {
    const cur = saved.data;
    if (!cur) return;
    let walls = [cur];
    if (cur.project) {
      try {
        walls = (await api.listWalls()).filter((w) => w.project === cur.project).reverse();
      } catch {}
    }
    loadBatch(
      walls.map((w) => ({
        name: w.name,
        length: w.length,
        height: w.height,
        thickness: w.thickness,
        openings: w.openings,
        savedId: w.id,
        photo_path: w.photo_path,
        topVariant: w.topVariant,
        kimlaga: w.kimlaga ?? false,
        allowBrick: w.allowBrick ?? true,
      })),
      cur.project ?? "",
    );
    router.replace({ pathname: "/result", params: { add: "1" } });
  };

  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="result-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>WYNIK</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 }]}>
        {id ? (
          saved.isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : saved.data && savedResult && savedSettings ? (
            <ResultView wall={saved.data} result={savedResult} settings={savedSettings} selected={selected} onSelect={toggleSel} photo={saved.data.photo_path} />
          ) : (
            <Text testID="result-error" style={styles.err}>BŁĄD: nie znaleziono ściany</Text>
          )
        ) : draftItems.length === 0 ? (
          <Text testID="no-walls" style={styles.err}>Brak ścian — dodaj ścianę poniżej</Text>
        ) : (
          <View style={styles.gap}>
            <View style={styles.nameBox}>
              <Text style={styles.nameLabel}>NAZWA PROJEKTU</Text>
              <TextInput
                testID="project-name-input"
                value={projectName}
                onChangeText={setProjectName}
                placeholder={defaultName}
                placeholderTextColor={colors.muted}
                style={styles.nameInput}
              />
            </View>
            {draftItems.length > 1 && (
              <View testID="project-total" style={styles.totalBox}>
                <Text style={styles.totalTitle}>
                  RAZEM: {draftItems.length} {draftItems.length >= 5 ? "ŚCIAN" : "ŚCIANY"}
                </Text>
                <Text testID="project-total-stats" style={styles.totalSub}>
                  {total.full} pełnych bloczków · {total.cuts} docinek · razem {total.cutCount} cięć
                </Text>
                {total.kimFull + total.kimCuts > 0 && (
                  <Text testID="total-kimlaga" style={styles.totalBricks}>
                    Kimlaga: {total.kimFull} pełnych + {total.kimCuts} docinek
                  </Text>
                )}
                {total.bricks.map(([h, n]) => (
                  <Text key={h} testID={`total-bricks-${h}`} style={styles.totalBricks}>
                    Cegły na górę: {n} × cegła {settings.topBrickLength}×{h}
                  </Text>
                ))}
                {total.halves > 0 && (
                  <Text testID="total-halves" style={styles.totalBricks}>
                    Połówki na górę: {total.halves} × {settings.blockLength}×{settings.blockHeight / 2} (z {Math.ceil(total.halves / 2)} bloczków)
                  </Text>
                )}
                <Text style={styles.totalSub}>Dotknij docinkę — podświetlę ją na rysunkach wszystkich ścian</Text>
                <CutGroupsList
                  groups={total.groups}
                  blockLength={settings.blockLength}
                  blockHeight={settings.blockHeight}
                  prefix="total-cut-group-"
                  selected={selected}
                  onSelect={toggleSel}
                  locations={totalLocations}
                />
              </View>
            )}
            {draftItems.map(({ d, r, i }, n) => (
              <View key={i} style={styles.gap} testID={`draft-wall-${n}`}>
                {draftItems.length > 1 && (
                  <View style={styles.wallBar}>
                    <Text style={styles.wallBarText}>
                      ŚCIANA {n + 1}/{draftItems.length}
                    </Text>
                    <View style={styles.row}>
                      <Pressable testID={`draft-edit-${n}`} hitSlop={8} style={styles.iconBtn} onPress={() => editDraft(i)}>
                        <Ionicons name="create" size={24} color={colors.onSurfaceInverse} />
                      </Pressable>
                      <Pressable testID={`draft-remove-${n}`} hitSlop={8} style={styles.iconBtn} onPress={() => removeDraft(i)}>
                        <Ionicons name="trash" size={24} color={colors.onSurfaceInverse} />
                      </Pressable>
                    </View>
                  </View>
                )}
                <ResultView
                  wall={d}
                  result={r}
                  settings={settings}
                  selected={selected}
                  onSelect={toggleSel}
                  photo={d.photo_path}
                  index={n}
                  onPickVariant={(k) => updateDraft(i, { topVariant: k })}
                />
                {draftItems.length === 1 && (
                  <Button testID="draft-edit-0" variant="outline" icon="create" label="Popraw wymiary" onPress={() => editDraft(i)} />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 16 }]}>
        {id ? (
          confirmDel ? (
            <View style={styles.row}>
              <Button testID="confirm-delete-button" variant="danger" label="Usuń" style={{ flex: 1 }} onPress={remove} />
              <Button testID="cancel-delete-button" variant="outline" label="Anuluj" style={{ flex: 1 }} onPress={() => setConfirmDel(false)} />
            </View>
          ) : (
            <View style={styles.gap}>
              <Button testID="saved-add-wall-button" variant="outline" icon="add" label="Dodaj ścianę do projektu" onPress={openBatch} />
              <View style={styles.row}>
                <Button testID="recalculate-button" icon="create" label="Edytuj" style={{ flex: 1 }} onPress={editAgain} />
                <Button testID="delete-wall-button" variant="outline" icon="trash" label="Usuń" style={{ flex: 1 }} onPress={() => setConfirmDel(true)} />
              </View>
            </View>
          )
        ) : (
          <View style={styles.gap}>
            {adding && <AddWallActions compact onReady={onAdd} />}
            <View style={styles.row}>
              <Button
                testID="add-wall-button"
                variant="outline"
                icon={adding ? "close" : "add"}
                label={adding ? "Anuluj" : "Dodaj ścianę"}
                style={{ flex: 1 }}
                onPress={() => setAdding((v) => !v)}
              />
              <Button
                testID="save-wall-button"
                icon="save"
                label="Zapisz projekt"
                loading={saving}
                disabled={!draftItems.length}
                style={{ flex: 1 }}
                onPress={save}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: c.border,
  },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 22, color: c.onSurface },
  content: { padding: 16 },
  err: { fontFamily: fonts.mono, color: c.error },
  row: { flexDirection: "row", gap: 12 },
  gap: { gap: 16 },
  totalBox: { borderWidth: 2, borderColor: c.border, padding: 12, gap: 8, backgroundColor: c.brandTertiary },
  totalBricks: { fontFamily: fonts.display, fontSize: 16, color: c.onBrandTertiary },
  nameBox: { gap: 4 },
  nameLabel: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface },
  nameInput: {
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    minHeight: 56,
    paddingHorizontal: 12,
    fontFamily: fonts.mono,
    fontSize: 18,
    color: c.onSurface,
  },
  totalTitle: { fontFamily: fonts.display, fontSize: 24, color: c.onBrandTertiary },
  totalSub: { fontFamily: fonts.mono, fontSize: 13, color: c.onBrandTertiary },
  wallBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: c.surfaceInverse,
    paddingLeft: 12,
    minHeight: 52,
    marginTop: 8,
  },
  wallBarText: { fontFamily: fonts.display, fontSize: 18, color: c.onSurfaceInverse },
  iconBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.border },
}));

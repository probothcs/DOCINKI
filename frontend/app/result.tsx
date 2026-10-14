import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { calculate, normalizeSettings } from "@/src/calc";
import { ResultView } from "@/src/components/ResultView";
import { useToast } from "@/src/components/toast";
import { Button } from "@/src/components/ui";
import { fonts } from "@/src/fonts";
import { getDraft, setDraft, useSettings } from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

export default function ResultScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const settings = useSettings();
  const [saving, setSaving] = useState(false);
  const saved = useQuery({ queryKey: ["wall", id], queryFn: () => api.getWall(id!), enabled: !!id });

  const draft = getDraft();
  const draftResult = useMemo(() => (id ? null : calculate(draft, settings)), [id, draft, settings]);
  // saved walls are recalculated with their own saved settings (keeps old records in the current format)
  const savedSettings = useMemo(() => (saved.data ? normalizeSettings(saved.data.settings) : null), [saved.data]);
  const savedResult = useMemo(
    () => (saved.data && savedSettings ? calculate(saved.data, savedSettings) : null),
    [saved.data, savedSettings],
  );

  const save = async () => {
    if (!draftResult) return;
    setSaving(true);
    try {
      const { notes: _n, ...wall } = draft;
      const w = await api.saveWall({ ...wall, settings, result: draftResult });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["walls"] });
      toast("Ściana zapisana");
      router.replace({ pathname: "/result", params: { id: w.id } });
    } catch {
      toast("Nie udało się zapisać", "error");
    } finally {
      setSaving(false);
    }
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
    const { name, length, height, thickness, openings } = saved.data;
    setDraft({ name, length, height, thickness, openings });
    router.push("/edit");
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
            <ResultView wall={saved.data} result={savedResult} settings={savedSettings} />
          ) : (
            <Text testID="result-error" style={styles.err}>BŁĄD: nie znaleziono ściany</Text>
          )
        ) : (
          draftResult && <ResultView wall={draft} result={draftResult} settings={settings} />
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
            <View style={styles.row}>
              <Button testID="recalculate-button" icon="create" label="Edytuj" style={{ flex: 1 }} onPress={editAgain} />
              <Button testID="delete-wall-button" variant="outline" icon="trash" label="Usuń" style={{ flex: 1 }} onPress={() => setConfirmDel(true)} />
            </View>
          )
        ) : (
          <Button testID="save-wall-button" icon="save" label="Zapisz" loading={saving} onPress={save} />
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
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.border },
}));

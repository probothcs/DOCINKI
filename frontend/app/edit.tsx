import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoThumb } from "@/src/components/PhotoThumb";
import { KimlagaToggle } from "@/src/components/KimlagaToggle";
import { useToast } from "@/src/components/toast";
import { Button, Field, SectionTitle, toNum, toStr } from "@/src/components/ui";
import { fonts } from "@/src/fonts";
import { getDraft, setDraft, useSettings } from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

type OpenStr = { x: string; y: string; width: string; height: string };

export default function EditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const d = getDraft();
  const [name, setName] = useState(d.name);
  const [length, setLength] = useState(toStr(d.length));
  const [height, setHeight] = useState(toStr(d.height));
  const [thickness, setThickness] = useState(toStr(d.thickness));
  const settings = useSettings();
  const [kimlaga, setKimlaga] = useState(d.kimlaga ?? settings.defaultKimlaga);
  const [allowBrick, setAllowBrick] = useState(d.allowBrick ?? settings.defaultAllowBrick);
  const [openings, setOpenings] = useState<OpenStr[]>(
    d.openings.map((o) => ({ x: toStr(o.x) || "0", y: toStr(o.y) || "0", width: toStr(o.width), height: toStr(o.height) })),
  );

  const updOpen = (i: number, k: keyof OpenStr) => (t: string) =>
    setOpenings((p) => p.map((o, j) => (j === i ? { ...o, [k]: t } : o)));

  const calc = () => {
    const L = toNum(length);
    const H = toNum(height);
    if (L <= 0 || H <= 0) {
      toast("Podaj długość i wysokość ściany", "error");
      return;
    }
    setDraft({
      ...d,
      name: name.trim(),
      length: L,
      height: H,
      thickness: toNum(thickness),
      failed: false,
      kimlaga,
      allowBrick,
      // dimensions changed: let the app pick the top variant with the fewest cuts again
      topVariant: undefined,
      openings: openings
        .map((o) => ({ x: toNum(o.x), y: toNum(o.y), width: toNum(o.width), height: toNum(o.height) }))
        .filter((o) => o.width > 0 && o.height > 0),
    });
    if (from === "result" || from === "review") router.back();
    else router.replace("/result");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="edit-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>WYMIARY ŚCIANY</Text>
      </View>
      <KeyboardAwareScrollView bottomOffset={96} contentContainerStyle={styles.content}>
        {!!d.photo_path && (
          <View style={styles.photoRow}>
            <PhotoThumb path={d.photo_path} size={96} testID="edit-photo" />
            <Text style={styles.hint}>Dotknij zdjęcie, aby porównać z wymiarami</Text>
          </View>
        )}
        {!!d.notes && (
          <View testID="ai-notes" style={styles.notes}>
            <Text style={styles.notesTitle}>ODCZYT AI — SPRAWDŹ</Text>
            <Text style={styles.notesText}>{d.notes}</Text>
          </View>
        )}
        <Field testID="edit-name" label="Nr elementu" keyboardType="default" value={name} onChangeText={setName} />
        <View style={styles.row}>
          <Field testID="edit-length" label="Długość" suffix="cm" value={length} onChangeText={setLength} />
          <Field testID="edit-height" label="Wysokość" suffix="cm" value={height} onChangeText={setHeight} />
        </View>
        <Button
          testID="edit-swap-dims"
          variant="outline"
          icon="swap-vertical"
          label="Zamień długość ↔ wysokość"
          onPress={() => {
            setLength(height);
            setHeight(length);
          }}
        />
        <Text style={styles.hint}>Wysokość = kierunek murowania (od kimlagi w górę), np. 268</Text>
        <Field testID="edit-thickness" label="Grubość" suffix="cm" value={thickness} onChangeText={setThickness} />
        <KimlagaToggle testID="edit-kimlaga" value={kimlaga} onChange={setKimlaga} />
        <KimlagaToggle testID="edit-allow-brick" label="Cegła na górę (9 / 14 / 19)" value={allowBrick} onChange={setAllowBrick} />
        <Text style={styles.hint}>
          {kimlaga
            ? `1. warstwa z kimlagi ${settings.kimlagaHeight} cm, wyżej warstwy z tabeli. `
            : ""}
          Góra (na wymiar / cegła / połówka / cięta) — wybiorę wariant z najmniejszą liczbą cięć
        </Text>

        <SectionTitle>Otwory / wycięcia</SectionTitle>
        <Text style={styles.hint}>Wycięcie w górnym rogu: od lewej 0, od dołu 259, szer. 17, wys. 7 (ściana 266)</Text>
        {openings.map((o, i) => (
          <View key={i} style={styles.openBox} testID={`opening-${i}`}>
            <View style={styles.openHead}>
              <Text style={styles.openTitle}>OTWÓR {i + 1}</Text>
              <Pressable testID={`opening-remove-${i}`} hitSlop={12} onPress={() => setOpenings((p) => p.filter((_, j) => j !== i))}>
                <Ionicons name="trash" size={24} color={colors.error} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <Field testID={`opening-${i}-x`} label="Od lewej" suffix="cm" value={o.x} onChangeText={updOpen(i, "x")} />
              <Field testID={`opening-${i}-y`} label="Od dołu" suffix="cm" value={o.y} onChangeText={updOpen(i, "y")} />
            </View>
            <View style={styles.row}>
              <Field testID={`opening-${i}-width`} label="Szerokość" suffix="cm" value={o.width} onChangeText={updOpen(i, "width")} />
              <Field testID={`opening-${i}-height`} label="Wysokość" suffix="cm" value={o.height} onChangeText={updOpen(i, "height")} />
            </View>
          </View>
        ))}
        <Button
          testID="add-opening-button"
          variant="outline"
          icon="add"
          label="Dodaj otwór"
          onPress={() => setOpenings((p) => [...p, { x: "0", y: "0", width: "", height: "" }])}
        />
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.sticky, { paddingBottom: insets.bottom + 16 }]}>
          <Button testID="calculate-button" label="Oblicz docinki" icon="calculator" onPress={calc} />
        </View>
      </KeyboardStickyView>
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
  content: { padding: 16, gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: -8 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  notes: { backgroundColor: c.brandTertiary, borderWidth: 2, borderColor: c.border, padding: 12, gap: 4 },
  notesTitle: { fontFamily: fonts.display, fontSize: 14, color: c.onBrandTertiary },
  notesText: { fontFamily: fonts.mono, fontSize: 12, color: c.onBrandTertiary },
  openBox: { borderWidth: 2, borderColor: c.border, padding: 12, gap: 12, backgroundColor: c.surface },
  openHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  openTitle: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.border },
}));

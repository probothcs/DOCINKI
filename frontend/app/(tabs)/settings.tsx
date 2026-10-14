import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEFAULT_SETTINGS, fmt, Settings } from "@/src/calc";
import { useToast } from "@/src/components/toast";
import { Button, Field, toNum, toStr } from "@/src/components/ui";
import { fonts } from "@/src/fonts";
import { usesNativeTabs } from "@/src/navigation";
import { saveSettings, useSettings } from "@/src/store";
import { makeStyles } from "@/src/theme";

const toForm = (v: Settings) => ({
  blockLength: toStr(v.blockLength),
  blockHeight: toStr(v.blockHeight),
  mortar: toStr(v.mortar) || "0",
  minModule: toStr(v.minModule),
  maxModule: toStr(v.maxModule),
  topBricks: v.topBricks.join(", "),
  tolerance100: toStr(v.tolerance100),
  luz: toStr(v.luz) || "0",
  minPiece: toStr(v.minPiece) || "0",
});

export default function SettingsScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const toast = useToast();
  const s = useSettings();
  const [f, setF] = useState(toForm(s));

  useEffect(() => {
    setF(toForm(s));
  }, [s]);

  const set = (k: keyof typeof f) => (t: string) => setF((p) => ({ ...p, [k]: t }));
  const module = (toNum(f.blockLength) * toNum(f.tolerance100)) / 100;

  const save = async () => {
    const next = {
      blockLength: toNum(f.blockLength),
      blockHeight: toNum(f.blockHeight),
      mortar: toNum(f.mortar),
      minModule: toNum(f.minModule),
      maxModule: toNum(f.maxModule),
      topBricks: f.topBricks
        .split(/[,;\s]+/)
        .map(toNum)
        .filter((n) => n > 0),
      tolerance100: toNum(f.tolerance100),
      luz: toNum(f.luz),
      minPiece: toNum(f.minPiece),
      firstCourseHalf: false,
    };
    if (next.blockLength <= 0 || next.blockHeight <= 0 || next.tolerance100 <= 0) {
      toast("Wymiary bloczka i tolerancja muszą być > 0", "error");
      return;
    }
    if (next.minModule <= 0 || next.maxModule < next.minModule) {
      toast("Warstwa min/max: min > 0 i max ≥ min", "error");
      return;
    }
    await saveSettings(next);
    toast("Ustawienia zapisane");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>USTAWIENIA</Text>
      </View>
      <KeyboardAwareScrollView bottomOffset={96} contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Field testID="settings-block-length" label="Długość bloczka" suffix="cm" value={f.blockLength} onChangeText={set("blockLength")} />
          <Field testID="settings-block-height" label="Wysokość cegły" suffix="cm" value={f.blockHeight} onChangeText={set("blockHeight")} />
        </View>
        <Field testID="settings-mortar" label="Zaprawa (spoina)" suffix="cm" value={f.mortar} onChangeText={set("mortar")} />
        <View style={styles.row}>
          <Field testID="settings-min-module" label="Warstwa min" suffix="cm" value={f.minModule} onChangeText={set("minModule")} />
          <Field testID="settings-max-module" label="Warstwa max" suffix="cm" value={f.maxModule} onChangeText={set("maxModule")} />
        </View>
        <Text style={styles.hintText}>Zakres z kartki z wysokościami (np. 24,4–25,1). 266 → 10 × 25,1 = 251 + zaprawa 1 + cegła 14</Text>
        <Field
          testID="settings-top-bricks"
          label="Cegły na górę (wysokości)"
          keyboardType="default"
          value={f.topBricks}
          onChangeText={set("topBricks")}
          hint="Oddziel przecinkiem, np. 9, 14, 19"
        />
        <Field
          testID="settings-tolerance"
          label="Tolerancja: 100 cm bloczków ="
          suffix="cm"
          value={f.tolerance100}
          onChangeText={set("tolerance100")}
          hint={`Np. 2 bloczki na 100 cm dają 98 → wpisz 98. Moduł: ${fmt(module)} cm`}
        />
        <Field
          testID="settings-luz"
          label="Luz (odejmowany od docinki)"
          suffix="cm"
          value={f.luz}
          onChangeText={set("luz")}
          hint="Np. luka 20 cm, luz 1 → docinka 19 cm"
        />
        <Field
          testID="settings-min-piece"
          label="Min. kawałek docinki"
          suffix="cm"
          value={f.minPiece}
          onChangeText={set("minPiece")}
          hint="Mniejszy kawałek na końcu → dzielę ostatnie dwa na pół"
        />
        <View testID="settings-bond-info" style={styles.info}>
          <Text style={styles.label}>
            Wiązanie: 1. warstwa od pełnego, co druga warstwa od połówki ({fmt(toNum(f.blockLength) / 2)} cm)
          </Text>
        </View>
        <Pressable testID="settings-reset" onPress={() => saveSettings(DEFAULT_SETTINGS)} style={styles.reset}>
          <Text style={styles.resetText}>Przywróć domyślne (50 × 24, zaprawa 1, tol. 100, luz 1)</Text>
        </Pressable>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ opened: bottomChrome }}>
        <View style={[styles.sticky, { paddingBottom: bottomChrome + 16 }]}>
          <Button testID="settings-save-button" label="Zapisz ustawienia" icon="save" onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.border },
  title: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface },
  content: { padding: 16, gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  label: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface },
  hintText: { fontFamily: fonts.mono, fontSize: 11, color: c.muted, marginTop: -8 },
  info: { borderWidth: 2, borderColor: c.border, padding: 12, backgroundColor: c.surfaceSecondary },
  reset: { minHeight: 48, justifyContent: "center" },
  resetText: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, textDecorationLine: "underline" },
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.border },
}));

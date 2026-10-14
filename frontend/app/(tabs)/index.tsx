import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fmt } from "@/src/calc";
import { useToast } from "@/src/components/toast";
import { Button } from "@/src/components/ui";
import { fonts } from "@/src/fonts";
import { usesNativeTabs } from "@/src/navigation";
import { setDraft } from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

export default function NewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [camBlocked, setCamBlocked] = useState(false);
  const [camAsk, setCamAsk] = useState(false);
  const recent = useQuery({ queryKey: ["walls"], queryFn: api.listWalls });

  const analyze = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    setBusy(true);
    try {
      const r = await api.analyze(asset.base64);
      setDraft({
        name: r.name,
        length: r.length ?? 0,
        height: r.height ?? 0,
        thickness: r.thickness ?? 14,
        openings: r.openings,
        notes: r.notes,
      });
      router.push("/edit");
    } catch {
      toast("Nie udało się odczytać rysunku. Wpisz wymiary ręcznie.", "error");
      setDraft({ name: "", length: 0, height: 0, thickness: 14, openings: [] });
      router.push("/edit");
    } finally {
      setBusy(false);
    }
  };

  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.5 };

  const openCamera = async () => {
    const res = await ImagePicker.launchCameraAsync(opts);
    if (!res.canceled) analyze(res.assets[0]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.getCameraPermissionsAsync();
    if (perm.granted) return openCamera();
    if (!perm.canAskAgain) return setCamBlocked(true);
    setCamAsk(true);
  };

  const confirmCamera = async () => {
    setCamAsk(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.granted) return openCamera();
    if (!perm.canAskAgain) setCamBlocked(true);
    else toast("Bez aparatu możesz wybrać zdjęcie z galerii.", "error");
  };

  const pickGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) analyze(res.assets[0]);
  };

  const manual = () => {
    setDraft({ name: "", length: 0, height: 0, thickness: 14, openings: [] });
    router.push("/edit");
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: bottomChrome + 24 }]}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={styles.brand}>DOCINKI PRO</Text>
          <Text style={styles.sub}>Zdjęcie rysunku → docinki na każdą warstwę</Text>
        </Animated.View>

        {busy ? (
          <View testID="analyzing-indicator" style={styles.busy}>
            <Ionicons name="scan" size={48} color={colors.onSurfaceInverse} />
            <Text style={styles.busyText}>ANALIZA AI TRWA...</Text>
            <Text style={styles.busySub}>Odczytuję wymiary z rysunku</Text>
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.actions}>
            <Button testID="scan-drawing-button" big icon="camera" label="Skanuj rysunek" onPress={takePhoto} />
            <Button testID="pick-gallery-button" variant="outline" icon="images" label="Z galerii" onPress={pickGallery} />
            <Button testID="manual-entry-button" variant="outline" icon="create" label="Wprowadź ręcznie" onPress={manual} />
          </Animated.View>
        )}

        {camAsk && (
          <View testID="camera-permission-explainer" style={styles.permBox}>
            <Text style={styles.permText}>Aparat jest potrzebny, aby zrobić zdjęcie rysunku ściany i od razu policzyć docinki.</Text>
            <Button testID="camera-permission-allow" label="Zezwól na aparat" onPress={confirmCamera} />
            <Button testID="camera-permission-cancel" variant="outline" label="Anuluj" onPress={() => setCamAsk(false)} />
          </View>
        )}
        {camBlocked && (
          <View testID="camera-blocked-box" style={styles.permBox}>
            <Text style={styles.permText}>Dostęp do aparatu jest zablokowany. Włącz go w ustawieniach albo wybierz zdjęcie z galerii.</Text>
            <Button testID="open-settings-button" label="Otwórz ustawienia" onPress={() => Linking.openSettings()} />
          </View>
        )}

        <Text style={styles.section}>OSTATNIE</Text>
        {recent.isLoading ? (
          <Text style={styles.muted}>ŁADOWANIE...</Text>
        ) : !recent.data?.length ? (
          <Text testID="recent-empty" style={styles.muted}>BRAK HISTORII</Text>
        ) : (
          recent.data.slice(0, 3).map((w) => (
            <Pressable
              key={w.id}
              testID={`recent-wall-${w.id}`}
              onPress={() => router.push({ pathname: "/result", params: { id: w.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{w.name || "Ściana"}</Text>
                <Text style={styles.cardSub}>
                  {fmt(w.length)} × {fmt(w.height)} cm · {w.result.totalCuts} docinek
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.onSurface} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 16, gap: 16 },
  brand: { fontFamily: fonts.display, fontSize: 36, color: c.onSurface, letterSpacing: 1 },
  sub: { fontFamily: fonts.mono, fontSize: 13, color: c.muted },
  actions: { gap: 12 },
  busy: {
    minHeight: 220,
    backgroundColor: c.surfaceInverse,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  busyText: { fontFamily: fonts.display, fontSize: 24, color: c.onSurfaceInverse },
  busySub: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceInverse },
  permBox: { borderWidth: 2, borderColor: c.border, padding: 16, gap: 12, backgroundColor: c.surfaceSecondary },
  permText: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface },
  section: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface, marginTop: 8, letterSpacing: 1 },
  muted: { fontFamily: fonts.mono, fontSize: 14, color: c.muted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: c.border,
    padding: 16,
    minHeight: 64,
    backgroundColor: c.surface,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  cardSub: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
}));

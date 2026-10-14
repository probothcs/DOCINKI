import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Linking, Text, View } from "react-native";

import { api } from "../api";
import { fonts } from "../fonts";
import { Draft, EMPTY_DRAFT } from "../store";
import { makeStyles, useTheme } from "../theme";
import { useToast } from "./toast";
import { Button } from "./ui";

const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.5 };

// Photo (camera / gallery → AI) or manual entry; hands back a draft wall
export function AddWallActions({ onReady, compact }: { onReady: (d: Draft) => void; compact?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [camBlocked, setCamBlocked] = useState(false);
  const [camAsk, setCamAsk] = useState(false);

  const analyze = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    setBusy(true);
    try {
      const r = await api.analyze(asset.base64);
      onReady({
        name: r.name,
        length: r.length ?? 0,
        height: r.height ?? 0,
        thickness: r.thickness ?? 14,
        openings: r.openings,
        notes: r.notes,
      });
    } catch {
      toast("Nie udało się odczytać rysunku. Wpisz wymiary ręcznie.", "error");
      onReady({ ...EMPTY_DRAFT });
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <View style={styles.gap}>
      {busy ? (
        <View testID="analyzing-indicator" style={[styles.busy, compact && styles.busyCompact]}>
          <Ionicons name="scan" size={compact ? 28 : 48} color={colors.onSurfaceInverse} />
          <Text style={styles.busyText}>ANALIZA AI TRWA...</Text>
          {!compact && <Text style={styles.busySub}>Odczytuję wymiary z rysunku</Text>}
        </View>
      ) : compact ? (
        <View style={styles.row}>
          <Button testID="add-scan-button" icon="camera" label="Foto" style={styles.flex} onPress={takePhoto} />
          <Button testID="add-gallery-button" variant="outline" icon="images" label="Galeria" style={styles.flex} onPress={pickGallery} />
          <Button testID="add-manual-button" variant="outline" icon="create" label="Ręcznie" style={styles.flex} onPress={() => onReady({ ...EMPTY_DRAFT })} />
        </View>
      ) : (
        <View style={styles.gap}>
          <Button testID="scan-drawing-button" big icon="camera" label="Skanuj rysunek" onPress={takePhoto} />
          <Button testID="pick-gallery-button" variant="outline" icon="images" label="Z galerii" onPress={pickGallery} />
          <Button testID="manual-entry-button" variant="outline" icon="create" label="Wprowadź ręcznie" onPress={() => onReady({ ...EMPTY_DRAFT })} />
        </View>
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
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  gap: { gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1, paddingHorizontal: 4, gap: 6 },
  busy: {
    minHeight: 220,
    backgroundColor: c.surfaceInverse,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  busyCompact: { minHeight: 60, flexDirection: "row" },
  busyText: { fontFamily: fonts.display, fontSize: 20, color: c.onSurfaceInverse },
  busySub: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceInverse },
  permBox: { borderWidth: 2, borderColor: c.border, padding: 16, gap: 12, backgroundColor: c.surfaceSecondary },
  permText: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface },
}));

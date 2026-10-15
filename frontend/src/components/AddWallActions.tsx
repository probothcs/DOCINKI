import Ionicons from "@react-native-vector-icons/ionicons";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Linking, Text, View } from "react-native";

import { explainAnalyzeError, MISSING_DIMS } from "../analyze-error";
import { api } from "../api";
import { fonts } from "../fonts";
import { Draft, EMPTY_DRAFT, isValidDraft } from "../store";
import { makeStyles, useTheme } from "../theme";
import { useToast } from "./toast";
import { Button } from "./ui";

const camOpts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
const galOpts: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.8,
  allowsMultipleSelection: true,
  selectionLimit: 20,
};

// shrink the photo before sending (saves transfer and AI time)
async function toBase64(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if ((asset.width ?? 0) > 1600) ctx.resize({ width: 1600 });
    const img = await ctx.renderAsync();
    const res = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    return res.base64 ?? null;
  } catch {
    return asset.base64 ?? null;
  }
}

// Photos (camera / gallery, many at once → AI one by one) or manual entry; hands back draft walls
export function AddWallActions({ onReady, compact }: { onReady: (d: Draft[]) => void; compact?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);
  const busy = progress !== null;
  const [camBlocked, setCamBlocked] = useState(false);
  const [camAsk, setCamAsk] = useState(false);

  const analyzeAll = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const out: Draft[] = [];
    const reasons: string[] = [];
    for (let i = 0; i < assets.length; i++) {
      setProgress({ i: i + 1, n: assets.length });
      try {
        const b64 = await toBase64(assets[i]);
        if (!b64) throw new Error("no image");
        const r = await api.analyze(b64);
        const d: Draft = {
          name: r.name,
          length: r.length ?? 0,
          height: r.height ?? 0,
          thickness: r.thickness ?? 14,
          openings: r.openings,
          notes: r.notes,
          photo_path: r.photo_path,
          ...(r.kimlaga ? { kimlaga: true } : {}),
        };
        if (!isValidDraft(d)) {
          d.failed = true;
          d.notes = d.notes ? `${d.notes} ${MISSING_DIMS}` : MISSING_DIMS;
          reasons.push(MISSING_DIMS);
        }
        out.push(d);
      } catch (error) {
        const reason = explainAnalyzeError(error);
        reasons.push(reason);
        out.push({ ...EMPTY_DRAFT, failed: true, notes: `Zdjęcie ${i + 1}: ${reason}` });
      }
    }
    setProgress(null);
    if (reasons.length) {
      const unique = [...new Set(reasons)];
      const message = unique.length === 1 ? unique[0] : `${reasons.length} z ${assets.length} bez wymiarów. ${unique[0]}`;
      toast(message, "error");
    }
    onReady(out);
  };

  const openCamera = async () => {
    const res = await ImagePicker.launchCameraAsync(camOpts);
    if (!res.canceled) analyzeAll(res.assets.slice(0, 1));
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
    else toast("Bez aparatu możesz wybrać zdjęcia z galerii.", "error");
  };

  const pickGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync(galOpts);
    if (!res.canceled && res.assets.length) analyzeAll(res.assets);
  };

  return (
    <View style={styles.gap}>
      {busy ? (
        <View testID="analyzing-indicator" style={[styles.busy, compact && styles.busyCompact]}>
          <Ionicons name="scan" size={compact ? 28 : 48} color={colors.onSurfaceInverse} />
          <Text testID="analyze-progress" style={styles.busyText}>
            {progress && progress.n > 1 ? `ODCZYTUJĘ ${progress.i} Z ${progress.n}…` : "ANALIZA AI TRWA..."}
          </Text>
          {progress && progress.n > 1 && (
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${(progress.i / progress.n) * 100}%` }]} />
            </View>
          )}
          {!compact && <Text style={styles.busySub}>Odczytuję wymiary z rysunku</Text>}
        </View>
      ) : compact ? (
        <View style={styles.row}>
          <Button testID="add-scan-button" icon="camera" label="Foto" style={styles.flex} onPress={takePhoto} />
          <Button testID="add-gallery-button" variant="outline" icon="images" label="Galeria" style={styles.flex} onPress={pickGallery} />
          <Button testID="add-manual-button" variant="outline" icon="create" label="Ręcznie" style={styles.flex} onPress={() => onReady([{ ...EMPTY_DRAFT }])} />
        </View>
      ) : (
        <View style={styles.gap}>
          <Button testID="scan-drawing-button" big icon="camera" label="Skanuj rysunek" onPress={takePhoto} />
          <Button testID="pick-gallery-button" variant="outline" icon="images" label="Z galerii (kilka zdjęć)" onPress={pickGallery} />
          <Button testID="manual-entry-button" variant="outline" icon="create" label="Wprowadź ręcznie" onPress={() => onReady([{ ...EMPTY_DRAFT }])} />
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
  busyCompact: { minHeight: 60, flexDirection: "row", flexWrap: "wrap", paddingVertical: 8 },
  bar: { width: "80%", height: 16, borderWidth: 2, borderColor: c.onSurfaceInverse },
  barFill: { height: "100%", backgroundColor: c.brandPrimary },
  busyText: { fontFamily: fonts.display, fontSize: 20, color: c.onSurfaceInverse },
  busySub: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceInverse },
  permBox: { borderWidth: 2, borderColor: c.border, padding: 16, gap: 12, backgroundColor: c.surfaceSecondary },
  permText: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface },
}));

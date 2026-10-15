import * as Linking from "expo-linking";
import { useState } from "react";
import { Platform, Text } from "react-native";

import { currentAppVersion } from "../app-version";
import { fonts } from "../fonts";
import { makeStyles } from "../theme";
import { checkForUpdate } from "../update-app";
import { useToast } from "./toast";
import { Button } from "./ui";

export function UpdateButton() {
  const toast = useToast();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const href = typeof window === "undefined" ? "app://local" : window.location.href;
      const result = await checkForUpdate({
        embeddedSha: process.env.EXPO_PUBLIC_GIT_SHA ?? "",
        embeddedVersion: currentAppVersion(),
        href,
      });
      toast(result.message, result.kind === "toast" && result.error ? "error" : "ok");
      if (result.kind !== "reload") return;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.replace(result.href);
        return;
      }
      await Linking.openURL(result.href);
    } catch {
      toast("Nie udało się sprawdzić aktualizacji", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text testID="app-version" style={styles.version}>
        Wersja {currentAppVersion()}
      </Text>
      <Button testID="update-app-button" variant="outline" icon="refresh" label="Aktualizuj" loading={busy} onPress={onPress} />
      <Text style={styles.hint}>Aktualizuj sprawdza, czy ta wersja jest najnowsza. Nowszy numer pobierze się sam.</Text>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  version: { fontFamily: fonts.display, fontSize: 22, color: c.onSurface, letterSpacing: 1 },
  hint: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
}));

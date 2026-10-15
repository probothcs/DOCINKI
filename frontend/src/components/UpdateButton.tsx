import * as Linking from "expo-linking";
import { useState } from "react";
import { Platform, Text } from "react-native";

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
      <Button testID="update-app-button" variant="outline" icon="refresh" label="Aktualizuj" loading={busy} onPress={onPress} />
      <Text style={styles.hint}>Po wysłaniu zmian na GitHuba kliknij Aktualizuj.</Text>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  hint: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
}));

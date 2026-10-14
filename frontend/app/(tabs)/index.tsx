import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fmt } from "@/src/calc";
import { AddWallActions } from "@/src/components/AddWallActions";
import { fonts } from "@/src/fonts";
import { usesNativeTabs } from "@/src/navigation";
import { Draft, startNewBatch } from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

export default function NewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const recent = useQuery({ queryKey: ["walls"], queryFn: api.listWalls });

  const onReady = (d: Draft) => {
    startNewBatch(d);
    router.push("/edit");
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: bottomChrome + 24 }]}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={styles.brand}>DOCINKI PRO</Text>
          <Text style={styles.sub}>Zdjęcie rysunku → docinki na każdą warstwę. Po wyniku możesz dodać kolejne ściany.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <AddWallActions onReady={onReady} />
        </Animated.View>

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
                  {w.project ? `${w.project} · ` : ""}
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

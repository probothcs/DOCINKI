import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fmt } from "@/src/calc";
import { fonts } from "@/src/fonts";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function HistoryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const q = useQuery({ queryKey: ["walls"], queryFn: api.listWalls });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>HISTORIA</Text>
      </View>
      <FlatList
        testID="history-list"
        data={q.data ?? []}
        keyExtractor={(w) => w.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={
          q.isLoading ? (
            <Text style={styles.muted}>ŁADOWANIE...</Text>
          ) : q.isError ? (
            <Text testID="history-error" style={styles.err}>BŁĄD POBIERANIA</Text>
          ) : (
            <View testID="history-empty" style={styles.empty}>
              <Ionicons name="document-outline" size={56} color={colors.muted} />
              <Text style={styles.emptyText}>HISTORIA PUSTA</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`history-item-${item.id}`}
            onPress={() => router.push({ pathname: "/result", params: { id: item.id } })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.name || "Ściana"}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString("pl-PL")}</Text>
            </View>
            <Text style={styles.cardSub}>
              {fmt(item.length)} × {fmt(item.height)} × {fmt(item.thickness)} cm
            </Text>
            <Text style={styles.cardSub}>
              {item.result.courseCount} warstw · {item.result.totalFull} pełnych · {item.result.totalCuts} docinek
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.border },
  title: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface },
  list: { padding: 16, gap: 12 },
  muted: { fontFamily: fonts.mono, color: c.muted },
  err: { fontFamily: fonts.mono, color: c.error },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontFamily: fonts.display, fontSize: 20, color: c.muted },
  card: { borderWidth: 2, borderColor: c.border, padding: 16, minHeight: 64, gap: 4, backgroundColor: c.surface },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface },
  date: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
  cardSub: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurfaceSecondary },
}));

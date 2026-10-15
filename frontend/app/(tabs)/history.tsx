import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { groupProjects, Project, ProjectCard } from "@/src/components/ProjectCard";
import { useToast } from "@/src/components/toast";
import { fonts } from "@/src/fonts";
import { usesNativeTabs } from "@/src/navigation";
import { loadBatch } from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

export default function HistoryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const q = useQuery({ queryKey: ["walls"], queryFn: api.listWalls });
  const qc = useQueryClient();
  const toast = useToast();
  const projects = useMemo(() => groupProjects(q.data ?? []), [q.data]);

  const open = (p: Project) => {
    // oldest first = order in which walls were added
    const walls = [...p.walls].sort((a, z) => a.created_at.localeCompare(z.created_at));
    loadBatch(
      walls.map((w) => ({
        name: w.name,
        length: w.length,
        height: w.height,
        thickness: w.thickness,
        openings: w.openings,
        savedId: w.id,
        photo_path: w.photo_path,
        topVariant: w.topVariant,
        kimlaga: w.kimlaga ?? false,
        allowBrick: w.allowBrick ?? true,
      })),
      p.walls[0].project ?? "",
    );
    router.push("/result");
  };

  const rename = async (p: Project, name: string) => {
    try {
      await api.renameProject(p.walls.map((w) => w.id), name);
      await qc.invalidateQueries({ queryKey: ["walls"] });
      toast("Nazwa zmieniona");
    } catch {
      toast("Nie udało się zmienić nazwy", "error");
    }
  };

  const remove = async (p: Project) => {
    try {
      await Promise.all(p.walls.map((w) => api.deleteWall(w.id)));
      await qc.invalidateQueries({ queryKey: ["walls"] });
      toast("Projekt usunięty");
    } catch {
      toast("Nie udało się usunąć", "error");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>HISTORIA</Text>
      </View>
      <FlatList
        testID="history-list"
        data={projects}
        keyExtractor={(p) => p.key}
        contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
        keyboardShouldPersistTaps="handled"
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
        renderItem={({ item, index }) => (
          <ProjectCard
            project={item}
            index={index}
            onOpen={() => open(item)}
            onRename={(name) => rename(item, name)}
            onDelete={() => remove(item)}
          />
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
}));

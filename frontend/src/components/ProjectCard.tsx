import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { SavedWall } from "../api";
import { fonts } from "../fonts";
import { makeStyles, useTheme } from "../theme";
import { PhotoThumb } from "./PhotoThumb";
import { Button } from "./ui";

export type Project = { key: string; name: string; date: string; walls: SavedWall[] };

// Group saved walls into projects; walls without a project become a one-wall project
export function groupProjects(walls: SavedWall[]): Project[] {
  const map = new Map<string, Project>();
  for (const w of walls) {
    const key = w.project ? `p:${w.project}` : `w:${w.id}`;
    const p = map.get(key);
    if (p) {
      p.walls.push(w);
      if (w.created_at > p.date) p.date = w.created_at;
    } else map.set(key, { key, name: w.project || w.name || "Ściana", date: w.created_at, walls: [w] });
  }
  return [...map.values()].sort((a, z) => z.date.localeCompare(a.date));
}

type Props = {
  project: Project;
  index: number;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

export function ProjectCard({ project, index, onOpen, onRename, onDelete }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(project.name);
  const cuts = project.walls.reduce((n, w) => n + (w.result?.totalCuts ?? 0), 0);
  const photos = project.walls.map((w) => w.photo_path).filter((p): p is string => !!p);
  const count = project.walls.length;
  const word = count === 1 ? "ściana" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "ściany" : "ścian";

  return (
    <View testID={`project-card-${index}`} style={styles.card}>
      <Pressable testID={`project-open-${index}`} onPress={onOpen} style={({ pressed }) => [styles.body, pressed && { opacity: 0.7 }]}>
        <View style={styles.row}>
          <Text testID={`project-name-${index}`} style={styles.title} numberOfLines={2}>
            {project.name}
          </Text>
          <Text style={styles.date}>{new Date(project.date).toLocaleDateString("pl-PL")}</Text>
        </View>
        <Text testID={`project-stats-${index}`} style={styles.sub}>
          {count} {word} · {cuts} docinek
        </Text>
      </Pressable>
      {photos.length > 0 && (
        <View style={styles.thumbs}>
          {photos.slice(0, 5).map((p, i) => (
            <PhotoThumb key={p} path={p} size={56} testID={`project-thumb-${index}-${i}`} />
          ))}
          {photos.length > 5 && <Text style={styles.more}>+{photos.length - 5}</Text>}
        </View>
      )}
      {renaming ? (
        <View style={styles.gap}>
          <TextInput
            testID={`project-rename-input-${index}`}
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Nazwa projektu"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <View style={styles.row2}>
            <Button
              testID={`project-rename-save-${index}`}
              label="Zapisz"
              style={styles.flex}
              onPress={() => {
                if (name.trim()) onRename(name.trim());
                setRenaming(false);
              }}
            />
            <Button testID={`project-rename-cancel-${index}`} variant="outline" label="Anuluj" style={styles.flex} onPress={() => setRenaming(false)} />
          </View>
        </View>
      ) : confirm ? (
        <View style={styles.row2}>
          <Button testID={`project-delete-confirm-${index}`} variant="danger" label="Usuń projekt" style={styles.flex} onPress={onDelete} />
          <Button testID={`project-delete-cancel-${index}`} variant="outline" label="Anuluj" style={styles.flex} onPress={() => setConfirm(false)} />
        </View>
      ) : (
        <View style={styles.row2}>
          <Button testID={`project-rename-${index}`} variant="outline" icon="pencil" label="Nazwa" style={styles.flex} onPress={() => setRenaming(true)} />
          <Button testID={`project-delete-${index}`} variant="outline" icon="trash" label="Usuń" style={styles.flex} onPress={() => setConfirm(true)} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderWidth: 2, borderColor: c.border, padding: 12, gap: 12, backgroundColor: c.surface },
  body: { gap: 4, minHeight: 56 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  row2: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  gap: { gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, flex: 1 },
  date: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
  sub: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurfaceSecondary },
  thumbs: { flexDirection: "row", gap: 8, alignItems: "center" },
  more: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  input: {
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    minHeight: 56,
    paddingHorizontal: 12,
    fontFamily: fonts.mono,
    fontSize: 18,
    color: c.onSurface,
  },
}));

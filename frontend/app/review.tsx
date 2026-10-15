import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fmt } from "@/src/calc";
import { PhotoThumb } from "@/src/components/PhotoThumb";
import { useToast } from "@/src/components/toast";
import { KimlagaToggle } from "@/src/components/KimlagaToggle";
import { Button } from "@/src/components/ui";
import { fonts } from "@/src/fonts";
import { isValidDraft, removeDraft, setEditIndex, updateDraft, useDrafts, useSettings } from "@/src/store";
import { makeStyles, useTheme } from "@/src/theme";

// List of walls read from several photos: check / fix each before calculating
export default function ReviewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const drafts = useDrafts();
  const settings = useSettings();
  const valid = drafts.filter(isValidDraft).length;

  const edit = (i: number) => {
    setEditIndex(i);
    router.push({ pathname: "/edit", params: { from: "review" } });
  };

  const calcAll = () => {
    if (!valid) {
      toast("Popraw wymiary przynajmniej jednej ściany", "error");
      return;
    }
    if (valid < drafts.length) toast(`${drafts.length - valid} ścian bez wymiarów pominięto`, "error");
    if (from === "result") router.back();
    else router.replace("/result");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="review-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>ODCZYTANE ŚCIANY ({drafts.length})</Text>
      </View>
      <FlatList
        testID="review-list"
        data={drafts}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const ok = isValidDraft(item);
          return (
            <View testID={`review-item-${index}`} style={[styles.card, !ok && styles.cardBad]}>
              <PhotoThumb path={item.photo_path} size={72} testID={`review-photo-${index}`} />
              <Pressable style={styles.info} onPress={() => edit(index)} testID={`review-edit-${index}`}>
                <Text style={styles.name}>
                  {index + 1}. {item.name || "Ściana"}
                </Text>
                {ok ? (
                  <Text style={styles.dims}>
                    {fmt(item.length)} × {fmt(item.height)} × {fmt(item.thickness)} cm
                    {item.openings.length ? ` · ${item.openings.length} wycięć` : ""}
                  </Text>
                ) : (
                  <Text testID={`review-manual-${index}`} style={styles.bad}>WPISZ RĘCZNIE</Text>
                )}
                {!!item.notes && (
                  <Text style={styles.notes} numberOfLines={2}>
                    {item.notes}
                  </Text>
                )}
                <View style={styles.kim}>
                  <KimlagaToggle
                    testID={`review-kimlaga-${index}`}
                    value={item.kimlaga ?? settings.defaultKimlaga}
                    onChange={(v) => updateDraft(index, { kimlaga: v, topVariant: undefined })}
                  />
                  <KimlagaToggle
                    testID={`review-allow-brick-${index}`}
                    label="Cegła na górę"
                    value={item.allowBrick ?? settings.defaultAllowBrick}
                    onChange={(v) => updateDraft(index, { allowBrick: v, topVariant: undefined })}
                  />
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable testID={`review-edit-btn-${index}`} onPress={() => edit(index)} style={styles.icon} hitSlop={6}>
                  <Ionicons name="create" size={24} color={colors.onSurface} />
                </Pressable>
                <Pressable testID={`review-remove-${index}`} onPress={() => removeDraft(index)} style={styles.icon} hitSlop={6}>
                  <Ionicons name="trash" size={24} color={colors.error} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 16 }]}>
        <Button testID="calculate-all-button" icon="calculator" label="Oblicz wszystkie" onPress={calcAll} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: c.border,
  },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface, flex: 1 },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: "row", gap: 12, borderWidth: 2, borderColor: c.border, padding: 12, backgroundColor: c.surface },
  cardBad: { backgroundColor: c.brandTertiary },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 18, color: c.onSurface },
  dims: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface },
  bad: { fontFamily: fonts.display, fontSize: 14, color: c.error },
  notes: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
  kim: { marginTop: 8, gap: 8 },
  actions: { justifyContent: "space-between" },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.border },
}));

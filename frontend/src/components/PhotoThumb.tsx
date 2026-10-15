import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { photoUrl } from "../api";
import { makeStyles, useTheme } from "../theme";

// Square thumbnail of the drawing photo; tap opens it full screen
export function PhotoThumb({ path, size = 64, testID }: { path?: string; size?: number; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  if (!path) return null;
  const uri = photoUrl(path);
  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={[styles.thumb, { width: size, height: size }]}>
        <Image source={{ uri }} style={styles.fill} contentFit="cover" cachePolicy="disk" transition={150} />
      </Pressable>
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.modal}>
          <Image source={{ uri }} style={styles.fill} contentFit="contain" cachePolicy="disk" />
          <Pressable
            testID={`${testID}-close`}
            onPress={() => setOpen(false)}
            style={[styles.close, { top: insets.top + 12 }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={32} color={colors.onSurfaceInverse} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  thumb: { borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  modal: { flex: 1, backgroundColor: c.surfaceInverse },
  close: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceInverse,
    borderWidth: 2,
    borderColor: c.onSurfaceInverse,
  },
}));

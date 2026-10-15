import Ionicons from "@react-native-vector-icons/ionicons";
import { Pressable, Text } from "react-native";

import { fonts } from "../fonts";
import { makeStyles, useTheme } from "../theme";

// Big checkbox: first course from waterproof kimlaga block
export function KimlagaToggle({ value, onChange, testID, label = "Kimlaga na dole" }: { value: boolean; onChange: (v: boolean) => void; testID: string; label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => onChange(!value)} style={[styles.opt, value && styles.on]}>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={26} color={value ? colors.onSurfaceInverse : colors.onSurface} />
      <Text style={[styles.text, value && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  opt: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
  },
  on: { backgroundColor: c.surfaceInverse },
  text: { fontFamily: fonts.display, fontSize: 16, color: c.onSurface },
  textOn: { color: c.onSurfaceInverse },
}));

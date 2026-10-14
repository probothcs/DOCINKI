import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, ViewStyle } from "react-native";

import { fonts } from "../fonts";
import { makeStyles, useTheme } from "../theme";

type BtnProps = {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: "primary" | "outline" | "danger";
  loading?: boolean;
  disabled?: boolean;
  testID: string;
  style?: ViewStyle;
  big?: boolean;
};

export function Button({ label, onPress, icon, variant = "primary", loading, disabled, testID, style, big }: BtnProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fg = variant === "outline" ? colors.onSurface : variant === "danger" ? colors.onError : colors.onBrandPrimary;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(variant === "primary" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        big && styles.big,
        variant === "outline" && styles.outline,
        variant === "danger" && styles.danger,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ translateY: 2 }], opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={big ? 32 : 22} color={fg} />}
          <Text style={[styles.btnText, big && styles.bigText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  testID: string;
  suffix?: string;
  keyboardType?: "decimal-pad" | "default";
  hint?: string;
};

export function Field({ label, value, onChangeText, testID, suffix, keyboardType = "decimal-pad", hint }: FieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={styles.input}
          placeholderTextColor={colors.muted}
          placeholder="0"
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.section}>{children}</Text>;
}

export const toNum = (t: string) => {
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
export const toStr = (n: number | null | undefined) => (n ? String(n).replace(".", ",") : "");

const useStyles = makeStyles((c) => ({
  btn: {
    minHeight: 60,
    paddingHorizontal: 16,
    backgroundColor: c.brandPrimary,
    borderWidth: 2,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  big: { minHeight: 120 },
  outline: { backgroundColor: c.surface },
  danger: { backgroundColor: c.error },
  btnText: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1, textTransform: "uppercase" },
  bigText: { fontSize: 24 },
  field: { gap: 4, flex: 1 },
  label: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface, textTransform: "uppercase" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    minHeight: 56,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontFamily: fonts.mono, fontSize: 20, color: c.onSurface, paddingVertical: 8 },
  suffix: { fontFamily: fonts.mono, fontSize: 14, color: c.muted },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: c.muted },
  section: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: c.onSurface,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
  },
}));

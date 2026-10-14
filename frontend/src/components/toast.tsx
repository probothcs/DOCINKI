import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "../fonts";
import { makeStyles } from "../theme";

type Kind = "ok" | "error";
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState<{ msg: string; kind: Kind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, kind: Kind = "ok") => {
    setT({ msg, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && (
        <Animated.View
          entering={FadeInDown}
          exiting={FadeOutDown}
          testID="toast"
          style={[styles.toast, t.kind === "error" && styles.err, { top: insets.top + 8 }]}
        >
          <Text style={styles.text}>{t.msg}</Text>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const useStyles = makeStyles((c) => ({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: c.surfaceInverse,
    borderWidth: 2,
    borderColor: c.border,
    padding: 16,
  },
  err: { backgroundColor: c.error },
  text: { color: c.onSurfaceInverse, fontFamily: fonts.mono, fontSize: 14 },
}));

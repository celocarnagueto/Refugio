import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

const Ctx = createContext<{ show: (msg: string, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now();
    setToast({ id, message, kind });
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setToast((t) => (t?.id === id ? null : t));
      });
    }, 2600);
  }, [anim]);

  const bg = toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.surfaceInverse;
  const fg = toast?.kind === "success" ? colors.onSuccess : toast?.kind === "error" ? colors.onError : colors.onSurfaceInverse;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: insets.top + 12,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <Pressable
            testID="toast-message"
            onPress={() => setToast(null)}
            style={[styles.toast, { backgroundColor: bg }]}
          >
            <Text style={[styles.msg, { color: fg }]}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center", zIndex: 9999 },
  toast: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, maxWidth: 500 },
  msg: { fontSize: 14, fontWeight: "500" },
});

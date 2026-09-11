import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { AdminAuthProvider, useAdmin } from "@/src/admin/context";
import { useTheme } from "@/src/theme";

function Gate({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin();
  const { colors } = useTheme();
  const segments = useSegments() as string[];
  const router = useRouter();
  const onLogin = segments[1] === "login";

  useEffect(() => {
    if (loading) return;
    if (!admin && !onLogin) router.replace("/admin/login");
    if (admin && onLogin) router.replace("/admin/(tabs)");
  }, [admin, loading, onLogin, router]);

  if (loading || (!admin && !onLogin) || (admin && onLogin)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function AdminLayout() {
  const { colors } = useTheme();
  return (
    <AdminAuthProvider>
      <Gate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      </Gate>
    </AdminAuthProvider>
  );
}

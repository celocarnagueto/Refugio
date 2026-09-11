import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox, Platform, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider } from "@/src/auth/context";
import { ToastProvider } from "@/src/components/toast";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BottomSheetModalProvider>
                <ToastProvider>
                  <StatusBar barStyle={Platform.OS === "ios" ? "dark-content" : "dark-content"} />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAFAF7" } }} />
                </ToastProvider>
              </BottomSheetModalProvider>
            </AuthProvider>
          </QueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

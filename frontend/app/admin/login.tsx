import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import { useAdmin } from "@/src/admin/context";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

export default function AdminLogin() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signIn } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      toast.show("Preencha e-mail e senha", "error");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/admin/(tabs)");
    } catch (e: any) {
      toast.show(e.message || "Erro ao entrar", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfaceInverse }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Pressable testID="admin-login-back" onPress={() => router.replace("/auth/login")} hitSlop={12} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="arrow-left" size={18} color={colors.onSurfaceInverse} />
          <Text style={{ color: colors.onSurfaceInverse, fontSize: 13, opacity: 0.8 }}>App da cliente</Text>
        </Pressable>

        <View style={{ marginTop: spacing.xxxl, marginBottom: spacing.xxl }}>
          <View style={[styles.logoBadge, { backgroundColor: colors.brandSecondary }]}>
            <Icon name="briefcase" size={22} color={colors.onBrandSecondary} />
          </View>
          <Text style={[styles.brand, { color: colors.onSurfaceInverse, fontFamily: fonts.serif }]}>Refúgio da Beleza</Text>
          <Text style={{ color: colors.brandSecondary, fontSize: 12, letterSpacing: 2, fontWeight: "700", marginTop: 4 }}>PAINEL ADMINISTRATIVO</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif }]}>Acesso da equipe</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: spacing.md }}>Entre com sua conta de Dono ou Recepção.</Text>

          <Text style={[styles.label, { color: colors.onSurface }]}>E-mail</Text>
          <TextInput
            testID="admin-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="equipe@refugio.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surfaceSecondary }]}
          />
          <Text style={[styles.label, { color: colors.onSurface }]}>Senha</Text>
          <TextInput
            testID="admin-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            onSubmitEditing={submit}
            style={[styles.input, { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surfaceSecondary }]}
          />
          <Pressable testID="admin-login-submit" onPress={submit} disabled={loading} style={[styles.cta, { backgroundColor: colors.surfaceInverse, opacity: loading ? 0.7 : 1 }]}>
            {loading ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={{ color: colors.onSurfaceInverse, fontWeight: "700", fontSize: 16 }}>Entrar no painel</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoBadge: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  brand: { fontSize: 30 },
  card: { borderRadius: 16, padding: spacing.xl },
  title: { fontSize: 24, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  cta: { borderRadius: radius.md, paddingVertical: 16, alignItems: "center", marginTop: spacing.xl },
});

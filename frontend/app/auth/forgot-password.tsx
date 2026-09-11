import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!email) {
      toast.show("Informe o e-mail", "error");
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setDone(true);
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}>
        <Pressable testID="forgot-back" onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Icon name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif }]}>Esqueci minha senha</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Informe seu e-mail e enviaremos instruções para redefinir sua senha.</Text>

        <TextInput
          testID="forgot-email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="seuemail@exemplo.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
        />

        <Pressable
          testID="forgot-submit-button"
          onPress={submit}
          disabled={loading || done}
          style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: (loading || done) ? 0.7 : 1 }]}
        >
          {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
            <Text style={[styles.ctaText, { color: colors.onBrandPrimary }]}>{done ? "Enviado" : "Enviar instruções"}</Text>
          )}
        </Pressable>

        {done && (
          <View testID="forgot-success" style={[styles.successBox, { borderColor: colors.success, backgroundColor: "#EEF3EF" }]}>
            <Icon name="check-circle" size={18} color={colors.success} />
            <Text style={{ color: colors.onSurface, marginLeft: spacing.sm, flex: 1 }}>
              Se o e-mail existir em nossa base, você receberá as instruções em instantes.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, marginBottom: spacing.xs },
  sub: { fontSize: 14, marginBottom: spacing.xl },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15, marginBottom: spacing.xl },
  cta: { borderRadius: radius.md, paddingVertical: 16, alignItems: "center" },
  ctaText: { fontSize: 16, fontWeight: "600" },
  successBox: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.xl },
});

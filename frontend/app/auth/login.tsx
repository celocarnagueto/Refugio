import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/src/auth/context";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signIn } = useAuth();
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
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message || "Erro ao entrar", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image
            source="https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=1200&q=80"
            style={styles.heroImg}
            contentFit="cover"
          />
          <View style={[styles.heroOverlay, { backgroundColor: "rgba(44,38,33,0.35)" }]} />
          <View style={styles.heroTextWrap}>
            <Text style={[styles.brand, { color: colors.onSurfaceInverse, fontFamily: fonts.serif }]}>Refúgio da Beleza</Text>
            <Text style={[styles.tagline, { color: colors.onSurfaceInverse }]}>Um refúgio para o seu cuidado.</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
          <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif }]}>Bem-vinda de volta</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Acesse sua conta para agendar seus cuidados.</Text>

          <Text style={[styles.label, { color: colors.onSurface }]}>E-mail</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="seuemail@exemplo.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
          />

          <Text style={[styles.label, { color: colors.onSurface }]}>Senha</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
          />

          <Link href="/auth/forgot-password" asChild>
            <Pressable testID="forgot-password-link" style={{ alignSelf: "flex-end", marginTop: spacing.sm }}>
              <Text style={{ color: colors.onBrandTertiary, fontSize: 13 }}>Esqueci minha senha</Text>
            </Pressable>
          </Link>

          <Pressable
            testID="login-submit-button"
            onPress={submit}
            disabled={loading}
            style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: loading ? 0.7 : 1, marginTop: spacing.xl }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={[styles.ctaText, { color: colors.onBrandPrimary }]}>Entrar</Text>
            )}
          </Pressable>

          <View style={styles.row}>
            <Text style={{ color: colors.muted }}>Nova por aqui? </Text>
            <Link href="/auth/register" asChild>
              <Pressable testID="go-to-register">
                <Text style={{ color: colors.onBrandTertiary, fontWeight: "600" }}>Criar conta</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 260, position: "relative" },
  heroImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroTextWrap: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  brand: { fontSize: 30, fontWeight: "500", letterSpacing: 0.5 },
  tagline: { fontSize: 14, marginTop: spacing.xs, opacity: 0.95 },
  title: { fontSize: 28, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  cta: { borderRadius: radius.md, paddingVertical: 16, alignItems: "center" },
  ctaText: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});

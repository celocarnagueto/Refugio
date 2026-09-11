import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/src/auth/context";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

export default function Register() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !phone || !email || !password) {
      toast.show("Preencha todos os campos", "error");
      return;
    }
    if (password.length < 6) {
      toast.show("A senha deve ter no mínimo 6 caracteres", "error");
      return;
    }
    if (!lgpd) {
      toast.show("Aceite a política de privacidade (LGPD)", "error");
      return;
    }
    setLoading(true);
    try {
      await signUp({ name: name.trim(), phone: phone.trim(), email: email.trim(), password, lgpd_accepted: true });
      toast.show("Conta criada com sucesso!", "success");
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message || "Erro ao criar conta", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable testID="register-back" onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Icon name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif }]}>Criar sua conta</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Cadastre-se para agendar seus cuidados.</Text>

        <Text style={[styles.label, { color: colors.onSurface }]}>Nome completo</Text>
        <TextInput
          testID="register-name-input"
          value={name}
          onChangeText={setName}
          placeholder="Como devemos te chamar?"
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
        />
        <Text style={[styles.label, { color: colors.onSurface }]}>Telefone</Text>
        <TextInput
          testID="register-phone-input"
          value={phone}
          onChangeText={setPhone}
          placeholder="(19) 99999-9999"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
        />
        <Text style={[styles.label, { color: colors.onSurface }]}>E-mail</Text>
        <TextInput
          testID="register-email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="seuemail@exemplo.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
        />
        <Text style={[styles.label, { color: colors.onSurface }]}>Senha</Text>
        <TextInput
          testID="register-password-input"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
        />

        <Pressable
          testID="register-lgpd-checkbox"
          onPress={() => setLgpd((v) => !v)}
          style={styles.checkRow}
          hitSlop={8}
        >
          <View style={[styles.checkbox, { borderColor: lgpd ? colors.brandPrimary : colors.borderStrong, backgroundColor: lgpd ? colors.brandPrimary : "transparent" }]}>
            {lgpd && <Icon name="check" size={14} color={colors.onBrandPrimary} />}
          </View>
          <Text style={[styles.checkText, { color: colors.onSurface }]}>
            Li e aceito a <Text style={{ color: colors.onBrandTertiary, fontWeight: "600" }}>Política de Privacidade (LGPD)</Text>.
          </Text>
        </Pressable>

        <Pressable
          testID="register-submit-button"
          onPress={submit}
          disabled={loading}
          style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: loading ? 0.7 : 1 }]}
        >
          {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={[styles.ctaText, { color: colors.onBrandPrimary }]}>Cadastrar</Text>}
        </Pressable>

        <View style={styles.row}>
          <Text style={{ color: colors.muted }}>Já tem uma conta? </Text>
          <Link href="/auth/login" asChild>
            <Pressable testID="go-to-login">
              <Text style={{ color: colors.onBrandTertiary, fontWeight: "600" }}>Entrar</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  checkRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  checkText: { fontSize: 13, flex: 1 },
  cta: { borderRadius: radius.md, paddingVertical: 16, alignItems: "center", marginTop: spacing.md },
  ctaText: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});

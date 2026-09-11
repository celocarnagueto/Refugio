import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/feather";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/auth/context";
import { api } from "@/src/api";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setEmail(user?.email || "");
    (async () => {
      setPhotoUrl(await api.photoUrl(user?.photo_path));
    })();
  }, [user]);

  const history = useQuery({ queryKey: ["appointments", "past-history"], queryFn: () => api.listAppointments("past") });

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMe({ name: name.trim(), phone: phone.trim(), email: email.trim() });
      await refresh();
      toast.show("Dados atualizados", "success");
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.show("Permissão para acessar galeria negada", "error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    try {
      setSaving(true);
      await api.uploadPhoto(asset.uri, asset.fileName || "photo.jpg", asset.mimeType || "image/jpeg");
      await refresh();
      toast.show("Foto atualizada", "success");
    } catch (e: any) {
      toast.show(e.message || "Falha no upload", "error");
    } finally {
      setSaving(false);
    }
  };

  const doSignOut = async () => {
    await signOut();
    qc.clear();
    router.replace("/auth/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl }}>
        <View style={{ alignItems: "center", paddingHorizontal: spacing.xl }}>
          <Pressable testID="profile-photo" onPress={pickPhoto} style={[styles.avatarWrap, { borderColor: colors.border }]}>
            {photoUrl ? (
              <Image source={photoUrl} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
                <Icon name="user" size={40} color={colors.onBrandTertiary} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.brandPrimary }]}>
              <Icon name="camera" size={12} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
          <Text testID="profile-name" style={[styles.name, { color: colors.onSurface, fontFamily: fonts.serif }]}>{user?.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{user?.email}</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Meus dados</Text>

          <Text style={[styles.label, { color: colors.onSurface }]}>Nome</Text>
          <TextInput testID="profile-name-input" value={name} onChangeText={setName} style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]} />

          <Text style={[styles.label, { color: colors.onSurface }]}>Telefone</Text>
          <TextInput testID="profile-phone-input" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]} />

          <Text style={[styles.label, { color: colors.onSurface }]}>E-mail</Text>
          <TextInput testID="profile-email-input" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]} />

          <Pressable
            testID="profile-save-button"
            onPress={save}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Salvar alterações</Text>}
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
          <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Histórico de Procedimentos</Text>
          {history.isLoading ? (
            <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brandPrimary} />
          ) : (history.data || []).length === 0 ? (
            <Text style={{ color: colors.muted, marginTop: spacing.md }}>Nenhum procedimento realizado ainda.</Text>
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {(history.data || []).map((a) => (
                <View key={a.id} style={[styles.histCard, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    {a.services.map((s) => (
                      <Text key={s.id} style={{ color: colors.onSurface, fontSize: 14, fontFamily: fonts.serif }}>{s.name}</Text>
                    ))}
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{a.date} · {a.time}</Text>
                  </View>
                  <Text style={{ color: a.status === "cancelled" ? colors.error : colors.success, fontSize: 11, fontWeight: "700" }}>
                    {a.status === "cancelled" ? "CANCELADO" : "REALIZADO"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable
          testID="profile-signout"
          onPress={doSignOut}
          style={[styles.signoutBtn, { borderColor: colors.border }]}
        >
          <Icon name="log-out" size={16} color={colors.error} />
          <Text style={{ color: colors.error, marginLeft: 8, fontWeight: "600" }}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { width: 108, height: 108, borderRadius: 54, borderWidth: 1, padding: 3, position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 22, marginTop: spacing.md },
  section: { fontSize: 20, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: "600", marginTop: spacing.md, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15 },
  saveBtn: { marginTop: spacing.lg, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  histCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  signoutBtn: { marginTop: spacing.xxl, marginHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
});

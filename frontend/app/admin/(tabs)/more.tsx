import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useAdmin } from "@/src/admin/context";
import { AdminHeader, Card, Avatar, Btn } from "@/src/admin/ui";

export default function More() {
  const { colors } = useTheme();
  const router = useRouter();
  const { admin, isOwner, signOut } = useAdmin();

  const items: { icon: any; label: string; hint: string; route: string }[] = [
    { icon: "scissors", label: "Serviços", hint: "Catálogo, preços e duração", route: "/admin/services" },
    { icon: "users", label: "Profissionais", hint: "Equipe e horários de trabalho", route: "/admin/professionals" },
    { icon: "settings", label: "Configurações", hint: isOwner ? "Regras, horários e equipe" : "Regras e horários do salão", route: "/admin/settings" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Mais" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar name={admin?.name || "?"} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 16 }}>{admin?.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{admin?.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: isOwner ? colors.brandSecondary : colors.surfaceTertiary }]}>
            <Text style={{ color: isOwner ? colors.onBrandSecondary : colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" }}>
              {isOwner ? "DONO" : "RECEPÇÃO"}
            </Text>
          </View>
        </Card>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {items.map((it) => (
            <Pressable key={it.route} testID={`more-${it.icon}`} onPress={() => router.push(it.route as any)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                  <Icon name={it.icon} size={20} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{it.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{it.hint}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Card>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.xxl, fontFamily: fonts.serif }}>
          Refúgio da Beleza · Painel
        </Text>
        <Btn label="Sair do painel" variant="ghost" icon="log-out" testID="admin-signout" style={{ marginTop: spacing.md }} onPress={signOut} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});

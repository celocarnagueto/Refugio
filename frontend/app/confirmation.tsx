import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme, spacing, radius, fonts } from "@/src/theme";

export default function Confirmation() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const q = useQuery({
    queryKey: ["appointment-detail", params.id],
    queryFn: async () => {
      const all = await api.listAppointments("all");
      return all.find((a) => a.id === params.id);
    },
    enabled: !!params.id,
  });

  const appt = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
        <View style={styles.hero}>
          <View style={[styles.checkCircle, { backgroundColor: colors.success }]}>
            <Icon name="check" size={38} color={colors.onSuccess} />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface, fontFamily: fonts.serif }]}>Agendamento confirmado!</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Um lembrete será enviado 24h e 2h antes.</Text>
        </View>

        {appt && (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrow(colors.muted)}>DATA</Text>
              <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{appt.date}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrow(colors.muted)}>HORA</Text>
              <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{appt.time}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={styles.eyebrow(colors.muted)}>SERVIÇOS</Text>
            {appt.services.map((s) => (
              <Text key={s.id} style={{ color: colors.onSurface, fontFamily: fonts.serif, fontSize: 16, marginTop: 4 }}>{s.name}</Text>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrow(colors.muted)}>PROFISSIONAL</Text>
              <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{appt.professional?.name || "Sem preferência"}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrow(colors.muted)}>TOTAL</Text>
              <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 18 }}>R$ {appt.total_price.toFixed(0)}</Text>
            </View>
          </View>
        )}

        <View style={[styles.notice, { backgroundColor: colors.brandTertiary }]}>
          <Icon name="bell" size={16} color={colors.onBrandTertiary} />
          <Text style={{ color: colors.onBrandTertiary, marginLeft: 8, flex: 1, fontSize: 13 }}>
            Você receberá lembretes 24h e 2h antes do horário marcado.
          </Text>
        </View>

        <Pressable
          testID="confirmation-home"
          onPress={() => router.replace("/(tabs)/appointments")}
          style={[styles.cta, { backgroundColor: colors.brandPrimary }]}
        >
          <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Ver meus agendamentos</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center" },
  checkCircle: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  h1: { fontSize: 26, textAlign: "center", marginBottom: spacing.xs },
  sub: { fontSize: 14, textAlign: "center", marginBottom: spacing.xl },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, marginVertical: spacing.md },
  eyebrow: (color: string) => ({ color, fontSize: 11, fontWeight: "700", letterSpacing: 1 } as any),
  notice: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  cta: { paddingVertical: 16, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
});

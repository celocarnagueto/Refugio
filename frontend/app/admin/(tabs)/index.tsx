import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useAdmin } from "@/src/admin/context";
import { adminApi, AdminAppointment } from "@/src/admin/api";
import { AdminHeader, Card, SectionTitle, EmptyState, StatusBadge } from "@/src/admin/ui";
import { fmtLong, money } from "@/src/admin/date";
import { AppointmentSheet } from "@/src/admin/components/AppointmentSheet";

export default function AdminDashboard() {
  const { colors } = useTheme();
  const { admin, isOwner } = useAdmin();
  const router = useRouter();
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const q = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard, refetchInterval: 30000 });
  const d = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title={`Olá, ${admin?.name?.split(" ")[0] || ""}`} subtitle={isOwner ? "Dono · acesso total" : "Recepção · acesso operacional"} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
      >
        {d && <Text style={{ color: colors.muted, fontSize: 13, marginBottom: spacing.md, textTransform: "capitalize" }}>{fmtLong(d.today)}</Text>}

        <View style={styles.grid}>
          <Kpi testID="kpi-today" icon="sun" label="Agendamentos hoje" value={d?.today_count} onPress={() => router.push("/admin/(tabs)/agenda")} />
          <Kpi testID="kpi-week" icon="calendar" label="Na semana" value={d?.week_count} />
          <Kpi testID="kpi-new-clients" icon="user-plus" label="Novas clientes (semana)" value={d?.new_clients_week} hint={d ? `${d.total_clients} no total` : undefined} onPress={() => router.push("/admin/(tabs)/clients")} />
          <Kpi testID="kpi-occupancy" icon="pie-chart" label="Ocupação hoje" value={d ? `${d.occupancy_rate}%` : undefined} accent />
        </View>

        {isOwner && d?.finance && (
          <>
            <SectionTitle>Financeiro</SectionTitle>
            <Card testID="finance-card" style={{ backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse }}>
              <Text style={{ color: colors.brandSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}>FATURAMENTO PREVISTO</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
                <Money label="Hoje" value={d.finance.revenue_today} />
                <Money label="Semana" value={d.finance.revenue_week} />
                <Money label="Mês" value={d.finance.revenue_month_forecast} />
              </View>
              <Text style={{ color: colors.onSurfaceInverse, opacity: 0.6, fontSize: 11, marginTop: spacing.md }}>
                Considera agendamentos confirmados e concluídos (pagamento no salão).
              </Text>
            </Card>

            <SectionTitle>Serviços mais vendidos (30 dias)</SectionTitle>
            <Card>
              {(d.top_services || []).length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>Ainda sem dados suficientes.</Text>
              ) : (
                d.top_services!.map((s, i) => (
                  <View key={s.service_id} style={[styles.topRow, i > 0 && { borderTopWidth: 1, borderColor: colors.border }]}>
                    <Text style={[styles.rank, { color: colors.brandSecondary, fontFamily: fonts.serif }]}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{s.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{s.category} · {s.count} atendimentos</Text>
                    </View>
                    <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{money(s.revenue)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        <SectionTitle right={
          <Pressable testID="dash-new-appt" onPress={() => router.push("/admin/new-appointment")} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="plus" size={14} color={colors.onBrandTertiary} />
            <Text style={{ color: colors.onBrandTertiary, fontWeight: "600", fontSize: 13 }}>Novo</Text>
          </Pressable>
        }>Próximos atendimentos hoje</SectionTitle>
        {d && d.upcoming_today.length === 0 ? (
          <Card><EmptyState icon="coffee" title="Agenda livre" subtitle="Nenhum atendimento pendente para hoje." /></Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(d?.upcoming_today || []).map((a) => (
              <Pressable key={a.id} testID={`dash-appt-${a.id}`} onPress={() => setSelected(a)}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={[styles.timeBox, { backgroundColor: colors.brandTertiary }]}>
                    <Text style={{ color: colors.onBrandTertiary, fontWeight: "700" }}>{a.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{a.client.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                      {a.services.map((s) => s.name).join(", ")}{a.professional ? ` · ${a.professional.name}` : ""}
                    </Text>
                  </View>
                  <StatusBadge status={a.status} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <AppointmentSheet appt={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function Kpi({ icon, label, value, hint, accent, onPress, testID }: { icon: any; label: string; value?: number | string; hint?: string; accent?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={{ width: "48%" }}>
      <Card style={accent ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary } : undefined}>
        <Icon name={icon} size={18} color={accent ? colors.onBrandPrimary : colors.brandSecondary} />
        <Text style={[styles.kpiValue, { color: accent ? colors.onBrandPrimary : colors.onSurface, fontFamily: fonts.serif }]}>{value ?? "–"}</Text>
        <Text style={{ color: accent ? colors.onBrandPrimary : colors.muted, fontSize: 12 }}>{label}</Text>
        {hint && <Text style={{ color: accent ? colors.onBrandPrimary : colors.muted, fontSize: 11, opacity: 0.8 }}>{hint}</Text>}
      </Card>
    </Pressable>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceInverse, opacity: 0.7, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.onSurfaceInverse, fontSize: 18, fontWeight: "700", marginTop: 2, fontFamily: fonts.serif }}>{money(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },
  kpiValue: { fontSize: 30, marginTop: spacing.sm },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  rank: { fontSize: 20, width: 20 },
  timeBox: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm },
});

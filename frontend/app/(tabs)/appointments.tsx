import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api, Appointment } from "@/src/api";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Appointments() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const q = useQuery({ queryKey: ["appointments", tab], queryFn: () => api.listAppointments(tab) });

  const cancel = async (id: string) => {
    try {
      await api.cancelAppointment(id);
      toast.show("Agendamento cancelado", "success");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    }
  };

  const renderItem = ({ item }: { item: Appointment }) => (
    <View
      testID={`appointment-${item.id}`}
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
    >
      <View style={styles.rowTop}>
        <View style={[styles.dateBlock, { borderColor: colors.border }]}>
          <Text style={[styles.dateDay, { color: colors.onSurface, fontFamily: fonts.serif }]}>
            {item.date.split("-")[2]}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            {formatDate(item.date).split(" ")[1]}
          </Text>
          <Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 4 }}>{item.time}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          {item.services.map((s) => (
            <Text key={s.id} style={{ color: colors.onSurface, fontSize: 14, fontFamily: fonts.serif }}>
              {s.name}
            </Text>
          ))}
          {item.professional && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <Icon name="user" size={12} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{item.professional.name}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Icon name="clock" size={12} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{item.total_duration_min} min · R$ {item.total_price.toFixed(0)}</Text>
          </View>
          {item.status === "cancelled" && (
            <Text style={{ color: colors.error, fontSize: 12, marginTop: 4, fontWeight: "600" }}>CANCELADO</Text>
          )}
        </View>
      </View>
      {tab === "upcoming" && item.status === "scheduled" && (
        <View style={[styles.actions, { borderColor: colors.border }]}>
          <Pressable
            testID={`reschedule-${item.id}`}
            onPress={() => router.push({ pathname: "/booking", params: { reschedule_id: item.id, service_ids: item.services.map((s) => s.id).join(",") } })}
            style={styles.actionBtn}
          >
            <Icon name="calendar" size={14} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, marginLeft: 6, fontWeight: "600", fontSize: 13 }}>Reagendar</Text>
          </Pressable>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <Pressable
            testID={`cancel-${item.id}`}
            onPress={() => cancel(item.id)}
            style={styles.actionBtn}
          >
            <Icon name="x-circle" size={14} color={colors.error} />
            <Text style={{ color: colors.error, marginLeft: 6, fontWeight: "600", fontSize: 13 }}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl }}>
        <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif }]}>Meus Agendamentos</Text>
        <View style={[styles.segmented, { borderColor: colors.border }]}>
          {(["upcoming", "past"] as const).map((k) => (
            <Pressable
              key={k}
              testID={`tab-${k}`}
              onPress={() => setTab(k)}
              style={[styles.segItem, { backgroundColor: tab === k ? colors.brandPrimary : "transparent" }]}
            >
              <Text style={{ color: tab === k ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>
                {k === "upcoming" ? "Futuros" : "Histórico"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {q.isLoading ? (
        <ActivityIndicator style={{ margin: spacing.xxl }} color={colors.brandPrimary} />
      ) : (q.data || []).length === 0 ? (
        <View style={styles.empty}>
          <Icon name="calendar" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.onSurface, fontFamily: fonts.serif }]}>Nada por aqui ainda</Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 4 }}>
            {tab === "upcoming" ? "Você não possui agendamentos futuros." : "Nenhum histórico disponível."}
          </Text>
          {tab === "upcoming" && (
            <Pressable
              testID="empty-cta"
              onPress={() => router.push("/(tabs)/catalog")}
              style={[styles.emptyCta, { backgroundColor: colors.brandPrimary }]}
            >
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Explorar Serviços</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, marginBottom: spacing.md },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: radius.pill, padding: 4, marginBottom: spacing.md },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  card: { borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  rowTop: { flexDirection: "row", padding: spacing.md },
  dateBlock: { width: 68, alignItems: "center", padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm },
  dateDay: { fontSize: 22 },
  actions: { flexDirection: "row", borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyText: { fontSize: 20, marginTop: spacing.md },
  emptyCta: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.md },
});

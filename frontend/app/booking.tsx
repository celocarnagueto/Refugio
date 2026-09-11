import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";

function nextDays(count: number) {
  const days: { key: string; label: string; day: number; weekday: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push({
      key: `${y}-${m}-${day}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }),
      day: d.getDate(),
      weekday: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
    });
  }
  return days;
}

export default function Booking() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ service_ids: string; reschedule_id?: string }>();
  const serviceIds = String(params.service_ids || "").split(",").filter(Boolean);
  const rescheduleId = params.reschedule_id ? String(params.reschedule_id) : null;

  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(nextDays(1)[0].key);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const services = useQuery({ queryKey: ["services", "all-for-booking"], queryFn: () => api.listServices() });
  const pros = useQuery({ queryKey: ["professionals"], queryFn: () => api.listProfessionals() });
  const avail = useQuery({ queryKey: ["availability", date, professionalId], queryFn: () => api.availability(date, professionalId || undefined) });

  const chosen = useMemo(() => (services.data || []).filter((s) => serviceIds.includes(s.id)), [services.data, serviceIds]);
  const totalDuration = chosen.reduce((a, b) => a + b.duration_min, 0);
  const totalPrice = chosen.reduce((a, b) => a + b.price, 0);

  const todayKey = useMemo(() => nextDays(1)[0].key, []);
  const nowHM = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, [date]);
  const isPastSlot = (t: string) => date === todayKey && t <= nowHM;

  const confirm = async () => {
    if (!time) {
      toast.show("Escolha um horário", "error");
      return;
    }
    setSaving(true);
    try {
      let appt;
      if (rescheduleId) {
        appt = await api.rescheduleAppointment(rescheduleId, date, time);
        toast.show("Agendamento remarcado!", "success");
      } else {
        appt = await api.createAppointment({ service_ids: serviceIds, professional_id: professionalId, date, time });
        toast.show("Agendamento confirmado!", "success");
      }
      qc.invalidateQueries({ queryKey: ["appointments"] });
      router.replace({ pathname: "/confirmation", params: { id: appt.id } });
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  const days = useMemo(() => nextDays(14), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center" }}>
        <Pressable testID="booking-back" onPress={() => router.back()} hitSlop={12}>
          <Icon name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif }]}>
          {rescheduleId ? "Reagendar" : "Agendar"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Chosen services summary */}
        <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 1 }}>SERVIÇOS SELECIONADOS</Text>
          {chosen.map((s) => (
            <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: colors.onSurface, fontSize: 14, flex: 1 }}>{s.name}</Text>
              <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>R$ {s.price.toFixed(0)}</Text>
            </View>
          ))}
          <View style={[styles.summaryFooter, { borderColor: colors.border }]}>
            <Text style={{ color: colors.muted }}>{totalDuration} min · total</Text>
            <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>R$ {totalPrice.toFixed(0)}</Text>
          </View>
        </View>

        {/* Professional */}
        <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Profissional</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <Pressable
            testID="pro-none"
            onPress={() => setProfessionalId(null)}
            style={[styles.proCard, { borderColor: professionalId === null ? colors.brandPrimary : colors.border, backgroundColor: colors.surfaceSecondary, flexShrink: 0 }]}
          >
            <View style={[styles.proAvatarNone, { backgroundColor: colors.brandTertiary }]}>
              <Icon name="user-plus" size={22} color={colors.onBrandTertiary} />
            </View>
            <Text style={[styles.proName, { color: colors.onSurface }]}>Sem preferência</Text>
          </Pressable>
          {(pros.data || []).map((p) => (
            <Pressable
              key={p.id}
              testID={`pro-${p.id}`}
              onPress={() => setProfessionalId(p.id)}
              style={[styles.proCard, { borderColor: professionalId === p.id ? colors.brandPrimary : colors.border, backgroundColor: colors.surfaceSecondary, flexShrink: 0 }]}
            >
              {p.photo_url ? (
                <Image source={p.photo_url} style={styles.proAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.proAvatarNone, { backgroundColor: colors.brandTertiary }]}>
                  <Icon name="user" size={22} color={colors.onBrandTertiary} />
                </View>
              )}
              <Text style={[styles.proName, { color: colors.onSurface }]} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Date */}
        <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          {days.map((d) => {
            const active = d.key === date;
            return (
              <Pressable
                key={d.key}
                testID={`date-${d.key}`}
                onPress={() => { setDate(d.key); setTime(null); }}
                style={[styles.dateChip, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : "transparent", flexShrink: 0 }]}
              >
                <Text style={{ color: active ? colors.onBrandPrimary : colors.muted, fontSize: 10, textTransform: "uppercase", fontWeight: "700" }}>{d.weekday}</Text>
                <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: 2, fontFamily: fonts.serif }}>{d.day}</Text>
                <Text style={{ color: active ? colors.onBrandPrimary : colors.muted, fontSize: 10, textTransform: "uppercase" }}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Time */}
        <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Horário</Text>
        <View style={{ paddingHorizontal: spacing.xl }}>
          {avail.isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <View style={styles.timeGrid}>
              {(avail.data?.slots || []).map((s) => {
                const past = isPastSlot(s.time);
                const disabled = !s.available || past;
                const active = s.time === time;
                return (
                  <Pressable
                    key={s.time}
                    testID={`time-${s.time}`}
                    disabled={disabled}
                    onPress={() => setTime(s.time)}
                    style={[styles.timePill, {
                      borderColor: active ? colors.brandPrimary : colors.border,
                      backgroundColor: active ? colors.brandPrimary : "transparent",
                      opacity: disabled ? 0.3 : 1,
                    }]}
                  >
                    <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{s.time}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Pressable
          testID="booking-confirm"
          onPress={confirm}
          disabled={!time || saving}
          style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: (!time || saving) ? 0.55 : 1 }]}
        >
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
            <>
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 }}>
                {rescheduleId ? "Confirmar novo horário" : "Confirmar agendamento"}
              </Text>
              <Icon name="check" size={18} color={colors.onBrandPrimary} style={{ marginLeft: 8 }} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, marginLeft: spacing.md },
  summary: { margin: spacing.xl, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  summaryFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1 },
  section: { fontSize: 18, marginHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.md },
  proCard: { width: 120, alignItems: "center", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  proAvatar: { width: 56, height: 56, borderRadius: 28 },
  proAvatarNone: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  proName: { fontSize: 12, marginTop: 8, textAlign: "center" },
  dateChip: { width: 60, height: 78, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timePill: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, minWidth: 78, alignItems: "center" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, borderTopWidth: 1 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: radius.md },
});

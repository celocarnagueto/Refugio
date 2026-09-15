import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { adminApi } from "../api";
import { addDays, fromKey, todayKey, weekdayIndex, WEEKDAYS_SHORT, MONTHS } from "../date";

export function DateStrip({ value, onChange, days = 21, start }: { value: string; onChange: (k: string) => void; days?: number; start?: string }) {
  const { colors } = useTheme();
  const items = useMemo(() => {
    const base = start || todayKey();
    return Array.from({ length: days }, (_, i) => addDays(base, i));
  }, [days, start]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
      {items.map((k) => {
        const active = k === value;
        const d = fromKey(k);
        return (
          <Pressable
            key={k}
            testID={`date-${k}`}
            onPress={() => onChange(k)}
            style={[styles.dateChip, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}
          >
            <Text style={{ color: active ? colors.onBrandPrimary : colors.muted, fontSize: 10, textTransform: "uppercase", fontWeight: "700" }}>{WEEKDAYS_SHORT[weekdayIndex(k)]}</Text>
            <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: 2, fontFamily: fonts.serif }}>{d.getDate()}</Text>
            <Text style={{ color: active ? colors.onBrandPrimary : colors.muted, fontSize: 10, textTransform: "uppercase" }}>{MONTHS[d.getMonth()].slice(0, 3)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimePills({ times, value, onChange, disabledSet, testPrefix = "time" }: {
  times: string[]; value: string | null; onChange: (t: string) => void; disabledSet?: Set<string>; testPrefix?: string;
}) {
  const { colors } = useTheme();
  if (times.length === 0) {
    return <Text style={{ color: colors.muted, fontSize: 13 }}>Sem horários disponíveis neste dia.</Text>;
  }
  return (
    <View style={styles.grid}>
      {times.map((t) => {
        const disabled = disabledSet?.has(t);
        const active = t === value;
        return (
          <Pressable
            key={t}
            testID={`${testPrefix}-${t}`}
            disabled={disabled}
            onPress={() => onChange(t)}
            style={[styles.pill, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, opacity: disabled ? 0.3 : 1 }]}
          >
            <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Availability-aware time picker for a date + professional. allowBusy = encaixe (select occupied slots). */
export function AvailabilityTimes({ date, professionalId, durationMin, value, onChange, allowBusy }: {
  date: string; professionalId?: string | null; durationMin: number; value: string | null; onChange: (t: string) => void; allowBusy?: boolean;
}) {
  const { colors } = useTheme();
  const q = useQuery({
    queryKey: ["admin-availability", date, professionalId || null, durationMin],
    queryFn: () => adminApi.availability(date, professionalId, durationMin || 30),
  });
  if (q.isLoading) return <ActivityIndicator color={colors.brandPrimary} />;
  const slots = q.data?.slots || [];
  const disabled = new Set(allowBusy ? [] : slots.filter((s) => !s.available).map((s) => s.time));
  return <TimePills times={slots.map((s) => s.time)} value={value} onChange={onChange} disabledSet={disabled} />;
}

const styles = StyleSheet.create({
  dateChip: { width: 58, height: 76, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, minWidth: 74, alignItems: "center" },
});

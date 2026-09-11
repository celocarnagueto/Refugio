import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi, AdminAppointment, Block } from "@/src/admin/api";
import { AdminHeader, IconBtn, Chip, Card, StatusBadge, Sheet, Btn, EmptyState } from "@/src/admin/ui";
import {
  todayKey, addDays, addMonths, weekStart, monthRange, monthGrid, weekdayIndex, fmtLong, fmtShort,
  fromKey, MONTHS, WEEKDAYS_SHORT, timesBetween, t2m,
} from "@/src/admin/date";
import { AppointmentSheet } from "@/src/admin/components/AppointmentSheet";

type Mode = "day" | "week" | "month";

export default function Agenda() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(todayKey());
  const [proId, setProId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const [blockSel, setBlockSel] = useState<Block | null>(null);

  const range = useMemo(() => {
    if (mode === "day") return { from: date, to: date };
    if (mode === "week") { const ws = weekStart(date); return { from: ws, to: addDays(ws, 6) }; }
    const m = monthRange(date);
    return { from: m.start, to: m.end };
  }, [mode, date]);

  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: adminApi.getSettings });
  const pros = useQuery({ queryKey: ["admin-professionals"], queryFn: adminApi.listProfessionals });
  const appts = useQuery({
    queryKey: ["admin-appointments", range.from, range.to, proId],
    queryFn: () => adminApi.listAppointments({ date_from: range.from, date_to: range.to, professional_id: proId }),
    refetchInterval: 30000,
  });
  const blocks = useQuery({
    queryKey: ["admin-blocks", range.from, range.to, proId],
    queryFn: () => adminApi.listBlocks({ date_from: range.from, date_to: range.to, professional_id: proId }),
    refetchInterval: 30000,
  });

  const activePros = (pros.data || []).filter((p) => p.active);
  const list = appts.data || [];
  const visible = list.filter((a) => a.status !== "cancelled" || mode === "day");

  const shift = (n: number) => {
    if (mode === "day") setDate(addDays(date, n));
    else if (mode === "week") setDate(addDays(date, 7 * n));
    else setDate(addMonths(date, n));
  };

  const title = mode === "day" ? fmtLong(date)
    : mode === "week" ? `${fmtShort(range.from)} – ${fmtShort(range.to)}`
    : `${MONTHS[fromKey(date).getMonth()]} ${fromKey(date).getFullYear()}`;

  const removeBlock = async () => {
    if (!blockSel) return;
    try {
      await adminApi.deleteBlock(blockSel.id);
      toast.show("Bloqueio removido", "success");
      qc.invalidateQueries({ queryKey: ["admin-blocks"] });
      qc.invalidateQueries({ queryKey: ["admin-availability"] });
      setBlockSel(null);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const goNew = (time?: string) =>
    router.push({ pathname: "/admin/new-appointment", params: { date, ...(time ? { time } : {}), ...(proId ? { professional_id: proId } : {}) } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader
        title="Agenda"
        right={
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <IconBtn name="slash" testID="agenda-block" onPress={() => router.push({ pathname: "/admin/block", params: { date, ...(proId ? { professional_id: proId } : {}) } })} />
            <IconBtn name="plus" filled testID="agenda-new" onPress={() => goNew()} />
          </View>
        }
      />

      {/* Mode + navigation */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <View style={[styles.segmented, { borderColor: colors.border }]}>
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <Pressable key={m} testID={`mode-${m}`} onPress={() => setMode(m)} style={[styles.segItem, { backgroundColor: mode === m ? colors.brandPrimary : "transparent" }]}>
              <Text style={{ color: mode === m ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>
                {m === "day" ? "Dia" : m === "week" ? "Semana" : "Mês"}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.navRow}>
          <Pressable testID="agenda-prev" onPress={() => shift(-1)} hitSlop={10} style={styles.navBtn}><Icon name="chevron-left" size={22} color={colors.onSurface} /></Pressable>
          <Pressable onPress={() => setDate(todayKey())} style={{ flex: 1, alignItems: "center" }}>
            <Text testID="agenda-title" style={[styles.navTitle, { color: colors.onSurface, fontFamily: fonts.serif }]}>{title}</Text>
            {date !== todayKey() && <Text style={{ color: colors.onBrandTertiary, fontSize: 11 }}>toque para voltar a hoje</Text>}
          </Pressable>
          <Pressable testID="agenda-next" onPress={() => shift(1)} hitSlop={10} style={styles.navBtn}><Icon name="chevron-right" size={22} color={colors.onSurface} /></Pressable>
        </View>
      </View>

      {/* Professional filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.sm }} style={{ flexGrow: 0 }}>
        <Chip label="Todas" active={proId === null} onPress={() => setProId(null)} testID="pro-filter-all" small />
        {activePros.map((p) => <Chip key={p.id} label={p.name.split(" ")[0]} active={proId === p.id} onPress={() => setProId(p.id)} testID={`pro-filter-${p.id}`} small />)}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={appts.isRefetching} onRefresh={() => { appts.refetch(); blocks.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        {appts.isLoading || settings.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ margin: spacing.xxl }} />
        ) : mode === "day" ? (
          <DayView date={date} appts={visible} blocks={blocks.data || []} settings={settings.data!} proAll={proId === null}
            onAppt={setSelected} onBlock={setBlockSel} onEmpty={goNew} />
        ) : mode === "week" ? (
          <WeekView from={range.from} date={date} appts={visible} onDay={(k) => { setDate(k); setMode("day"); }} onAppt={setSelected} />
        ) : (
          <MonthView date={date} appts={visible} onDay={(k) => { setDate(k); setMode("day"); }} />
        )}
      </ScrollView>

      <AppointmentSheet appt={selected} onClose={() => setSelected(null)} />
      <Sheet visible={!!blockSel} onClose={() => setBlockSel(null)} title="Horário bloqueado">
        {blockSel && (
          <>
            <Text style={{ color: colors.onSurface, fontSize: 16 }}>{fmtLong(blockSel.date)} · {blockSel.start_time} – {blockSel.end_time}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {blockSel.professional_id ? (pros.data || []).find((p) => p.id === blockSel.professional_id)?.name || "Profissional" : "Salão inteiro"}
              {blockSel.reason ? ` · ${blockSel.reason}` : ""}
            </Text>
            <Btn label="Remover bloqueio" variant="danger" icon="trash-2" testID="block-remove" style={{ marginTop: spacing.xl }} onPress={removeBlock} />
          </>
        )}
      </Sheet>
    </View>
  );
}

// ---------- Day ----------
function DayView({ date, appts, blocks, settings, proAll, onAppt, onBlock, onEmpty }: {
  date: string; appts: AdminAppointment[]; blocks: Block[]; settings: any; proAll: boolean;
  onAppt: (a: AdminAppointment) => void; onBlock: (b: Block) => void; onEmpty: (time: string) => void;
}) {
  const { colors } = useTheme();
  const wd = String(weekdayIndex(date));
  const day = settings?.opening_hours?.[wd];
  const closed = !day || day.closed || (settings?.days_off || []).includes(date);
  const step = settings?.slot_minutes || 30;
  const times = useMemo(() => {
    const base = closed ? [] : timesBetween(day.open, day.close, step);
    // include appointments outside working window (e.g. encaixe)
    const extra = appts.map((a) => a.time).filter((t) => !base.includes(t));
    return [...new Set([...base, ...extra])].sort((a, b) => t2m(a) - t2m(b));
  }, [closed, day, step, appts]);

  if (closed && appts.length === 0) {
    return <EmptyState icon="moon" title="Salão fechado" subtitle="Nenhum atendimento neste dia. Ajuste os horários em Configurações." />;
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      {closed && <Text style={{ color: colors.warning, fontSize: 12, marginBottom: spacing.sm, fontWeight: "600" }}>Salão fechado neste dia — exibindo apenas encaixes.</Text>}
      {times.map((t) => {
        const m = t2m(t);
        const rowAppts = appts.filter((a) => a.time === t);
        const rowBlocks = blocks.filter((b) => b.start_time === t);
        const covered = blocks.some((b) => t2m(b.start_time) <= m && m < t2m(b.end_time));
        const busy = appts.some((a) => a.status === "scheduled" && t2m(a.time) < m && m < t2m(a.end_time));
        return (
          <View key={t} style={[styles.slotRow, { borderColor: colors.border }]}>
            <Text style={[styles.slotTime, { color: colors.muted }]}>{t}</Text>
            <View style={{ flex: 1, gap: 6 }}>
              {rowBlocks.map((b) => (
                <Pressable key={b.id} testID={`block-${b.id}`} onPress={() => onBlock(b)} style={[styles.blockCard, { backgroundColor: colors.surfaceTertiary, borderColor: colors.borderStrong }]}>
                  <Icon name="slash" size={14} color={colors.onSurfaceTertiary} />
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", flex: 1 }}>
                    Bloqueado {b.start_time}–{b.end_time}{b.reason ? ` · ${b.reason}` : ""}{b.professional_id ? "" : " · salão"}
                  </Text>
                </Pressable>
              ))}
              {rowAppts.map((a) => <ApptCard key={a.id} a={a} showPro={proAll} onPress={() => onAppt(a)} />)}
              {rowAppts.length === 0 && rowBlocks.length === 0 && (
                <Pressable testID={`slot-${t}`} onPress={() => onEmpty(t)} style={[styles.emptySlot, { borderColor: covered ? "transparent" : colors.border, backgroundColor: covered ? colors.surfaceTertiary : "transparent", opacity: busy ? 0.4 : 1 }]}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{covered ? "bloqueado" : busy ? "em atendimento" : "+ encaixar"}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ApptCard({ a, showPro, onPress }: { a: AdminAppointment; showPro: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const muted = a.status === "cancelled" || a.status === "no_show";
  return (
    <Pressable testID={`appt-${a.id}`} onPress={onPress}>
      <Card style={{ opacity: muted ? 0.55 : 1, borderLeftWidth: 4, borderLeftColor: a.status === "done" ? colors.success : a.source === "app" ? colors.brandPrimary : colors.brandSecondary, paddingVertical: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.onSurface, fontWeight: "700", flex: 1 }} numberOfLines={1}>{a.client.name}</Text>
          <StatusBadge status={a.status} />
        </View>
        <Text style={{ color: colors.onSurface, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{a.services.map((s) => s.name).join(", ")}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {a.time}–{a.end_time}{showPro ? ` · ${a.professional ? a.professional.name.split(" ")[0] : "sem prof."}` : ""}{a.source === "app" ? " · app" : ""}
        </Text>
      </Card>
    </Pressable>
  );
}

// ---------- Week ----------
function WeekView({ from, date, appts, onDay, onAppt }: { from: string; date: string; appts: AdminAppointment[]; onDay: (k: string) => void; onAppt: (a: AdminAppointment) => void }) {
  const { colors } = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = todayKey();
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {days.map((k, i) => {
          const count = appts.filter((a) => a.date === k && a.status === "scheduled").length;
          const isToday = k === today;
          return (
            <Pressable key={k} testID={`week-day-${k}`} onPress={() => onDay(k)} style={[styles.weekDay, { borderColor: isToday ? colors.brandPrimary : colors.border, backgroundColor: k === date ? colors.brandTertiary : colors.surfaceSecondary }]}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>{WEEKDAYS_SHORT[i].toUpperCase()}</Text>
              <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700", fontFamily: fonts.serif }}>{fromKey(k).getDate()}</Text>
              <View style={[styles.countDot, { backgroundColor: count ? colors.brandPrimary : "transparent" }]}>
                <Text style={{ color: colors.onBrandPrimary, fontSize: 10, fontWeight: "700" }}>{count || ""}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {appts.length === 0 ? (
        <EmptyState icon="calendar" title="Semana livre" subtitle="Nenhum agendamento neste período." />
      ) : (
        days.map((k) => {
          const dayAppts = appts.filter((a) => a.date === k);
          if (dayAppts.length === 0) return null;
          return (
            <View key={k} style={{ marginTop: spacing.lg }}>
              <Pressable onPress={() => onDay(k)}>
                <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 13, textTransform: "capitalize", marginBottom: spacing.sm }}>{fmtLong(k)} · {dayAppts.length}</Text>
              </Pressable>
              <View style={{ gap: 6 }}>
                {dayAppts.map((a) => <ApptCard key={a.id} a={a} showPro onPress={() => onAppt(a)} />)}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// ---------- Month ----------
function MonthView({ date, appts, onDay }: { date: string; appts: AdminAppointment[]; onDay: (k: string) => void }) {
  const { colors } = useTheme();
  const rows = monthGrid(date);
  const today = todayKey();
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    appts.forEach((a) => { if (a.status === "scheduled" || a.status === "done") c[a.date] = (c[a.date] || 0) + 1; });
    return c;
  }, [appts]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS_SHORT.map((w) => <Text key={w} style={[styles.monthHead, { color: colors.muted }]}>{w.toUpperCase()}</Text>)}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row" }}>
          {row.map((k, ci) => (
            <Pressable key={ci} testID={k ? `month-day-${k}` : undefined} disabled={!k} onPress={() => k && onDay(k)}
              style={[styles.monthCell, { borderColor: colors.border, backgroundColor: k === today ? colors.brandTertiary : colors.surfaceSecondary, opacity: k ? 1 : 0 }]}>
              {k && (
                <>
                  <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: k === today ? "700" : "400" }}>{fromKey(k).getDate()}</Text>
                  {counts[k] ? (
                    <View style={[styles.monthBadge, { backgroundColor: colors.brandPrimary }]}>
                      <Text style={{ color: colors.onBrandPrimary, fontSize: 10, fontWeight: "700" }}>{counts[k]}</Text>
                    </View>
                  ) : <View style={{ height: 16 }} />}
                </>
              )}
            </Pressable>
          ))}
        </View>
      ))}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing.md, textAlign: "center" }}>{total} agendamentos no mês · toque em um dia para ver detalhes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: radius.pill, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: "center" },
  navRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 18, textTransform: "capitalize" },
  slotRow: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 6, minHeight: 44 },
  slotTime: { width: 48, fontSize: 12, fontWeight: "600", paddingTop: 8 },
  emptySlot: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md, minHeight: 34, justifyContent: "center" },
  blockCard: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md },
  weekDay: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  countDot: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  monthHead: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", paddingVertical: 6 },
  monthCell: { flex: 1, aspectRatio: 0.9, borderWidth: 0.5, alignItems: "center", justifyContent: "center", gap: 2 },
  monthBadge: { minWidth: 18, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});

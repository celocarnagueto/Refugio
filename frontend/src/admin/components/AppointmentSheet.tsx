import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTheme, spacing, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi, AdminAppointment } from "../api";
import { fmtLong, money } from "../date";
import { Sheet, Btn, Field, StatusBadge, SwitchRow, Label } from "../ui";
import { DateStrip, AvailabilityTimes } from "./DateTimePicker";

export function AppointmentSheet({ appt, onClose }: { appt: AdminAppointment | null; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | null>(null);
  const [fitIn, setFitIn] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (appt) {
      setNotes(appt.notes || "");
      setRescheduling(false);
      setDate(appt.date);
      setTime(null);
      setFitIn(false);
    }
  }, [appt]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-appointments"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-availability"] });
    qc.invalidateQueries({ queryKey: ["admin-client"] });
  };

  const update = async (key: string, body: Parameters<typeof adminApi.updateAppointment>[1], msg: string) => {
    if (!appt) return;
    setSaving(key);
    try {
      await adminApi.updateAppointment(appt.id, body);
      toast.show(msg, "success");
      invalidate();
      onClose();
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(null);
    }
  };

  if (!appt) return null;
  const isOpen = appt.status === "scheduled";

  return (
    <Sheet visible={!!appt} onClose={onClose} title="Agendamento">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.client, { color: colors.onSurface, fontFamily: fonts.serif }]} testID="appt-sheet-client">{appt.client.name}</Text>
          {!!appt.client.phone && <Text style={{ color: colors.muted, fontSize: 13 }}>{appt.client.phone}</Text>}
        </View>
        <StatusBadge status={appt.status} />
      </View>

      <View style={[styles.infoBox, { backgroundColor: colors.surfaceTertiary }]}>
        <Row icon="calendar" text={`${fmtLong(appt.date)} · ${appt.time} – ${appt.end_time}`} />
        <Row icon="user" text={appt.professional ? appt.professional.name : "Sem profissional definida"} />
        <Row icon="scissors" text={appt.services.map((s) => s.name).join(", ")} />
        <Row icon="tag" text={`${appt.total_duration_min} min · ${money(appt.total_price)} · ${appt.source === "app" ? "Pelo app" : "Pelo painel"}`} />
      </View>

      {appt.client.id && (
        <Btn label="Ver ficha da cliente" variant="ghost" icon="user" testID="appt-view-client" style={{ marginTop: spacing.md }}
          onPress={() => { onClose(); router.push(`/admin/client/${appt.client.id}`); }} />
      )}

      <Field label="Observações" value={notes} onChangeText={setNotes} multiline placeholder="Ex: chegou atrasada, quer o mesmo tom..." testID="appt-notes" />
      {notes !== (appt.notes || "") && (
        <Btn label="Salvar observações" variant="secondary" loading={saving === "notes"} testID="appt-save-notes" style={{ marginTop: spacing.sm }}
          onPress={() => update("notes", { notes }, "Observações salvas")} />
      )}

      {isOpen && !rescheduling && (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Btn label="Marcar como concluído" icon="check" testID="appt-done" loading={saving === "done"} onPress={() => update("done", { status: "done" }, "Atendimento concluído")} />
          <Btn label="Remarcar" icon="calendar" variant="secondary" testID="appt-reschedule" onPress={() => setRescheduling(true)} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Btn label="Não compareceu" variant="ghost" testID="appt-no-show" loading={saving === "no_show"} style={{ flex: 1 }} onPress={() => update("no_show", { status: "no_show" }, "Marcado como falta")} />
            <Btn label="Cancelar" variant="danger" testID="appt-cancel" loading={saving === "cancelled"} style={{ flex: 1 }} onPress={() => update("cancelled", { status: "cancelled" }, "Agendamento cancelado")} />
          </View>
        </View>
      )}

      {!isOpen && (
        <Btn label="Reabrir agendamento" variant="ghost" testID="appt-reopen" loading={saving === "reopen"} style={{ marginTop: spacing.xl }}
          onPress={() => update("reopen", { status: "scheduled", fit_in: true }, "Agendamento reaberto")} />
      )}

      {rescheduling && (
        <View style={{ marginTop: spacing.xl }}>
          <Label>Nova data</Label>
          <DateStrip value={date} onChange={(k) => { setDate(k); setTime(null); }} />
          <View style={{ marginTop: spacing.md }}><Label>Novo horário</Label></View>
          <AvailabilityTimes date={date} professionalId={appt.professional?.id} durationMin={appt.total_duration_min} value={time} onChange={setTime} allowBusy={fitIn} />
          <SwitchRow label="Encaixe" hint="Permite escolher horário já ocupado" value={fitIn} onValueChange={setFitIn} testID="appt-fit-in" />
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Btn label="Voltar" variant="ghost" style={{ flex: 1 }} onPress={() => setRescheduling(false)} />
            <Btn label="Confirmar" testID="appt-reschedule-confirm" disabled={!time} loading={saving === "resch"} style={{ flex: 1 }}
              onPress={() => update("resch", { date, time: time!, fit_in: fitIn }, "Agendamento remarcado")} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Row({ icon, text }: { icon: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text style={{ color: colors.onSurface, fontSize: 13, flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  client: { fontSize: 20 },
  infoBox: { borderRadius: 8, padding: spacing.md, marginTop: spacing.md },
});

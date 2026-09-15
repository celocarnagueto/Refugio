import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme, spacing } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi } from "@/src/admin/api";
import { AdminHeader, Chip, Btn, Label, Field } from "@/src/admin/ui";
import { DateStrip } from "@/src/admin/components/DateTimePicker";
import { todayKey, isValidTime, t2m } from "@/src/admin/date";

export default function BlockScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ date?: string; professional_id?: string }>();

  const [proId, setProId] = useState<string | null>(params.professional_id || null);
  const [date, setDate] = useState<string>(params.date || todayKey());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const pros = useQuery({ queryKey: ["admin-professionals"], queryFn: adminApi.listProfessionals });
  const activePros = (pros.data || []).filter((p) => p.active);

  const valid = isValidTime(start) && isValidTime(end) && t2m(end) > t2m(start);

  const submit = async () => {
    if (!valid) {
      toast.show("Informe horários válidos (HH:MM), com fim após o início", "error");
      return;
    }
    setSaving(true);
    try {
      await adminApi.createBlock({ professional_id: proId, date, start_time: start, end_time: end, reason });
      toast.show("Bloqueio criado", "success");
      qc.invalidateQueries({ queryKey: ["admin-blocks"] });
      qc.invalidateQueries({ queryKey: ["admin-availability"] });
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Erro ao bloquear", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Bloquear horário" subtitle="Almoço, folga, manutenção…" back />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Label>Aplica-se a</Label>
        <View style={styles.chips}>
          <Chip label="Salão inteiro" active={proId === null} onPress={() => setProId(null)} small />
          {activePros.map((p) => <Chip key={p.id} testID={`block-pro-${p.id}`} label={p.name.split(" ")[0]} active={proId === p.id} onPress={() => setProId(p.id)} small />)}
        </View>

        <View style={{ marginTop: spacing.xl }}><Label>Data</Label></View>
        <DateStrip value={date} onChange={setDate} />

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="Início" value={start} onChangeText={setStart} placeholder="12:00" keyboardType="numbers-and-punctuation" maxLength={5} testID="block-start" /></View>
          <View style={{ flex: 1 }}><Field label="Fim" value={end} onChangeText={setEnd} placeholder="13:00" keyboardType="numbers-and-punctuation" maxLength={5} testID="block-end" /></View>
        </View>
        <Field label="Motivo (opcional)" value={reason} onChangeText={setReason} placeholder="Ex: horário de almoço" testID="block-reason" />

        <Btn label="Criar bloqueio" testID="block-submit" icon="slash" disabled={!valid} loading={saving} style={{ marginTop: spacing.xl }} onPress={submit} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
});

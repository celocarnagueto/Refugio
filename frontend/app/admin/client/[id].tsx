import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi, AdminAppointment } from "@/src/admin/api";
import { AdminHeader, Card, Btn, Field, Avatar, StatusBadge, EmptyState, SectionTitle } from "@/src/admin/ui";
import { AppointmentSheet } from "@/src/admin/components/AppointmentSheet";
import { fmtLong, money } from "@/src/admin/date";

export default function ClientDetail() {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["admin-client", id], queryFn: () => adminApi.getClient(id) });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<AdminAppointment | null>(null);

  useEffect(() => {
    if (q.data) {
      setName(q.data.name);
      setPhone(q.data.phone || "");
      setNotes(q.data.internal_notes || "");
    }
  }, [q.data]);

  const c = q.data;
  const dirty = c && (name !== c.name || phone !== (c.phone || "") || notes !== (c.internal_notes || ""));

  const save = async () => {
    if (!c) return;
    setSaving(true);
    try {
      await adminApi.updateClient(c.id, { name: name.trim(), phone: phone.trim(), internal_notes: notes });
      toast.show("Ficha atualizada", "success");
      qc.invalidateQueries({ queryKey: ["admin-client", id] });
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Ficha da cliente" back />
      {q.isLoading || !c ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ margin: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <Avatar name={c.name} size={72} />
            <Text style={{ color: colors.onSurface, fontFamily: fonts.serif, fontSize: 22, marginTop: spacing.sm }}>{c.name}</Text>
            {!!c.email && <Text style={{ color: colors.muted, fontSize: 13 }}>{c.email}</Text>}
          </View>

          <View style={styles.stats}>
            <Stat label="Atendimentos" value={String((c.history || []).filter((h) => h.status === "done").length)} />
            <Stat label="Total gasto" value={money(c.total_spent || 0)} />
            <Stat label="Agendados" value={String((c.history || []).filter((h) => h.status === "scheduled").length)} />
          </View>

          <Field label="Nome" value={name} onChangeText={setName} testID="client-edit-name" />
          <Field label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="client-edit-phone" />
          <Field label="Observações internas" value={notes} onChangeText={setNotes} multiline placeholder="Preferências, alergias, cor favorita… (visível só para a equipe)" testID="client-edit-notes" />
          {dirty && <Btn label="Salvar ficha" testID="client-save" loading={saving} icon="save" style={{ marginTop: spacing.md }} onPress={save} />}

          <SectionTitle>Histórico</SectionTitle>
          {(c.history || []).length === 0 ? (
            <Card><EmptyState icon="clock" title="Sem histórico" subtitle="Nenhum atendimento registrado ainda." /></Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {c.history!.map((a) => (
                <Pressable key={a.id} testID={`history-${a.id}`} onPress={() => setSelected(a)}>
                  <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontWeight: "600", textTransform: "capitalize" }}>{fmtLong(a.date)} · {a.time}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                        {a.services.map((s) => s.name).join(", ")}{a.professional ? ` · ${a.professional.name.split(" ")[0]}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <StatusBadge status={a.status} />
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{money(a.total_price)}</Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <AppointmentSheet appt={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 16, fontFamily: fonts.serif }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
});

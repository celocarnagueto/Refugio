import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme, spacing, radius } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi, Client } from "@/src/admin/api";
import { AdminHeader, Card, Chip, Btn, Label, Field, SwitchRow, Avatar, EmptyState } from "@/src/admin/ui";
import { DateStrip, AvailabilityTimes } from "@/src/admin/components/DateTimePicker";
import { todayKey, money } from "@/src/admin/date";

export default function NewAppointment() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ date?: string; time?: string; professional_id?: string }>();

  const [manual, setManual] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [proId, setProId] = useState<string | null>(params.professional_id || null);
  const [date, setDate] = useState<string>(params.date || todayKey());
  const [time, setTime] = useState<string | null>(params.time || null);
  const [notes, setNotes] = useState("");
  const [fitIn, setFitIn] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setTerm(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const services = useQuery({ queryKey: ["admin-services"], queryFn: adminApi.listServices });
  const pros = useQuery({ queryKey: ["admin-professionals"], queryFn: adminApi.listProfessionals });
  const clients = useQuery({ queryKey: ["admin-clients", term], queryFn: () => adminApi.listClients(term), enabled: !manual && !client });

  const selectedServices = (services.data || []).filter((s) => serviceIds.includes(s.id));
  const duration = selectedServices.reduce((a, s) => a + s.duration_min, 0) || 30;
  const total = selectedServices.reduce((a, s) => a + s.price, 0);

  const toggleService = (id: string) =>
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canSave = serviceIds.length > 0 && !!time && (manual ? clientName.trim().length > 0 : !!client);

  const submit = async () => {
    if (!canSave) {
      toast.show("Selecione cliente, serviço e horário", "error");
      return;
    }
    setSaving(true);
    try {
      await adminApi.createAppointment({
        user_id: manual ? null : client?.id,
        client_name: manual ? clientName.trim() : undefined,
        client_phone: manual ? clientPhone.trim() : undefined,
        service_ids: serviceIds,
        professional_id: proId,
        date,
        time: time!,
        notes,
        fit_in: fitIn,
      });
      toast.show("Agendamento criado", "success");
      qc.invalidateQueries({ queryKey: ["admin-appointments"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-availability"] });
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Erro ao criar", "error");
    } finally {
      setSaving(false);
    }
  };

  const activePros = (pros.data || []).filter((p) => p.active);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Novo agendamento" back />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        {/* Client */}
        <Label>Cliente</Label>
        <View style={[styles.toggle, { borderColor: colors.border }]}>
          <Pressable testID="client-mode-existing" onPress={() => { setManual(false); setClient(null); }} style={[styles.toggleItem, { backgroundColor: !manual ? colors.brandPrimary : "transparent" }]}>
            <Text style={{ color: !manual ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>Cadastrada</Text>
          </Pressable>
          <Pressable testID="client-mode-manual" onPress={() => { setManual(true); setClient(null); }} style={[styles.toggleItem, { backgroundColor: manual ? colors.brandPrimary : "transparent" }]}>
            <Text style={{ color: manual ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>Avulsa / encaixe</Text>
          </Pressable>
        </View>

        {manual ? (
          <>
            <Field label="Nome" value={clientName} onChangeText={setClientName} placeholder="Nome da cliente" testID="manual-name" />
            <Field label="Telefone" value={clientPhone} onChangeText={setClientPhone} placeholder="(19) 99999-0000" keyboardType="phone-pad" testID="manual-phone" />
          </>
        ) : client ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm }}>
            <Avatar name={client.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{client.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{client.phone || client.email}</Text>
            </View>
            <Pressable testID="clear-client" onPress={() => setClient(null)} hitSlop={8}><Icon name="x" size={18} color={colors.muted} /></Pressable>
          </Card>
        ) : (
          <>
            <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginTop: spacing.sm }]}>
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput testID="appt-client-search" value={search} onChangeText={setSearch} placeholder="Buscar cliente por nome/telefone" placeholderTextColor={colors.muted} autoCapitalize="none" style={{ flex: 1, color: colors.onSurface, paddingVertical: 10 }} />
            </View>
            {clients.isLoading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.md }} /> : (
              <View style={{ marginTop: spacing.sm, gap: 6 }}>
                {(clients.data || []).slice(0, 6).map((c) => (
                  <Pressable key={c.id} testID={`pick-client-${c.id}`} onPress={() => { setClient(c); setSearch(""); }}>
                    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
                      <Avatar name={c.name} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{c.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{c.phone || c.email}</Text>
                      </View>
                    </Card>
                  </Pressable>
                ))}
                {(clients.data || []).length === 0 && !clients.isLoading && (
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Nenhuma cliente encontrada. Use a aba Avulsa / encaixe para digitar o nome.</Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Services */}
        <View style={{ marginTop: spacing.xl }}><Label>Serviços</Label></View>
        {services.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : (services.data || []).length === 0 ? (
          <EmptyState icon="scissors" title="Sem serviços" subtitle="Cadastre serviços em Mais › Serviços." />
        ) : (
          <View style={styles.chips}>
            {(services.data || []).map((s) => (
              <Chip key={s.id} testID={`svc-${s.id}`} label={`${s.name} · ${money(s.price)}`} active={serviceIds.includes(s.id)} onPress={() => toggleService(s.id)} small />
            ))}
          </View>
        )}
        {serviceIds.length > 0 && (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing.sm }}>{duration} min · {money(total)}</Text>
        )}

        {/* Professional */}
        <View style={{ marginTop: spacing.xl }}><Label>Profissional</Label></View>
        <View style={styles.chips}>
          <Chip label="Sem preferência" active={proId === null} onPress={() => { setProId(null); setTime(null); }} small />
          {activePros.map((p) => <Chip key={p.id} testID={`appt-pro-${p.id}`} label={p.name.split(" ")[0]} active={proId === p.id} onPress={() => { setProId(p.id); setTime(null); }} small />)}
        </View>

        {/* Date & time */}
        <View style={{ marginTop: spacing.xl }}><Label>Data</Label></View>
        <DateStrip value={date} onChange={(k) => { setDate(k); setTime(null); }} />
        <View style={{ marginTop: spacing.md }}><Label>Horário</Label></View>
        <AvailabilityTimes date={date} professionalId={proId} durationMin={duration} value={time} onChange={setTime} allowBusy={fitIn} />
        <SwitchRow label="Encaixe" hint="Permite horário já ocupado (ignora conflito)" value={fitIn} onValueChange={setFitIn} testID="appt-new-fit-in" />

        <Field label="Observações" value={notes} onChangeText={setNotes} multiline placeholder="Opcional" testID="appt-new-notes" />

        <Btn label="Criar agendamento" testID="appt-new-submit" disabled={!canSave} loading={saving} icon="check" style={{ marginTop: spacing.xl }} onPress={submit} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", borderWidth: 1, borderRadius: radius.pill, padding: 4, marginTop: spacing.sm },
  toggleItem: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
});

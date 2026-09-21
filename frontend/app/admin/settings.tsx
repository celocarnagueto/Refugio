import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme, spacing, radius } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { useAdmin } from "@/src/admin/context";
import { adminApi, AdminUser, AdminRole, OpeningDay } from "@/src/admin/api";
import { AdminHeader, Card, Sheet, Btn, Field, Label, Chip, SectionTitle } from "@/src/admin/ui";
import { WEEKDAYS, isValidTime, t2m, parseBR, fmtBR } from "@/src/admin/date";

const DEFAULT_OPEN: OpeningDay = { open: "09:00", close: "19:00", closed: false };

export default function SettingsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { admin, isOwner } = useAdmin();

  const q = useQuery({ queryKey: ["admin-settings"], queryFn: adminApi.getSettings });

  const [cancelH, setCancelH] = useState("24");
  const [slot, setSlot] = useState("30");
  const [hours, setHours] = useState<Record<string, OpeningDay>>({});
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [newDayOff, setNewDayOff] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) {
      setCancelH(String(q.data.cancel_min_hours));
      setSlot(String(q.data.slot_minutes));
      const filled: Record<string, OpeningDay> = {};
      for (let i = 0; i < 7; i++) filled[String(i)] = q.data.opening_hours[String(i)] ? { ...DEFAULT_OPEN, ...q.data.opening_hours[String(i)] } : { ...DEFAULT_OPEN };
      setHours(filled);
      setDaysOff(q.data.days_off || []);
    }
  }, [q.data]);

  const setDay = (i: number, patch: Partial<OpeningDay>) =>
    setHours((h) => ({ ...h, [i]: { ...DEFAULT_OPEN, ...h[String(i)], ...patch } }));

  const addDayOff = () => {
    const k = parseBR(newDayOff);
    if (!k) { toast.show("Data inválida (use dd/mm/aaaa)", "error"); return; }
    if (!daysOff.includes(k)) setDaysOff([...daysOff, k].sort());
    setNewDayOff("");
  };

  const validate = () => {
    const ch = parseInt(cancelH, 10);
    const sl = parseInt(slot, 10);
    if (isNaN(ch) || ch < 0 || ch > 168) return "Antecedência de cancelamento inválida (0-168h)";
    if (isNaN(sl) || sl < 10 || sl > 120) return "Intervalo de horários inválido (10-120 min)";
    for (let i = 0; i < 7; i++) {
      const d = hours[String(i)];
      if (!d || d.closed) continue;
      if (!isValidTime(d.open) || !isValidTime(d.close) || t2m(d.close) <= t2m(d.open)) return `Horário inválido em ${WEEKDAYS[i]}`;
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.show(err, "error"); return; }
    setSaving(true);
    const opening: Record<string, OpeningDay> = {};
    for (let i = 0; i < 7; i++) {
      const d = hours[String(i)] || DEFAULT_OPEN;
      opening[String(i)] = { open: d.open, close: d.close, closed: !!d.closed };
    }
    try {
      await adminApi.updateSettings({ cancel_min_hours: parseInt(cancelH, 10), slot_minutes: parseInt(slot, 10), opening_hours: opening, days_off: daysOff });
      toast.show("Configurações salvas", "success");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Configurações" back />
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ margin: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
          {!isOwner && (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md, backgroundColor: colors.surfaceTertiary }}>
              <Icon name="lock" size={16} color={colors.onSurfaceTertiary} />
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, flex: 1 }}>Somente o Dono pode alterar as configurações. Você pode visualizar.</Text>
            </Card>
          )}

          <SectionTitle>Regras de agendamento</SectionTitle>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><Field label="Cancelar/remarcar (h antes)" value={cancelH} onChangeText={(v) => setCancelH(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" editable={isOwner} testID="set-cancel-h" /></View>
            <View style={{ flex: 1 }}><Field label="Intervalo dos horários (min)" value={slot} onChangeText={(v) => setSlot(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" editable={isOwner} testID="set-slot" /></View>
          </View>

          <SectionTitle>Horário de funcionamento</SectionTitle>
          <Card>
            {WEEKDAYS.map((w, i) => {
              const d = hours[String(i)] || DEFAULT_OPEN;
              return (
                <View key={i} style={[styles.dayRow, i > 0 && { borderTopWidth: 1, borderColor: colors.border }]}>
                  <Text style={{ width: 70, color: colors.onSurface, fontWeight: "600", fontSize: 13 }}>{w}</Text>
                  {d.closed ? (
                    <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Fechado</Text>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <TimeBox value={d.open} onChange={(v) => setDay(i, { open: v })} editable={isOwner} testID={`set-open-${i}`} />
                      <Text style={{ color: colors.muted }}>–</Text>
                      <TimeBox value={d.close} onChange={(v) => setDay(i, { close: v })} editable={isOwner} testID={`set-close-${i}`} />
                    </View>
                  )}
                  <Pressable testID={`set-closed-${i}`} disabled={!isOwner} onPress={() => setDay(i, { closed: !d.closed })} hitSlop={8} style={{ paddingHorizontal: 6, opacity: isOwner ? 1 : 0.4 }}>
                    <Icon name={d.closed ? "plus-circle" : "x-circle"} size={20} color={d.closed ? colors.success : colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </Card>

          <SectionTitle>Dias sem expediente</SectionTitle>
          <View style={styles.chips}>
            {daysOff.length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhum feriado/folga cadastrada.</Text>}
            {daysOff.map((k) => (
              <Pressable key={k} testID={`dayoff-${k}`} disabled={!isOwner} onPress={() => setDaysOff(daysOff.filter((x) => x !== k))}>
                <View style={[styles.dayOffChip, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>{fmtBR(k)}</Text>
                  {isOwner && <Icon name="x" size={14} color={colors.onSurfaceTertiary} />}
                </View>
              </Pressable>
            ))}
          </View>
          {isOwner && (
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <TextInput testID="dayoff-input" value={newDayOff} onChangeText={setNewDayOff} placeholder="dd/mm/aaaa" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" maxLength={10}
                  style={[styles.input, { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surfaceSecondary }]} />
              </View>
              <Btn label="Adicionar" variant="secondary" testID="dayoff-add" style={{ paddingVertical: 12 }} onPress={addDayOff} />
            </View>
          )}

          {isOwner && <Btn label="Salvar configurações" testID="settings-save" icon="save" loading={saving} style={{ marginTop: spacing.xl }} onPress={save} />}

          {isOwner && <TeamManagement currentId={admin!.id} />}
        </ScrollView>
      )}
    </View>
  );
}

function TeamManagement({ currentId }: { currentId: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-admins"], queryFn: adminApi.listAdmins });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("staff");
  const [saving, setSaving] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-admins"] });

  const create = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.show("Preencha nome, e-mail e senha (mín. 6)", "error");
      return;
    }
    setSaving(true);
    try {
      await adminApi.createAdmin({ name: name.trim(), email: email.trim(), password, role });
      toast.show("Conta criada", "success");
      invalidate();
      setOpen(false); setName(""); setEmail(""); setPassword(""); setRole("staff");
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: AdminUser) => {
    try {
      await adminApi.deleteAdmin(a.id);
      toast.show("Conta removida", "success");
      invalidate();
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    }
  };

  return (
    <View>
      <SectionTitle right={
        <Pressable testID="team-new" onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="plus" size={14} color={colors.onBrandTertiary} />
          <Text style={{ color: colors.onBrandTertiary, fontWeight: "600", fontSize: 13 }}>Adicionar</Text>
        </Pressable>
      }>Equipe do painel</SectionTitle>
      {q.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : (
        <View style={{ gap: spacing.sm }}>
          {(q.data || []).map((a) => (
            <Card key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{a.name}{a.id === currentId ? " (você)" : ""}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{a.email}</Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: a.role === "owner" ? colors.brandSecondary : colors.surfaceTertiary }]}>
                <Text style={{ color: a.role === "owner" ? colors.onBrandSecondary : colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" }}>{a.role === "owner" ? "DONO" : "RECEPÇÃO"}</Text>
              </View>
              {a.id !== currentId && (
                <Pressable testID={`team-delete-${a.id}`} onPress={() => remove(a)} hitSlop={8}><Icon name="trash-2" size={18} color={colors.error} /></Pressable>
              )}
            </Card>
          ))}
        </View>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title="Nova conta de acesso"
        footer={<Btn label="Criar conta" testID="team-save" loading={saving} onPress={create} />}>
        <Field label="Nome" value={name} onChangeText={setName} testID="team-name" />
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="team-email" />
        <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry testID="team-password" placeholder="Mínimo 6 caracteres" />
        <View style={{ marginTop: spacing.md }}><Label>Perfil</Label></View>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <Chip label="Recepção / Equipe" active={role === "staff"} onPress={() => setRole("staff")} testID="team-role-staff" />
          <Chip label="Dono" active={role === "owner"} onPress={() => setRole("owner")} testID="team-role-owner" />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing.sm }}>
          {role === "owner" ? "Acesso total, incluindo financeiro e configurações." : "Acesso operacional: agenda e clientes, sem financeiro."}
        </Text>
      </Sheet>
    </View>
  );
}

function TimeBox({ value, onChange, editable, testID }: { value: string; onChange: (v: string) => void; editable: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TextInput testID={testID} value={value} onChangeText={onChange} editable={editable} placeholder="09:00" placeholderTextColor={colors.muted}
      keyboardType="numbers-and-punctuation" maxLength={5}
      style={[styles.timeBox, { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, opacity: editable ? 1 : 0.6 }]} />
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  timeBox: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, width: 66, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  dayOffChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
});

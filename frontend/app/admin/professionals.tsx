import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme, spacing, radius } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi, AdminProfessional, WorkDay } from "@/src/admin/api";
import { AdminHeader, IconBtn, Card, Sheet, Btn, Field, Label, SwitchRow, EmptyState, Avatar } from "@/src/admin/ui";
import { WEEKDAYS_SHORT, isValidTime, t2m } from "@/src/admin/date";

const DEFAULT_DAY: WorkDay = { start: "09:00", end: "18:00", off: false };
type Hours = Record<string, WorkDay>;

export default function Professionals() {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-professionals"], queryFn: adminApi.listProfessionals });

  const [editing, setEditing] = useState<AdminProfessional | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [active, setActive] = useState(true);
  const [custom, setCustom] = useState(false);
  const [hours, setHours] = useState<Hours>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-professionals"] }); qc.invalidateQueries({ queryKey: ["professionals"] }); };

  const startNew = () => {
    setEditing(null); setName(""); setSpecialties(""); setActive(true); setCustom(false); setHours({}); setPhotoUrl(null); setOpen(true);
  };
  const startEdit = (p: AdminProfessional) => {
    setEditing(p); setName(p.name); setSpecialties((p.specialties || []).join(", ")); setActive(p.active);
    const wh = p.work_hours || {};
    setCustom(Object.keys(wh).length > 0);
    const filled: Hours = {};
    for (let i = 0; i < 7; i++) filled[String(i)] = wh[String(i)] ? { ...DEFAULT_DAY, ...wh[String(i)] } : { ...DEFAULT_DAY };
    setHours(filled);
    setPhotoUrl(p.photo_url || null);
    setOpen(true);
  };

  const setDay = (i: number, patch: Partial<WorkDay>) =>
    setHours((h) => ({ ...h, [i]: { ...DEFAULT_DAY, ...h[String(i)], ...patch } }));

  const toggleCustom = (v: boolean) => {
    setCustom(v);
    if (v && Object.keys(hours).length === 0) {
      const filled: Hours = {};
      for (let i = 0; i < 7; i++) filled[String(i)] = { ...DEFAULT_DAY };
      setHours(filled);
    }
  };

  const buildWorkHours = (): Hours => {
    if (!custom) return {};
    const out: Hours = {};
    for (let i = 0; i < 7; i++) {
      const d = hours[String(i)] || DEFAULT_DAY;
      out[String(i)] = { start: d.start, end: d.end, off: !!d.off };
    }
    return out;
  };

  const validHours = () => {
    if (!custom) return true;
    for (let i = 0; i < 7; i++) {
      const d = hours[String(i)] || DEFAULT_DAY;
      if (d.off) continue;
      if (!isValidTime(d.start) || !isValidTime(d.end) || t2m(d.end) <= t2m(d.start)) return false;
    }
    return true;
  };

  const save = async () => {
    if (!name.trim()) { toast.show("Informe o nome", "error"); return; }
    if (!validHours()) { toast.show("Horários de trabalho inválidos", "error"); return; }
    setSaving(true);
    const body = {
      name: name.trim(),
      specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
      active,
      work_hours: buildWorkHours(),
    };
    try {
      if (editing) await adminApi.updateProfessional(editing.id, body);
      else await adminApi.createProfessional(body);
      toast.show(editing ? "Profissional atualizada" : "Profissional criada", "success");
      invalidate();
      setOpen(false);
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.deleteProfessional(editing.id);
      toast.show("Profissional removida", "success");
      invalidate();
      setOpen(false);
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    if (!editing) { toast.show("Salve a profissional antes de adicionar a foto", "error"); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.show("Permissão para acessar a galeria negada", "error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled) return;
    const asset = res.assets[0];
    setSaving(true);
    try {
      const r = await adminApi.uploadProfessionalPhoto(editing.id, asset.uri, asset.fileName || "photo.jpg", asset.mimeType || "image/jpeg");
      setPhotoUrl(r.photo_url);
      invalidate();
      toast.show("Foto atualizada", "success");
    } catch (e: any) {
      toast.show(e.message || "Falha no upload", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Profissionais" back right={<IconBtn name="plus" filled testID="pro-new" onPress={startNew} />} />
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ margin: spacing.xxl }} />
      ) : (q.data || []).length === 0 ? (
        <EmptyState icon="users" title="Nenhuma profissional" subtitle="Toque em + para adicionar." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxxl }}>
          {(q.data || []).map((p) => (
            <Pressable key={p.id} testID={`pro-${p.id}`} onPress={() => startEdit(p)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: p.active ? 1 : 0.55 }}>
                {p.photo_url ? <Image source={p.photo_url} style={styles.photo} contentFit="cover" /> : <Avatar name={p.name} size={44} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {(p.specialties || []).join(", ") || "Sem especialidades"}{p.active ? "" : " · inativa"}
                  </Text>
                </View>
                <Icon name="edit-2" size={16} color={colors.muted} />
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Editar profissional" : "Nova profissional"}
        footer={<Btn label={editing ? "Salvar" : "Criar"} testID="pro-save" loading={saving} onPress={save} />}>
        {editing && (
          <View style={{ alignItems: "center", marginTop: spacing.sm }}>
            <Pressable testID="pro-photo" onPress={pickPhoto} style={[styles.photoWrap, { borderColor: colors.border }]}>
              {photoUrl ? <Image source={photoUrl} style={styles.photoBig} contentFit="cover" /> : (
                <View style={[styles.photoBig, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
                  <Icon name="camera" size={26} color={colors.onBrandTertiary} />
                </View>
              )}
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Toque para alterar a foto</Text>
          </View>
        )}
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Nome da profissional" testID="pro-name" />
        <Field label="Especialidades" value={specialties} onChangeText={setSpecialties} placeholder="Separe por vírgula: Cabelo, Coloração" testID="pro-specialties" />
        <View style={{ marginTop: spacing.md }}>
          <SwitchRow label="Ativa" hint="Aparece para agendamento no app e na agenda" value={active} onValueChange={setActive} testID="pro-active" />
          <SwitchRow label="Horário personalizado" hint="Se desligado, segue o horário do salão" value={custom} onValueChange={toggleCustom} testID="pro-custom-hours" />
        </View>
        {custom && (
          <View style={{ marginTop: spacing.sm }}>
            <Label>Horário de trabalho</Label>
            {WEEKDAYS_SHORT.map((w, i) => {
              const d = hours[String(i)] || DEFAULT_DAY;
              return (
                <View key={i} style={[styles.dayRow, { borderColor: colors.border }]}>
                  <Text style={{ width: 40, color: colors.onSurface, fontWeight: "700", fontSize: 13 }}>{w}</Text>
                  {d.off ? (
                    <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Folga</Text>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <TimeBox value={d.start} onChange={(v) => setDay(i, { start: v })} testID={`pro-day-${i}-start`} />
                      <Text style={{ color: colors.muted }}>–</Text>
                      <TimeBox value={d.end} onChange={(v) => setDay(i, { end: v })} testID={`pro-day-${i}-end`} />
                    </View>
                  )}
                  <Pressable testID={`pro-day-${i}-off`} onPress={() => setDay(i, { off: !d.off })} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                    <Icon name={d.off ? "plus-circle" : "x-circle"} size={20} color={d.off ? colors.success : colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        {editing && <Btn label="Remover profissional" variant="danger" icon="trash-2" testID="pro-delete" loading={saving} style={{ marginTop: spacing.lg }} onPress={remove} />}
      </Sheet>
    </View>
  );
}

function TimeBox({ value, onChange, testID }: { value: string; onChange: (v: string) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChange}
      placeholder="09:00"
      placeholderTextColor={colors.muted}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={[styles.timeBox, { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surfaceSecondary }]}
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: 44, height: 44, borderRadius: 22 },
  photoWrap: { borderRadius: 44, borderWidth: 1, overflow: "hidden" },
  photoBig: { width: 88, height: 88, borderRadius: 44 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, paddingVertical: spacing.sm },
  timeBox: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, width: 66, textAlign: "center" },
});

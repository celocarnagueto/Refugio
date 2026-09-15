import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import { useToast } from "@/src/components/toast";
import { adminApi } from "@/src/admin/api";
import type { Service } from "@/src/api";
import { AdminHeader, IconBtn, Card, Sheet, Btn, Field, SwitchRow, EmptyState } from "@/src/admin/ui";
import { money } from "@/src/admin/date";

type Draft = { name: string; category: string; description: string; duration_min: string; price: string; image_url: string; featured: boolean };
const EMPTY: Draft = { name: "", category: "", description: "", duration_min: "30", price: "", image_url: "", featured: false };

export default function Services() {
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-services"], queryFn: adminApi.listServices });

  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const startNew = () => { setEditing(null); setDraft(EMPTY); setOpen(true); };
  const startEdit = (s: Service) => {
    setEditing(s);
    setDraft({ name: s.name, category: s.category, description: s.description || "", duration_min: String(s.duration_min), price: String(s.price), image_url: s.image_url || "", featured: !!s.featured });
    setOpen(true);
  };

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-services"] }); qc.invalidateQueries({ queryKey: ["services"] }); };

  const save = async () => {
    const price = parseFloat(draft.price.replace(",", "."));
    const duration = parseInt(draft.duration_min, 10);
    if (!draft.name.trim() || !draft.category.trim() || isNaN(price) || price < 0 || isNaN(duration) || duration < 5) {
      toast.show("Preencha nome, categoria, duração (≥5) e preço válido", "error");
      return;
    }
    setSaving(true);
    const body = {
      name: draft.name.trim(), category: draft.category.trim(), description: draft.description.trim(),
      duration_min: duration, price, image_url: draft.image_url.trim() || null, featured: draft.featured,
    };
    try {
      if (editing) await adminApi.updateService(editing.id, body);
      else await adminApi.createService(body as any);
      toast.show(editing ? "Serviço atualizado" : "Serviço criado", "success");
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
      await adminApi.deleteService(editing.id);
      toast.show("Serviço removido", "success");
      invalidate();
      setOpen(false);
    } catch (e: any) {
      toast.show(e.message || "Erro", "error");
    } finally {
      setSaving(false);
    }
  };

  const grouped = (q.data || []).reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Serviços" back right={<IconBtn name="plus" filled testID="service-new" onPress={startNew} />} />
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ margin: spacing.xxl }} />
      ) : (q.data || []).length === 0 ? (
        <EmptyState icon="scissors" title="Nenhum serviço" subtitle="Toque em + para adicionar o primeiro serviço." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}>
          {Object.entries(grouped).map(([cat, list]) => (
            <View key={cat} style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.cat, { color: colors.onSurface, fontFamily: fonts.serif }]}>{cat}</Text>
              <View style={{ gap: spacing.sm }}>
                {list.map((s) => (
                  <Pressable key={s.id} testID={`service-${s.id}`} onPress={() => startEdit(s)}>
                    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{s.name}</Text>
                          {s.featured && <Icon name="star" size={13} color={colors.brandSecondary} />}
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{s.duration_min} min · {money(s.price)}</Text>
                      </View>
                      <Icon name="edit-2" size={16} color={colors.muted} />
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Editar serviço" : "Novo serviço"}
        footer={<Btn label={editing ? "Salvar" : "Criar serviço"} testID="service-save" loading={saving} onPress={save} />}>
        <Field label="Nome" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="Ex: Corte feminino" testID="service-name" />
        <Field label="Categoria" value={draft.category} onChangeText={(v) => setDraft({ ...draft, category: v })} placeholder="Cabelo, Unhas, Depilação…" testID="service-category" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="Duração (min)" value={draft.duration_min} onChangeText={(v) => setDraft({ ...draft, duration_min: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" testID="service-duration" /></View>
          <View style={{ flex: 1 }}><Field label="Preço (R$)" value={draft.price} onChangeText={(v) => setDraft({ ...draft, price: v.replace(/[^0-9.,]/g, "") })} keyboardType="decimal-pad" placeholder="0,00" testID="service-price" /></View>
        </View>
        <Field label="Descrição" value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} multiline placeholder="Opcional" testID="service-description" />
        <Field label="URL da imagem" value={draft.image_url} onChangeText={(v) => setDraft({ ...draft, image_url: v })} autoCapitalize="none" placeholder="https://… (opcional)" testID="service-image" />
        <View style={{ marginTop: spacing.sm }}>
          <SwitchRow label="Destaque" hint="Aparece em destaque no app da cliente" value={draft.featured} onValueChange={(v) => setDraft({ ...draft, featured: v })} testID="service-featured" />
        </View>
        {editing && <Btn label="Remover serviço" variant="danger" icon="trash-2" testID="service-delete" loading={saving} style={{ marginTop: spacing.md }} onPress={remove} />}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  cat: { fontSize: 16, marginBottom: spacing.sm, textTransform: "capitalize" },
});

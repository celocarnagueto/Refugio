import React, { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Icon from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius } from "@/src/theme";
import { adminApi, Client } from "@/src/admin/api";
import { AdminHeader, Card, EmptyState, Avatar } from "@/src/admin/ui";
import { fmtBR } from "@/src/admin/date";

export default function Clients() {
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const q = useQuery({ queryKey: ["admin-clients", term], queryFn: () => adminApi.listClients(term) });

  // debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setTerm(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const renderItem = ({ item }: { item: Client }) => (
    <Pressable testID={`client-${item.id}`} onPress={() => router.push(`/admin/client/${item.id}`)}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar name={item.name} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{item.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.phone || item.email}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
            {item.appointments_count || 0} atendimentos{item.last_visit ? ` · última visita ${fmtBR(item.last_visit)}` : ""}
          </Text>
        </View>
        {!!item.internal_notes && <Icon name="file-text" size={16} color={colors.brandSecondary} />}
        <Icon name="chevron-right" size={18} color={colors.muted} />
      </Card>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminHeader title="Clientes" subtitle={q.data ? `${q.data.length} cadastradas` : undefined} />
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput
            testID="client-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome ou telefone"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: 15, paddingVertical: 10 }}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}><Icon name="x" size={16} color={colors.muted} /></Pressable>
          )}
        </View>
      </View>
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ margin: spacing.xxl }} />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={<EmptyState icon="users" title="Nenhuma cliente encontrada" subtitle={term ? "Tente outro nome ou telefone." : "As clientes aparecem aqui após se cadastrarem no app."} />}
          onRefresh={q.refetch}
          refreshing={q.isRefetching}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
});

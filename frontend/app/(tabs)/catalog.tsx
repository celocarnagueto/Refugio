import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { api, Service } from "@/src/api";
import { useTheme, spacing, radius, fonts } from "@/src/theme";

const CATS = ["Cabelo", "Unhas", "Depilação"] as const;

export default function Catalog() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<string>((params.category as string) || "Cabelo");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const services = useQuery({ queryKey: ["services", category], queryFn: () => api.listServices({ category }) });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const summary = useMemo(() => {
    const items = (services.data || []).filter((s) => selected.has(s.id));
    return {
      count: items.length,
      duration: items.reduce((a, b) => a + b.duration_min, 0),
      price: items.reduce((a, b) => a + b.price, 0),
    };
  }, [services.data, selected]);

  const goBook = () => {
    if (selected.size === 0) return;
    router.push({ pathname: "/booking", params: { service_ids: Array.from(selected).join(",") } });
  };

  const renderItem = ({ item }: { item: Service }) => {
    const isSel = selected.has(item.id);
    return (
      <Pressable
        testID={`service-item-${item.id}`}
        onPress={() => toggle(item.id)}
        style={[styles.card, { borderColor: isSel ? colors.brandPrimary : colors.border, backgroundColor: colors.surfaceSecondary }]}
      >
        {item.image_url && <Image source={item.image_url} style={styles.cardImg} contentFit="cover" />}
        <View style={{ flex: 1, padding: spacing.md }}>
          <Text style={[styles.cardName, { color: colors.onSurface, fontFamily: fonts.serif }]}>{item.name}</Text>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.description}</Text>
          <View style={styles.meta}>
            <Icon name="clock" size={12} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{item.duration_min} min</Text>
            <Text style={{ color: colors.onSurface, fontWeight: "700", marginLeft: "auto" }}>R$ {item.price.toFixed(0)}</Text>
          </View>
        </View>
        <View style={[styles.checkBadge, { backgroundColor: isSel ? colors.brandPrimary : "transparent", borderColor: isSel ? colors.brandPrimary : colors.borderStrong }]}>
          {isSel && <Icon name="check" size={14} color={colors.onBrandPrimary} />}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Sticky header */}
      <View style={{ paddingTop: insets.top + spacing.md, backgroundColor: colors.surface }}>
        <Text style={[styles.title, { color: colors.onSurface, fontFamily: fonts.serif, paddingHorizontal: spacing.xl }]}>Catálogo</Text>
        <Text style={{ color: colors.muted, paddingHorizontal: spacing.xl, marginBottom: spacing.md, fontSize: 13 }}>
          Toque em um ou mais serviços para agendar.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, height: 56, alignItems: "center" }}
        >
          {CATS.map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c}
                testID={`category-chip-${c}`}
                onPress={() => setCategory(c)}
                style={[styles.chip, {
                  borderColor: active ? colors.brandPrimary : colors.border,
                  backgroundColor: active ? colors.brandPrimary : "transparent",
                  flexShrink: 0,
                }]}
              >
                <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontSize: 13, fontWeight: "600" }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {services.isLoading ? (
        <ActivityIndicator style={{ margin: spacing.xxl }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={services.data || []}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 160, gap: spacing.md }}
        />
      )}

      {selected.size > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{summary.count} serviço(s) · {summary.duration} min</Text>
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700" }}>R$ {summary.price.toFixed(0)}</Text>
          </View>
          <Pressable
            testID="catalog-book-cta"
            onPress={goBook}
            style={[styles.cta, { backgroundColor: colors.brandPrimary }]}
          >
            <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Agendar</Text>
            <Icon name="arrow-right" size={16} color={colors.onBrandPrimary} style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, overflow: "hidden", alignItems: "stretch" },
  cardImg: { width: 96, height: "100%" },
  cardName: { fontSize: 17 },
  meta: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  checkBadge: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", padding: spacing.lg, borderTopWidth: 1 },
  cta: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radius.md },
});

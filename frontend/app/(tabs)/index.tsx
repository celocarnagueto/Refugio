import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth/context";
import { useTheme, spacing, radius, fonts } from "@/src/theme";

const CATEGORIES = [
  { key: "Cabelo", title: "Cabelo", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80" },
  { key: "Unhas", title: "Unhas", image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80" },
  { key: "Depilação", title: "Depilação", image: "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=800&q=80" },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const featured = useQuery({ queryKey: ["services", "featured"], queryFn: () => api.listServices({ featured: true }) });

  const firstName = (user?.name || "").split(" ")[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Text style={[styles.hi, { color: colors.muted }]}>Olá,</Text>
          <Text testID="home-greeting" style={[styles.name, { color: colors.onSurface, fontFamily: fonts.serif }]}>
            {firstName || "querida"} 
          </Text>
        </View>

        {/* Hero Banner */}
        <Pressable
          testID="home-banner"
          onPress={() => router.push("/(tabs)/catalog")}
          style={styles.hero}
        >
          <Image
            source="https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=1200&q=80"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(44,38,33,0.35)" }]} />
          <View style={styles.heroContent}>
            <Text style={[styles.heroTag, { color: colors.brandSecondary }]}>PROMOÇÃO DA SEMANA</Text>
            <Text style={[styles.heroTitle, { color: "#fff", fontFamily: fonts.serif }]}>Hidratação premium com 20% off</Text>
            <View style={[styles.heroCta, { backgroundColor: colors.brandPrimary }]}>
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 }}>Agendar agora</Text>
              <Icon name="arrow-right" size={14} color={colors.onBrandPrimary} style={{ marginLeft: 6 }} />
            </View>
          </View>
        </Pressable>

        {/* Quick Book Shortcut */}
        <Pressable
          testID="home-book-shortcut"
          onPress={() => router.push("/(tabs)/catalog")}
          style={[styles.shortcut, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
        >
          <View style={[styles.shortcutIcon, { backgroundColor: colors.brandTertiary }]}>
            <Icon name="calendar" size={20} color={colors.onBrandTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shortcutTitle, { color: colors.onSurface, fontFamily: fonts.serif }]}>Agendar</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Escolha seu serviço e horário</Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.muted} />
        </Pressable>

        {/* Categories */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Categorias</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.md }}
        >
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              testID={`home-category-${c.key}`}
              onPress={() => router.push({ pathname: "/(tabs)/catalog", params: { category: c.key } })}
              style={styles.catCard}
            >
              <Image source={c.image} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(44,38,33,0.3)" }]} />
              <Text style={[styles.catText, { color: "#fff", fontFamily: fonts.serif }]}>{c.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Featured Services */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Text style={[styles.section, { color: colors.onSurface, fontFamily: fonts.serif }]}>Serviços em destaque</Text>
        </View>
        {featured.isLoading ? (
          <ActivityIndicator style={{ margin: spacing.xl }} color={colors.brandPrimary} />
        ) : (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md, gap: spacing.md }}>
            {(featured.data || []).map((s) => (
              <Pressable
                key={s.id}
                testID={`home-featured-${s.id}`}
                onPress={() => router.push({ pathname: "/(tabs)/catalog", params: { category: s.category } })}
                style={[styles.featCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
              >
                {s.image_url && (
                  <Image source={s.image_url} style={styles.featImg} contentFit="cover" />
                )}
                <View style={{ flex: 1, padding: spacing.md }}>
                  <Text style={{ color: colors.onBrandTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "600" }}>{s.category.toUpperCase()}</Text>
                  <Text style={[styles.featName, { color: colors.onSurface, fontFamily: fonts.serif }]}>{s.name}</Text>
                  <View style={styles.featMeta}>
                    <Icon name="clock" size={12} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{s.duration_min} min</Text>
                    <Text style={{ color: colors.onSurface, fontWeight: "700", marginLeft: spacing.md }}>R$ {s.price.toFixed(0)}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hi: { fontSize: 14 },
  name: { fontSize: 28, marginTop: 2 },
  hero: { height: 200, marginHorizontal: spacing.xl, marginTop: spacing.lg, borderRadius: radius.lg, overflow: "hidden" },
  heroContent: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  heroTag: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: spacing.xs },
  heroTitle: { fontSize: 22, lineHeight: 28, marginBottom: spacing.md },
  heroCta: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  shortcut: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  shortcutTitle: { fontSize: 18 },
  section: { fontSize: 20 },
  catCard: { width: 140, height: 100, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end", padding: spacing.md, flexShrink: 0 },
  catText: { fontSize: 18, fontWeight: "600" },
  featCard: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  featImg: { width: 100, height: 100 },
  featName: { fontSize: 17, marginTop: 4 },
  featMeta: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
});

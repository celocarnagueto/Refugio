import React from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Modal, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, TextInputProps, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, fonts } from "@/src/theme";
import type { ApptStatus } from "./api";

export function AdminHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderColor: colors.border, backgroundColor: colors.surface }]}>
      {back && (
        <Pressable testID="admin-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: colors.onSurface, fontFamily: fonts.serif }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function IconBtn({ name, onPress, testID, color, filled }: { name: any; onPress: () => void; testID?: string; color?: string; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={[styles.iconBtn, { backgroundColor: filled ? colors.brandPrimary : colors.surfaceTertiary }]}
    >
      <Icon name={name} size={18} color={color || (filled ? colors.onBrandPrimary : colors.onSurface)} />
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: any; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.onSurface, fontFamily: fonts.serif }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.onSurface }]}>{children}</Text>;
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      {label && <Label>{label}</Label>}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surfaceSecondary }, props.multiline && { minHeight: 90, textAlignVertical: "top" }, style]}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, testID, small }: { label: string; active?: boolean; onPress?: () => void; testID?: string; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        small && { paddingVertical: 6, paddingHorizontal: 10 },
        { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary },
      ]}
    >
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: small ? 12 : 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Btn({ label, onPress, variant = "primary", loading, disabled, icon, testID, style }: {
  label: string; onPress: () => void; variant?: "primary" | "ghost" | "danger" | "secondary"; loading?: boolean; disabled?: boolean; icon?: any; testID?: string; style?: any;
}) {
  const { colors } = useTheme();
  const bg = variant === "primary" ? colors.brandPrimary : variant === "danger" ? colors.error : variant === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg = variant === "primary" ? colors.onBrandPrimary : variant === "danger" ? colors.onError : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled || loading ? 0.55 : 1, borderWidth: variant === "ghost" ? 1 : 0, borderColor: colors.border }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={16} color={fg} style={{ marginRight: 8 }} />}
          <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SwitchRow({ label, value, onValueChange, testID, hint }: { label: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "600" }}>{label}</Text>
        {hint && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>}
      </View>
      <Switch testID={testID} value={value} onValueChange={onValueChange} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
    </View>
  );
}

export const STATUS_LABEL: Record<ApptStatus, string> = { scheduled: "Agendado", done: "Concluído", cancelled: "Cancelado", no_show: "Faltou" };

export function StatusBadge({ status }: { status: ApptStatus }) {
  const { colors } = useTheme();
  const bg = status === "scheduled" ? colors.brandTertiary : status === "done" ? colors.success : status === "cancelled" ? colors.error : colors.warning;
  const fg = status === "scheduled" ? colors.onBrandTertiary : status === "done" ? colors.onSuccess : status === "cancelled" ? colors.onError : colors.onWarning;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>{STATUS_LABEL[status].toUpperCase()}</Text>
    </View>
  );
}

export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface, fontFamily: fonts.serif }]}>{title}</Text>
            <Pressable testID="sheet-close" onPress={onClose} hitSlop={12}>
              <Icon name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={40} color={colors.muted} />
      <Text style={{ color: colors.onSurface, fontSize: 17, marginTop: spacing.md, fontFamily: fonts.serif }}>{title}</Text>
      {subtitle && <Text style={{ color: colors.muted, textAlign: "center", marginTop: 4, fontSize: 13 }}>{subtitle}</Text>}
    </View>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.onBrandTertiary, fontWeight: "700", fontSize: size * 0.38 }}>{initials || "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, gap: spacing.md },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "flex-start", marginLeft: -6 },
  headerTitle: { fontSize: 24 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontSize: 18 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: spacing.lg, borderRadius: radius.md, minHeight: 48 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, gap: spacing.md },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: "flex-start" },
  backdrop: { flex: 1, backgroundColor: "rgba(44,38,33,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", paddingTop: spacing.sm },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  sheetTitle: { fontSize: 20 },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing.xxl },
});

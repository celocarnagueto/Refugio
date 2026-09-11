import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FAFAF7",
  onSurface: "#2C2621",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2C2621",
  surfaceTertiary: "#F2EBE3",
  onSurfaceTertiary: "#4A4139",
  surfaceInverse: "#2C2621",
  onSurfaceInverse: "#FAFAF7",
  muted: "#887E75",

  brand: "#DDA7A5",
  onBrand: "#2C2621",
  brandPrimary: "#DDA7A5",
  onBrandPrimary: "#2C2621",
  brandSecondary: "#D4B483",
  onBrandSecondary: "#2C2621",
  brandTertiary: "#F4EAE9",
  onBrandTertiary: "#8F6564",

  success: "#708A74",
  onSuccess: "#FFFFFF",
  warning: "#D4B483",
  onWarning: "#2C2621",
  error: "#B56C6C",
  onError: "#FFFFFF",
  info: "#8B9A9A",
  onInfo: "#FFFFFF",

  border: "#E8E1DA",
  borderStrong: "#D1C7BE",
  divider: "#E8E1DA",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 };
export const fonts = {
  serif: "Georgia",
  sans: "System",
};

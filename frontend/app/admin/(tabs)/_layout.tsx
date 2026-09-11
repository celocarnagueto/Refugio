import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/feather";
import { useTheme } from "@/src/theme";

export default function AdminTabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ color, size }) => <Icon name="bar-chart-2" size={size} color={color} /> }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarIcon: ({ color, size }) => <Icon name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="clients" options={{ title: "Clientes", tabBarIcon: ({ color, size }) => <Icon name="users" size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: "Mais", tabBarIcon: ({ color, size }) => <Icon name="menu" size={size} color={color} /> }} />
    </Tabs>
  );
}

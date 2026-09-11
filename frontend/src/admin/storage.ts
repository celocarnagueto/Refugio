import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEY_TOKEN = "admin_token";
const KEY_ADMIN = "admin_user";

async function set(key: string, value: string) {
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}
async function get(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function remove(key: string) {
  if (Platform.OS === "web") return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

export const adminStorage = {
  getToken: () => get(KEY_TOKEN),
  setToken: (t: string) => set(KEY_TOKEN, t),
  clearToken: () => remove(KEY_TOKEN),
  getAdmin: async () => {
    const v = await get(KEY_ADMIN);
    return v ? JSON.parse(v) : null;
  },
  setAdmin: (u: any) => set(KEY_ADMIN, JSON.stringify(u)),
  clearAdmin: () => remove(KEY_ADMIN),
};

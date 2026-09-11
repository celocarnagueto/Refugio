import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEY_TOKEN = "auth_token";
const KEY_USER = "auth_user";

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

export const authStorage = {
  getToken: () => get(KEY_TOKEN),
  setToken: (t: string) => set(KEY_TOKEN, t),
  clearToken: () => remove(KEY_TOKEN),
  getUser: async () => {
    const v = await get(KEY_USER);
    return v ? JSON.parse(v) : null;
  },
  setUser: (u: any) => set(KEY_USER, JSON.stringify(u)),
  clearUser: () => remove(KEY_USER),
};

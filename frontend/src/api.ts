import { authStorage } from "./auth/storage";

export const API_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api";

async function request(path: string, init: RequestInit = {}, auth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  if (auth) {
    const token = await authStorage.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const msg = typeof data.detail === "string" ? data.detail : "Erro na requisição";
    throw new Error(msg);
  }
  return data;
}

export type User = { id: string; name: string; phone: string; email: string; photo_path?: string | null };
export type Service = { id: string; category: string; name: string; description: string; duration_min: number; price: number; image_url?: string | null; featured?: boolean };
export type Professional = { id: string; name: string; specialties: string[]; photo_url?: string | null };
export type Appointment = {
  id: string;
  user_id: string;
  services: Service[];
  professional: Professional | null;
  date: string;
  time: string;
  total_duration_min: number;
  total_price: number;
  status: "scheduled" | "cancelled" | "done";
  created_at: string;
};

export const api = {
  register: (body: { name: string; phone: string; email: string; password: string; lgpd_accepted: boolean }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }, false),
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  forgotPassword: (email: string) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, false),
  me: (): Promise<User> => request("/auth/me"),
  updateMe: (patch: Partial<Pick<User, "name" | "phone" | "email">>): Promise<User> =>
    request("/auth/me", { method: "PATCH", body: JSON.stringify(patch) }),
  listServices: (params?: { category?: string; featured?: boolean }): Promise<Service[]> => {
    const q = new URLSearchParams();
    if (params?.category) q.append("category", params.category);
    if (params?.featured !== undefined) q.append("featured", String(params.featured));
    const s = q.toString();
    return request(`/services${s ? `?${s}` : ""}`);
  },
  listProfessionals: (): Promise<Professional[]> => request("/professionals"),
  availability: (date: string, professional_id?: string): Promise<{ date: string; slots: { time: string; available: boolean }[] }> => {
    const q = new URLSearchParams({ date });
    if (professional_id) q.append("professional_id", professional_id);
    return request(`/availability?${q.toString()}`);
  },
  createAppointment: (body: { service_ids: string[]; professional_id?: string | null; date: string; time: string }): Promise<Appointment> =>
    request("/appointments", { method: "POST", body: JSON.stringify(body) }),
  listAppointments: (scope: "upcoming" | "past" | "all" = "all"): Promise<Appointment[]> =>
    request(`/appointments?scope=${scope}`),
  cancelAppointment: (id: string): Promise<Appointment> => request(`/appointments/${id}/cancel`, { method: "POST" }),
  rescheduleAppointment: (id: string, date: string, time: string): Promise<Appointment> =>
    request(`/appointments/${id}/reschedule`, { method: "POST", body: JSON.stringify({ date, time }) }),
  uploadPhoto: async (uri: string, name: string, type: string) => {
    const form = new FormData();
    if (require("react-native").Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as any);
    }
    const token = await authStorage.getToken();
    const res = await fetch(`${API_URL}/auth/me/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Falha no upload");
    return data as { photo_path: string };
  },
  photoUrl: async (path?: string | null) => {
    if (!path) return null;
    const token = await authStorage.getToken();
    return `${API_URL}/files/${path}${token ? `?token=${token}` : ""}`;
  },
};

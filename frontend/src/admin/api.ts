import { Platform } from "react-native";
import { adminStorage } from "./storage";
import type { Service } from "../api";

export const API_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api/admin";

async function request(path: string, init: RequestInit = {}, auth = true) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as any) };
  if (auth) {
    const token = await adminStorage.getToken();
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

export type AdminRole = "owner" | "staff";
export type AdminUser = { id: string; name: string; email: string; role: AdminRole; active?: boolean };
export type WorkDay = { start: string; end: string; off: boolean };
export type AdminProfessional = {
  id: string; name: string; specialties: string[]; photo_url?: string | null;
  work_hours: Record<string, WorkDay>; active: boolean;
};
export type ApptStatus = "scheduled" | "done" | "cancelled" | "no_show";
export type AdminAppointment = {
  id: string;
  client: { id: string | null; name: string; phone: string; email?: string | null };
  services: Service[];
  professional: AdminProfessional | null;
  date: string; time: string; end_time: string;
  total_duration_min: number; total_price: number;
  status: ApptStatus; source: "app" | "admin"; notes: string;
};
export type Block = { id: string; professional_id: string | null; date: string; start_time: string; end_time: string; reason: string };
export type Client = {
  id: string; name: string; phone: string; email?: string | null; photo_path?: string | null;
  internal_notes: string; created_at?: string; appointments_count?: number; last_visit?: string | null;
  history?: AdminAppointment[]; total_spent?: number;
};
export type OpeningDay = { open: string; close: string; closed: boolean };
export type Settings = { cancel_min_hours: number; slot_minutes: number; opening_hours: Record<string, OpeningDay>; days_off: string[] };
export type Dashboard = {
  today: string; today_count: number; week_count: number; new_clients_week: number; total_clients: number;
  occupancy_rate: number; upcoming_today: AdminAppointment[];
  finance?: { revenue_today: number; revenue_week: number; revenue_month: number; revenue_month_forecast: number };
  top_services?: { service_id: string; name: string; category: string; count: number; revenue: number }[];
};

const qs = (o: Record<string, any>) => {
  const q = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.append(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const adminApi = {
  login: (email: string, password: string): Promise<{ access_token: string; admin: AdminUser }> =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  me: (): Promise<AdminUser> => request("/me"),
  dashboard: (): Promise<Dashboard> => request("/dashboard"),

  listAppointments: (p: { date_from: string; date_to?: string; professional_id?: string | null; status?: string }): Promise<AdminAppointment[]> =>
    request(`/appointments${qs(p)}`),
  createAppointment: (body: {
    user_id?: string | null; client_name?: string; client_phone?: string; service_ids: string[];
    professional_id?: string | null; date: string; time: string; notes?: string; fit_in?: boolean;
  }): Promise<AdminAppointment> => request("/appointments", { method: "POST", body: JSON.stringify(body) }),
  updateAppointment: (id: string, body: { status?: ApptStatus; date?: string; time?: string; professional_id?: string | null; notes?: string; fit_in?: boolean }): Promise<AdminAppointment> =>
    request(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  availability: (date: string, professional_id?: string | null, duration_min = 30): Promise<{ date: string; slots: { time: string; available: boolean }[] }> =>
    request(`/availability${qs({ date, professional_id, duration_min })}`),

  listBlocks: (p: { date_from: string; date_to?: string; professional_id?: string | null }): Promise<Block[]> => request(`/blocks${qs(p)}`),
  createBlock: (body: { professional_id?: string | null; date: string; start_time: string; end_time: string; reason?: string }): Promise<Block> =>
    request("/blocks", { method: "POST", body: JSON.stringify(body) }),
  deleteBlock: (id: string) => request(`/blocks/${id}`, { method: "DELETE" }),

  listClients: (search?: string): Promise<Client[]> => request(`/clients${qs({ search })}`),
  getClient: (id: string): Promise<Client> => request(`/clients/${id}`),
  updateClient: (id: string, body: { name?: string; phone?: string; internal_notes?: string }): Promise<Client> =>
    request(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listServices: (): Promise<Service[]> => request("/services"),
  createService: (body: Omit<Service, "id">): Promise<Service> => request("/services", { method: "POST", body: JSON.stringify(body) }),
  updateService: (id: string, body: Partial<Omit<Service, "id">>): Promise<Service> => request(`/services/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteService: (id: string) => request(`/services/${id}`, { method: "DELETE" }),

  listProfessionals: (): Promise<AdminProfessional[]> => request("/professionals"),
  createProfessional: (body: Partial<Omit<AdminProfessional, "id">> & { name: string }): Promise<AdminProfessional> =>
    request("/professionals", { method: "POST", body: JSON.stringify(body) }),
  updateProfessional: (id: string, body: Partial<Omit<AdminProfessional, "id">>): Promise<AdminProfessional> =>
    request(`/professionals/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProfessional: (id: string) => request(`/professionals/${id}`, { method: "DELETE" }),
  uploadProfessionalPhoto: async (id: string, uri: string, name: string, type: string) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as any);
    }
    const token = await adminStorage.getToken();
    const res = await fetch(`${API_URL}/professionals/${id}/photo`, {
      method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Falha no upload");
    return data as { photo_url: string };
  },

  getSettings: (): Promise<Settings> => request("/settings"),
  updateSettings: (body: Partial<Settings>): Promise<Settings> => request("/settings", { method: "PATCH", body: JSON.stringify(body) }),

  listAdmins: (): Promise<AdminUser[]> => request("/admins"),
  createAdmin: (body: { name: string; email: string; password: string; role: AdminRole }): Promise<AdminUser> =>
    request("/admins", { method: "POST", body: JSON.stringify(body) }),
  deleteAdmin: (id: string) => request(`/admins/${id}`, { method: "DELETE" }),
};

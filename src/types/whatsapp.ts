export interface WhatsappConnection {
  id: string;
  userId: string;
  wabaId: string;
  phoneNumberId: string;
  phoneNumber: string;
  metaAccessToken: string;
  status: "connected" | "error" | "disconnected";
  createdAt: string;
  updatedAt: string;
}

export type NewWhatsappConnection = Omit<WhatsappConnection, "id" | "userId" | "createdAt" | "updatedAt">;
export type UpdateWhatsappConnection = Partial<Omit<WhatsappConnection, "id" | "userId" | "createdAt" | "updatedAt">>;

export interface WhatsappAISettings {
  id: string;
  user_id: string;
  workspace_id: string | null;
  enabled: boolean;
  allowed_numbers: string[];
  verified_numbers: string[];
  greeting_message: string;
  active_hours_start: number;
  active_hours_end: number;
  preferred_model: string | null;
  use_mcp: boolean;
  created_at: string;
  updated_at: string;
}

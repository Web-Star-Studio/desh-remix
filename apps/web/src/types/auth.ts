export interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

export interface GoogleConnection {
  id: string;
  google_user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
  workspace_id: string | null;
}

export interface Friend {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  friendship_id: string;
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_display_name?: string;
  from_avatar_url?: string;
  from_email?: string;
  to_display_name?: string;
  to_email?: string;
}

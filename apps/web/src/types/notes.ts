export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned?: boolean;
  tags?: string[];
  notebook?: string;
  favorited?: boolean;
  created_at?: string;
  updated_at?: string;
  workspace_id?: string | null;
  deleted_at?: string | null;
}

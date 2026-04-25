import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an image file to Supabase storage and return a public URL.
 * Stores under user-files/{userId}/note-images/{timestamp}-{name}
 */
export async function uploadNoteImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const ext = file.name.split(".").pop() || "png";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${user.id}/note-images/${safeName}`;

  const { error } = await supabase.storage
    .from("user-files")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("user-files")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

import { useState, useCallback } from "react";
import { useLateProxy } from "@/hooks/messages/useLateProxy";
import type { SocialMediaItem } from "@/types/social";

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  type: string;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      if (resp.ok || resp.status < 500) return resp;
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (err: any) {
      lastError = err;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error("Upload failed after retries");
}

export function useMediaUpload(lateProfileId?: string) {
  const { lateInvoke } = useLateProxy();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadMedia = useCallback(
    async (file: File): Promise<SocialMediaItem> => {
      if (!lateProfileId) throw new Error("Selecione um perfil");

      setIsUploading(true);
      setProgress(10);

      try {
        const docTypes = ["application/pdf", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        const fileType = file.type.startsWith("video/") ? "video" : docTypes.includes(file.type) ? "document" : "image";

        // Presign with retry
        let presignData: PresignResponse | null = null;
        for (let attempt = 0; attempt <= 2; attempt++) {
          const { data, error } = await lateInvoke<PresignResponse>(
            "/media/presign",
            "POST",
            { fileName: file.name, fileType: file.type },
          );
          if (!error && data) {
            presignData = data;
            break;
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          } else {
            throw new Error(error ?? "Falha ao obter URL de upload");
          }
        }

        setProgress(30);

        // Upload file with retry
        const uploadResp = await fetchWithRetry(presignData!.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResp.ok) throw new Error("Falha no upload do arquivo");

        setProgress(100);

        return {
          url: presignData!.publicUrl,
          type: fileType,
        };
      } finally {
        setIsUploading(false);
        setProgress(0);
      }
    },
    [lateProfileId, lateInvoke],
  );

  return { uploadMedia, isUploading, progress };
}

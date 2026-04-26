import { useCallback, useMemo } from "react";
import { executeComposioAction, ComposioExecuteError } from "@/lib/composio-client";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";

/**
 * Typed wrapper around Composio's googledrive toolkit. Replaces the legacy
 * `composio-proxy` edge function. Action slugs mirror
 * `components/admin/ComposioActionsTab.tsx`.
 */

export const DRIVE_ACTIONS = {
  FIND_FILE: "GOOGLEDRIVE_FIND_FILE",
  FIND_FOLDER: "GOOGLEDRIVE_FIND_FOLDER",
  GET_FILE_METADATA: "GOOGLEDRIVE_GET_FILE_METADATA",
  DOWNLOAD_FILE: "GOOGLEDRIVE_DOWNLOAD_FILE",
  DELETE_FILE: "GOOGLEDRIVE_DELETE_FILE",
  TRASH_FILE: "GOOGLEDRIVE_TRASH_FILE",
  CREATE_FOLDER: "GOOGLEDRIVE_CREATE_FOLDER",
  MOVE_FILE: "GOOGLEDRIVE_MOVE_FILE",
  COPY_FILE_ADVANCED: "GOOGLEDRIVE_COPY_FILE_ADVANCED",
  CREATE_FILE_FROM_TEXT: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT",
  EDIT_FILE: "GOOGLEDRIVE_EDIT_FILE",
  EXPORT_WORKSPACE_FILE: "GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE",
  UPLOAD_FILE: "GOOGLEDRIVE_UPLOAD_FILE",
  CREATE_PERMISSION: "GOOGLEDRIVE_CREATE_PERMISSION",
  LIST_REVISIONS: "GOOGLEDRIVE_LIST_REVISIONS",
} as const;

export type DriveAction = (typeof DRIVE_ACTIONS)[keyof typeof DRIVE_ACTIONS];

export function useDriveActions() {
  const workspaceId = useComposioWorkspaceId();

  const execute = useCallback(
    <T = unknown>(action: DriveAction, args: Record<string, unknown> = {}) =>
      executeComposioAction<T>(workspaceId, "googledrive", action, args),
    [workspaceId],
  );

  return useMemo(
    () => ({
      execute,
      findFiles: <T = unknown>(args: Record<string, unknown> = {}) => execute<T>(DRIVE_ACTIONS.FIND_FILE, args),
      findFolders: <T = unknown>(args: Record<string, unknown> = {}) => execute<T>(DRIVE_ACTIONS.FIND_FOLDER, args),
      getMetadata: <T = unknown>(fileId: string) => execute<T>(DRIVE_ACTIONS.GET_FILE_METADATA, { file_id: fileId }),
      downloadFile: <T = unknown>(args: Record<string, unknown>) => execute<T>(DRIVE_ACTIONS.DOWNLOAD_FILE, args),
      deleteFile: <T = unknown>(fileId: string) => execute<T>(DRIVE_ACTIONS.DELETE_FILE, { file_id: fileId }),
      trashFile: <T = unknown>(fileId: string) => execute<T>(DRIVE_ACTIONS.TRASH_FILE, { file_id: fileId }),
      createFolder: <T = unknown>(args: Record<string, unknown>) => execute<T>(DRIVE_ACTIONS.CREATE_FOLDER, args),
      moveFile: <T = unknown>(args: Record<string, unknown>) => execute<T>(DRIVE_ACTIONS.MOVE_FILE, args),
      uploadFile: <T = unknown>(args: Record<string, unknown>) => execute<T>(DRIVE_ACTIONS.UPLOAD_FILE, args),
      createFromText: <T = unknown>(args: Record<string, unknown>) => execute<T>(DRIVE_ACTIONS.CREATE_FILE_FROM_TEXT, args),
    }),
    [execute],
  );
}

export { ComposioExecuteError };

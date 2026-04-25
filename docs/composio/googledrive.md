# Google Drive — Composio Actions (Official)

Source: https://docs.composio.dev/toolkits/googledrive

## Actions

| Action | Description |
|--------|-------------|
| `GOOGLEDRIVE_FIND_FILE` | Search/list files (replaces LIST_FILES) |
| `GOOGLEDRIVE_GET_FILE_METADATA` | Get file metadata by ID |
| `GOOGLEDRIVE_UPLOAD_FILE` | Upload a file |
| `GOOGLEDRIVE_EDIT_FILE` | Edit/rename/move file metadata |
| `GOOGLEDRIVE_DELETE_FILE` | Permanently delete a file |
| `GOOGLEDRIVE_TRASH_FILE` | Move file to trash |
| `GOOGLEDRIVE_MOVE_FILE` | Move file to different folder |
| `GOOGLEDRIVE_DOWNLOAD_FILE` | Download file content |
| `GOOGLEDRIVE_COPY_FILE_ADVANCED` | Copy a file (replaces COPY_FILE) |
| `GOOGLEDRIVE_CREATE_FOLDER` | Create a folder |
| `GOOGLEDRIVE_FIND_FOLDER` | Search for folders |
| `GOOGLEDRIVE_CREATE_FILE_FROM_TEXT` | Create file from text content |
| `GOOGLEDRIVE_CREATE_PERMISSION` | Share file/set permissions |
| `GOOGLEDRIVE_LIST_REVISIONS` | List file version history |
| `GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE` | Export Docs/Sheets as PDF etc. |

> **Deprecated:** `GOOGLEDRIVE_LIST_FILES` → use `GOOGLEDRIVE_FIND_FILE`
> **Deprecated:** `GOOGLEDRIVE_COPY_FILE` → use `GOOGLEDRIVE_COPY_FILE_ADVANCED`
> **Non-existent:** `GOOGLEDRIVE_GET_FILE_BY_ID` → use `GOOGLEDRIVE_GET_FILE_METADATA`
> **Non-existent:** `GOOGLEDRIVE_SEARCH_FILE` → use `GOOGLEDRIVE_FIND_FILE`

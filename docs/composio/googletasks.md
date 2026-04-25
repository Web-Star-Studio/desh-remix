# Google Tasks — Composio Actions (Official)

Source: https://docs.composio.dev/toolkits/googletasks

## Actions

| Action | Description |
|--------|-------------|
| `GOOGLETASKS_LIST_TASK_LISTS` | List all task lists |
| `GOOGLETASKS_LIST_TASKS` | List tasks in a task list |
| `GOOGLETASKS_LIST_ALL_TASKS` | List tasks from all lists |
| `GOOGLETASKS_GET_TASK` | Get a single task by ID |
| `GOOGLETASKS_INSERT_TASK` | Create a new task |
| `GOOGLETASKS_PATCH_TASK` | Partially update a task (preferred) |
| `GOOGLETASKS_UPDATE_TASK_FULL` | Fully replace a task |
| `GOOGLETASKS_DELETE_TASK` | Delete a task |
| `GOOGLETASKS_MOVE_TASK` | Reorder/reparent a task |
| `GOOGLETASKS_CLEAR_TASKS` | Clear completed tasks from a list |

> **Note:** `GOOGLETASKS_UPDATE_TASK` is deprecated. Use `GOOGLETASKS_PATCH_TASK` instead.

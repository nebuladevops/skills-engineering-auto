# ClickUp Skill — API & Workflow Reference

Companion reference for `skill.md`. Contains the full command surface, workflow recipes, and Python-client usage.

The CLI assumes the client has been installed to `~/.claude/skills/clickup/scripts/clickup_client.py`. All commands accept `key=value` arguments after the command name.

---

## Workspace Hierarchy

```
Team (Workspace)
├── Spaces
│   ├── Folders
│   │   └── Lists → Tasks
│   └── Lists (Folderless) → Tasks
└── Documents
```

All operations require explicit workspace identification via IDs.

---

## Workflows

### Create a task in a specific workspace

1. `get_teams` → workspace ID
2. `get_spaces team_id="<id>"` → space ID
3. `get_folders space_id="<id>"` → folder ID, then `get_lists folder_id="<id>"` → list ID
4. `create_task list_id="<id>" name="<verb + object>" …` (apply the Nebula Task Protocol from `skill.md`)

### Configure space statuses

```bash
python scripts/clickup_client.py update_space \
  space_id="<id>" \
  'statuses=[{"status":"To Do","type":"open"},{"status":"Done","type":"closed"}]'
```

### Track time on a task

Manual entry:
```bash
python scripts/clickup_client.py create_time_entry \
  team_id="<id>" task_id="<id>" \
  duration=3600000 description="Worked on feature"
```

Timer:
```bash
python scripts/clickup_client.py start_timer team_id="<id>" task_id="<id>"
python scripts/clickup_client.py stop_timer  team_id="<id>"
```

### Document structure

```bash
python scripts/clickup_client.py create_doc workspace_id="<id>" name="Project Docs"
```

Pages must currently be created via the ClickUp UI (the pages API is in beta). Documents use API v3 — note `workspace_id` instead of `team_id`.

### Reporting & analytics

```bash
# All tasks (auto-paginated, subtasks always included)
python scripts/clickup_client.py get_all_tasks team_id="<id>"

# Counts breakdown: total / parents / subtasks / unassigned
python scripts/clickup_client.py task_counts team_id="<id>"

# Workload by assignee
python scripts/clickup_client.py assignee_breakdown team_id="<id>"

# Tasks grouped by status
python scripts/clickup_client.py status_breakdown team_id="<id>"

# Tasks grouped by priority
python scripts/clickup_client.py priority_breakdown team_id="<id>"

# Daily standup report
python scripts/clickup_client.py standup_report team_id="<id>"
python scripts/clickup_client.py standup_report team_id="<id>" assignee_id="<user_id>"
```

Filter reports by space or assignee:
```bash
python scripts/clickup_client.py task_counts team_id="<id>" space_ids='["SPACE_ID"]'
python scripts/clickup_client.py get_all_tasks team_id="<id>" assignees='["12345"]'
python scripts/clickup_client.py task_counts team_id="<id>" include_closed="true"
```

**Critical rules for reporting:**
1. **Always include subtasks** — handled automatically via `subtasks=true`
2. **Pagination handled** — `get_all_tasks` loops until all pages retrieved
3. **Parent vs subtask** — parents have `parent: null`, subtasks have `parent: "task_id"`
4. **Rate limit** — 100 req/min; pagination respects this

### Link a doc to a task

```bash
python scripts/clickup_client.py link_doc_to_task task_id="<id>" doc_id="<id>"      # attach URL
python scripts/clickup_client.py mention_doc_in_task task_id="<id>" doc_id="<id>"   # in description
```

### Task dependencies (blocking / waiting on)

```bash
# Task B is blocked by / waiting on Task A
python scripts/clickup_client.py add_dependency task_id="TASK_B" depends_on="TASK_A"
# Task A is blocking Task B
python scripts/clickup_client.py add_dependency task_id="TASK_A" waiting_on="TASK_B"

python scripts/clickup_client.py get_dependencies task_id="<id>"
python scripts/clickup_client.py remove_dependency task_id="<id>" depends_on="<id>"
```

### Arbitrary task linking (non-dependency)

```bash
python scripts/clickup_client.py link_tasks   task_id="A" links_to="B"
python scripts/clickup_client.py unlink_tasks task_id="A" links_to="B"
```

`link_tasks` appears under "Linked Tasks" in the UI; `add_dependency` appears as a blocking relationship.

### Bulk task operations

```bash
TASKS=$(python scripts/clickup_client.py get_tasks list_id="<id>")
# Parse JSON and loop in your shell of choice.
```

---

## Command Reference

```bash
python scripts/clickup_client.py <command> [key=value …]
```

### Workspace
- `get_teams`

### Spaces
- `get_spaces team_id="<id>"`
- `create_space team_id="<id>" name="<name>" [options…]`
- `update_space space_id="<id>" [options…]`

### Folders
- `get_folders space_id="<id>"`
- `create_folder space_id="<id>" name="<name>"`

### Lists
- `get_lists folder_id="<id>"`
- `get_space_lists space_id="<id>"`
- `create_list folder_id="<id>" name="<name>" [options…]`
- `create_space_list space_id="<id>" name="<name>" [options…]`

### Tasks
- `get_task task_id="<id>"`
- `get_tasks list_id="<id>" [filters…]`
- `create_task list_id="<id>" name="<name>" [options…]`
- `update_task task_id="<id>" [options…]`

### Time tracking
- `get_time_entries team_id="<id>" [filters…]`
- `create_time_entry team_id="<id>" task_id="<id>" duration=<ms> [options…]`
- `start_timer team_id="<id>" task_id="<id>"`
- `stop_timer  team_id="<id>"`

### Docs (API v3)
- `get_docs workspace_id="<id>"`
- `create_doc workspace_id="<id>" name="<name>" [options…]`
- `get_doc doc_id="<id>"`
- `link_doc_to_task task_id="<id>" doc_id="<id>"`
- `mention_doc_in_task task_id="<id>" doc_id="<id>"`

### Dependencies & linking
- `add_dependency task_id="<id>" {depends_on|waiting_on}="<id>"`
- `remove_dependency task_id="<id>" depends_on="<id>"`
- `get_dependencies task_id="<id>"`
- `link_tasks   task_id="<id>" links_to="<id>"`
- `unlink_tasks task_id="<id>" links_to="<id>"`

### Reporting
- `get_all_tasks team_id="<id>" [include_closed="true"] [space_ids='["id"]'] [assignees='["uid"]']`
- `task_counts team_id="<id>" [filters…]`
- `assignee_breakdown team_id="<id>" [filters…]`
- `status_breakdown team_id="<id>" [filters…]`
- `priority_breakdown team_id="<id>" [filters…]`
- `standup_report team_id="<id>" [assignee_id="<uid>"]`

---

## Python Client Usage

For complex operations, import the client directly:

```python
import sys
sys.path.insert(0, "/Users/<you>/.claude/skills/clickup/scripts")
from clickup_client import ClickUpClient

client = ClickUpClient()

teams = client.get_teams()

task = client.create_task(
    list_id="901712856936",
    name="Implementar reintento automático en login con Magic Link",
    description=(
        "Como médico, quiero reintentar el login automáticamente "
        "para no perder tiempo cuando el correo demora.\n\n"
        "CRITERIOS DE ACEPTACIÓN\n"
        "- [ ] Reintento automático máximo 3 veces con backoff exponencial\n"
        "- [ ] Mensaje de error claro tras el último intento\n"
    ),
    assignees=[<user_id>],
    tags=["backend"],
    priority=2,
    time_estimate=21600000,  # 3 points
)

# Required custom fields for the Requests list (see skill.md for the full table)
client.set_custom_field(task["id"], "29669c15-...", "<item_type_option_id>")
```

---

## Sprint Points Convention

1 sprint point = 2 hours. Use this to convert estimated hours to points when setting `time_estimate`:

| Points | `time_estimate` (ms) |
|--------|----------------------|
| 1 | 7,200,000 |
| 2 | 14,400,000 |
| 3 | 21,600,000 |
| 5 | 36,000,000 |
| 8 | 57,600,000 |

Always set `time_estimate` (in milliseconds) on every task. Estimate effort honestly based on complexity, not desired velocity.

---

## Custom fields

To work with custom fields:

1. Get field definitions: `GET /list/{list_id}/field` (see the official ClickUp API docs)
2. Set values:
   ```bash
   python scripts/clickup_client.py update_task \
     task_id="<id>" \
     'custom_fields=[{"id":"<field_id>","value":"<value>"}]'
   ```

Or use `set_custom_field` directly from the Python client — see the Requests-list block in `skill.md` for the Nebula-specific IDs.

---

## Best Practices

1. **Store IDs**: Workspace, space, folder, and list IDs rarely change. Keep the canonical list in `skill.md`.
2. **Custom Task IDs**: when using custom IDs, always pass `custom_task_ids=true` and `team_id`.
3. **Rate limiting**: space out bulk operations to avoid 429 errors.
4. **Time tracking**: all durations and timestamps are in milliseconds.
5. **Multi-workspace**: always double-check `team_id` before write operations.

---

## References

- ClickUp API documentation: <https://clickup.com/api>
- Nebula Task Protocol (long form): [protocol.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/protocol.md)

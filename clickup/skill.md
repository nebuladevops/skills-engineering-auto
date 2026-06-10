---
name: clickup
description: "ClickUp integration for the Nebula Medical engineering team, with built-in enforcement of the Protocolo de tareas Nebula – DevOps (mayo–junio 2026). Every AI-created task must meet Definition of Ready: title verb+object, user story (Como [rol], quiero [acción] para [beneficio]), ≥2 verifiable acceptance criteria, Sprint points estimation 1/2/3/5/8, owner (R) + Accountable (A) per the Tabla Raci, dependencies mapped or 'Sin dependencias', type (feature|bug-N1|bug-N2|bug-N3|técnica|compliance|research), priority (Urgente/Alta/Media/Baja). Definition of Done varies by type (técnica/clínica/bug/compliance). Bugs require pasos para reproducir, ambiente, evidencia, severidad N1/N2/N3. Hard rules: Sogamoso bugs forced to N1/N2 with sogamoso label, clinical features require Santi sign-off criterion, 8-point tasks must be split, sprint capacity capped at 20 points, pagos tasks must consider tokenización 3D Secure, AI-model/prompt decisions consult key physicians. Capabilities: multi-workspace task CRUD, advanced reporting with auto-subtask inclusion, time tracking, ClickUp Docs (API v3), task dependencies and linking, custom-field management. Companion Python client: clickup_client.py. Invoked as /clickup."
---

# ClickUp Skill — /clickup

You are the ClickUp project-management assistant for the Nebula Medical engineering team. You enforce the **Protocolo de tareas Nebula – DevOps** (versión inicial, definiciones de mayo–junio 2026 — complementa la página Tabla Raci en Team Operations) on every task this skill creates, and provide CRUD + reporting access to the team's ClickUp workspace through the companion Python client.

**Scope:** the protocol applies to the **DevOps space**, especially the **Dev Sprints** folder (all active sprints) and the **Bug Tracking** list; optionally Product Backlog, Requests, and QA / Test Scenarios & Cases.

## Companion Files

- **Python client:** [clickup_client.py](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/clickup_client.py)
- **Protocol detail:** [protocol.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/protocol.md)
- **API & workflow reference:** [reference.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/reference.md)

---

## Install

When invoked via `curl …/clickup/skill.md`, install the skill locally with these steps:

1. Create the skill directory:
   ```bash
   mkdir -p ~/.claude/skills/clickup/scripts
   ```
2. Save this file as `~/.claude/skills/clickup/SKILL.md`.
3. Fetch the companion Python client:
   ```bash
   curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/clickup_client.py \
     -o ~/.claude/skills/clickup/scripts/clickup_client.py
   ```
4. Fetch the protocol and reference:
   ```bash
   curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/protocol.md \
     -o ~/.claude/skills/clickup/protocol.md
   curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/reference.md \
     -o ~/.claude/skills/clickup/reference.md
   ```
5. Set the ClickUp API token. The skill reads `CLICKUP_API_TOKEN` from the environment. Ask the user for their token (ClickUp → Settings → Apps → Generate API Token) and add it to `~/.claude/settings.json`:
   ```json
   {
     "env": {
       "CLICKUP_API_TOKEN": "pk_xxxxxxxxxxxxxxxxxxxxxxx"
     }
   }
   ```
   Verify with: `python3 ~/.claude/skills/clickup/scripts/clickup_client.py get_teams`

If the token is missing, the client exits with `ERROR: CLICKUP_API_TOKEN environment variable not set.` — prompt the user for it and write it to settings.json before retrying.

---

## Hard Constraints — Protocolo de tareas Nebula – DevOps

Every `create_task` call this skill produces MUST satisfy these rules. If any rule fails, ask the user once; if still unresolved, create the task in the Backlog with status `incompleta — necesita definición` — never silently create a non-compliant task in a sprint list.

### Required fields (Definition of Ready — all 5 criteria)

| Field | Rule |
|-------|------|
| `name` (Título) | Verb + object (infinitive/gerund), specific and actionable. ❌ "Pendientes", "Varios temas", "arreglar login" — ✅ "Implementar reintento automático en login con Magic Link" |
| `description` line 1 | User story: `Como [rol], quiero [acción] para [beneficio]`. Always for features, relevant bugs, research, product/UX; may be omitted only for trivial operational micro-tasks |
| `description` body | Section `CRITERIOS DE ACEPTACIÓN` with ≥2 verifiable `- [ ]` items (each objectively pass/fail) |
| `description` body | Dependencies mapped explicitly (related task IDs) or the line `Sin dependencias` |
| **Sprint points** | Canonical estimation field (custom field `Sprint points`, scale 1/2/3/5/8 — discover the field id per list with `get_list_fields`). Mirror to `time_estimate` ms for reporting (1=7,200,000 • 2=14,400,000 • 3=21,600,000 • 5=36,000,000 • 8=57,600,000) |
| `assignees` (R) | At least one assignee; one principal owner recommended — split into subtasks for others |
| **Accountable** (A) | Custom field `Accountable`: exactly ONE person, matching the A in the Tabla Raci for the process (e.g. Seguridad & Compliance Técnico → Max; Infraestructura/DevOps → Oscar) |
| Type | One of: `feature`, `bug-N1`, `bug-N2`, `bug-N3`, `técnica`, `compliance`, `research` (set via tags + Item Type custom field + NOTAS) |
| `priority` | 1=Urgente, 2=Alta, 3=Media, 4=Baja — always set |

**C / I (Consulted / Informed):** no dedicated field — mention C people in comments when their input is needed (add as watchers), and mention I people in a closing comment or wherever the result is communicated.

### Type → minimum priority

| Type | Min priority | Sprint placement |
|------|--------------|------------------|
| `bug-N1` | 1 Urgente | Current sprint immediately |
| `bug-N2` | 2 Alta | Next sprint |
| `compliance` | 2 Alta | Next sprint |
| `feature` | 3 Media | Next sprint |
| `técnica` | 3 Media | Next sprint |
| `research` | 3 Media | Next sprint |
| `bug-N3` | 4 Baja | Backlog (grouped into tech-debt sprints) |

### Bug documentation — mandatory for every bug (N1/N2/N3)

The description MUST include: (1) clear problem description, (2) **pasos para reproducir** numbered, (3) **ambiente** (producción / staging / local), (4) **evidencia** (video or screenshots), (5) **severidad** declared: N1, N2 or N3.

### Definition of Done (checked before marking complete — varies by type)

| Type | DoD |
|------|-----|
| Feature técnica | PR merged with ≥1 reviewer · relevant tests passing in staging · all acceptance criteria checked · no open critical errors tied to the feature |
| Feature clínica | All of the above **+** explicit clinical sign-off from Santi or a panel physician (comment/evidence on the task) |
| Bug | Fix deployed (ideally production) · regression steps executed and documented · explicit verification by the reporter or designated QA |
| Compliance / seguridad | Technical-feature DoD **+** audit log verified when applicable · RBAC/permissions review if relevant · recorded in the compliance registry |

### Hard rules — refuse and re-prompt if violated

1. **Sogamoso bugs**: always `bug-N1` or `bug-N2` (never N3), priority Urgente or Alta, label `sogamoso` mandatory.
2. **Clinical features**: any task touching the clinical flow (historia clínica, scribe output, médico-facing UI) MUST include this acceptance criterion verbatim:
   `- [ ] Sign-off clínico de Santi o médico del panel de Sogamoso`
   Clinical QA is done by physicians, not the tech team — Mónica facilitates QA sessions; final clinical evaluation belongs to physicians.
3. **8-point tasks**: warn the user and propose splitting before creating.
4. **Sprint capacity**: a sprint list caps at 20 points (144,000,000 ms total `time_estimate`). If exceeded, stop and tell the user to move lower-priority items to Backlog first.
5. **Decisions are not tasks**: if the user describes a decision ("decidimos que X"), do NOT create a task — suggest documenting in the meeting's Decisiones section.
6. **Never default to Closed**: when creating or updating a task — even one linked to an already-merged PR — never use a "done"-type status (`Closed`, `ready for deployment`, `not doing`) unless the user explicitly asks for it. Default to a visible/active status like `in review` or `Open`. ClickUp's default views hide done-status tasks, so closing one "disappears" it from the team's view even if follow-up work (deploy validation, cleanup decisions) is still pending. Closing is the user's call, not the skill's.
7. **Pagos / suscripciones**: any payments or subscriptions task must consider **tokenización (3D Secure)** — Wompy does not do recurring charges by default. If the description doesn't mention it, add an acceptance criterion or flag it to the user.
8. **AI models / medical prompts**: decisions about model behavior or medical prompts require **C** (Consulted) of the key physicians — Mateo, Vale, Pablo, Santi. Plan to mention them in comments; Scribe outputs are clinical.
9. **RACI coherence**: on every relevant task, verify R (assignees) and A (Accountable field) against the Tabla Raci, and that there is a reasonable plan for C and I.

### Owners — Nebula team

| Person | Areas |
|--------|-------|
| Oscar Vélez | backend, DevOps, infra Azure, arquitectura, Langsmith, autenticación |
| Tomás Espitia | frontend, fullstack, formularios, exportación de historias |
| Mónica Rojas | Head of Frontend + coordinación QA clínico |
| Luka (Daniel Díaz) | diseño UI, Figma |
| Max Duque | CTO: arquitectura macro, compliance HIPAA/Habeas Data |
| Santi Suárez | CIO/médico: valida features clínicas, sign-off |
| Eri Pardo | COO: prioridades comerciales, clientes |
| Mateo, Vale, Pablo, Santi | Médicos clave — Consulted en decisiones de modelos de IA / prompts médicos |

### Labels

`clinical` · `compliance` · `hipaa` · `sogamoso` · `miami` · `ux` · `backend` · `frontend` · `infra` · `ai` · `pagos` · `deuda-tecnica`

### Task description template (plain text — ClickUp does NOT render Markdown)

```
Como [rol], quiero [acción] para [beneficio].

CONTEXTO
- [breve contexto opcional, links a Figma/tickets relacionados]

CRITERIOS DE ACEPTACIÓN
- [ ] [criterio verificable #1]
- [ ] [criterio verificable #2]
- [ ] Sign-off clínico de Santi o médico del panel — (solo si toca flujo clínico)

DEPENDENCIAS
- [IDs de tareas relacionadas, o "Sin dependencias"]

NOTAS
- Tipo: [feature|bug-N1|bug-N2|bug-N3|técnica|compliance|research]
- Estimación: [1|2|3|5|8] puntos
- Owner (R): [nombre]
- Accountable (A): [nombre según Tabla Raci]
```

For bugs, add this block before NOTAS:

```
PASOS PARA REPRODUCIR
1. [paso]
2. [paso]

AMBIENTE
- [producción | staging | local]

EVIDENCIA
- [link a video o capturas]

SEVERIDAD
- [N1 | N2 | N3]
```

### Pre-create checklist (run silently before every `create_task`)

- [ ] Title is verb + object
- [ ] First description line is `Como ... quiero ... para ...` (or justified trivial micro-task)
- [ ] ≥2 acceptance criteria present
- [ ] Dependencies mapped or `Sin dependencias` stated
- [ ] Sprint points set (1/2/3/5/8) + `time_estimate` mirror; < 8 points OR user confirmed split is not feasible
- [ ] At least one assignee (R), one principal owner
- [ ] Accountable (A) set to exactly one person, coherent with the Tabla Raci
- [ ] Type + Priority consistent with the table above
- [ ] Sogamoso → N1/N2 + `sogamoso` label + Urgente/Alta
- [ ] Bug → pasos para reproducir + ambiente + evidencia + severidad declarada
- [ ] Clinical flow → sign-off criterion present
- [ ] Pagos/suscripciones → tokenización (3D Secure) considered
- [ ] AI model / medical prompt decision → C plan for Mateo, Vale, Pablo, Santi
- [ ] Sprint capacity not exceeded (if creating in sprint list)

For the full protocol, owner-routing logic, and the meeting-transcript extraction workflow (Camino A), read [protocol.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/protocol.md).

---

## Invocation Modes

```bash
# Conversational — most common
/clickup                                              # interactive: ask what to do
/clickup crear tarea: <descripción libre>             # Camino C (own task with AI)
/clickup procesar transcripción                       # Camino A (extract from meeting)
/clickup reporte standup                              # standup report from team_id
/clickup tareas de <persona>                          # workload by assignee

# Direct CLI to the Python client
python ~/.claude/skills/clickup/scripts/clickup_client.py <command> [key=value …]
```

---

## Task Description Formatting (plain text only)

ClickUp does NOT render Markdown. Rules:
- No `**bold**`, no `` `backticks` ``, no `###` headers
- Use `ALL CAPS` for section titles (CONTEXTO, CRITERIOS DE ACEPTACIÓN, NOTAS)
- Use plain dashes for lists; `- [ ]` becomes a real checkbox in ClickUp
- Separate sections with a blank line
- No tables in descriptions

---

## Nebula Workspace — Known IDs (do NOT change these)

These IDs are specific to the Nebula Medical workspace. If the skill is reused in another workspace they must be replaced.

- Workspace (team_id): `90171026229`
- DevOps space: `90175182130`
- Backlog → Requests list: `901712856936`
- Daily async chat channel: `6-901714017941-8`

#### Requests list — available statuses (901712856936)

In order: `Open` (open) → `considering` → `scoping` → `prioritized` → `in design` → `in development` → `in review` → `ready for deployment` (done) → `not doing` (done) → `Closed` (closed).

Active statuses (visible in default views): `Open`, `considering`, `scoping`, `prioritized`, `in design`, `in development`, `in review`. Use `in review` as the default landing status when a task's work is already underway (PR opened or merged but still pending verification/deploy).

#### Member user IDs

Don't hardcode user IDs — fetch on demand with `get_teams`:

```bash
python3 ~/.claude/skills/clickup/scripts/clickup_client.py get_teams | \
  python3 -c "
import json, sys
for t in json.load(sys.stdin):
    if t['id'] == '90171026229':
        for m in t.get('members', []):
            u = m.get('user', {})
            print(f\"{u.get('id')}  {u.get('username')}  {u.get('email')}\")
"
```

Use the returned `id` directly in `assignees=[...]` when creating tasks.

### Required custom fields for the Requests list (`901712856936`)

EVERY task created in the Requests list MUST have all of these custom fields set via `set_custom_field` after creation. Use the Python client directly (the CLI does not yet expose `set_custom_field`):

```python
from clickup_client import ClickUpClient
client = ClickUpClient()

task = client.create_task(
    list_id="901712856936",
    name="<verb + object>",
    description="<protocol-compliant description>",
    status="Open",
    time_estimate=<ms from points>,
    priority=<1-4>,
    assignees=[<user_id>],
)
task_id = task["id"]

client.set_custom_field(task_id, "29669c15-6017-4960-bb8f-2ad3fd279194", "<item_type_option_id>")  # Item Type
client.set_custom_field(task_id, "1916d31f-2c89-4b7d-ac71-815bce287dd2", "<moscow_option_id>")     # MoSCoW
client.set_custom_field(task_id, "cadff3d3-6cbc-4d40-bc9d-841dbf18df20", <1-5>)                    # Impact
client.set_custom_field(task_id, "d963058c-fdd4-47d4-90a5-cbe2972d35f0", <1-5>)                    # Effort
client.set_custom_field(task_id, "2f4d1a59-3a22-4536-852d-16a76cefc2d3", "<initiative_option_id>") # Initiative
client.set_custom_field(task_id, "234c0aae-4408-44b0-8700-c717d13386c7", False)                    # Leadership Request
```

#### Item Type options (`29669c15-…`)
- `3b858596-bf76-4231-bb0e-bc307dc9eec9` = Product
- `1a57a38b-268b-4acc-ba3e-95c0657d3e0e` = Epic
- `5f8bba63-8a23-4803-8936-b0c7c4f1d809` = Feature
- `8b57cba7-9284-4875-af09-18aedaff5b11` = User Story
- `2c0006c0-fe15-4d27-b9e5-16a2dc0d7bc5` = Task
- `f7b0920f-fb32-472a-ade6-429e17ccebed` = QA
- `e1e73acc-9822-4727-bd62-1eb12ba2926f` = Bug

#### MoSCoW options (`1916d31f-…`)
- `96832c19-582e-41df-9e22-9ea438633848` = Must Have
- `f2823a5d-4610-4f09-9ff5-fe4ab5390617` = Should Have
- `326f13d4-b5af-4994-90cf-d7cf1dc16d8d` = Could Have
- `68f86d70-4157-454a-b76d-b8c3c671023b` = Would Have

#### Initiative options (`2f4d1a59-…`)
- `fe9e14bc-97d1-4e49-8016-9de1c36556c7` = Aumentar velocidad y rendimiento
- `bb1039f8-7590-4c06-89e1-7031663175ef` = Incrementar el CSAT
- `0963c7e3-a9c7-4a98-aa8f-92ce228d8c26` = Mejorar protocolos
- `26143d27-3db1-43ba-baf9-5433d7c4f18a` = Reducir vulnerabilidades del sistema
- `c06600dc-f453-4cd5-8a2e-447101287dfe` = Mejorar la usabilidad
- `f44d82e8-ac84-4b27-8019-b561ee220ae3` = Mejorar la calidad
- `996bdd53-e7ba-45be-bad9-4141c08f1e26` = Mejorar interfaces
- `b5786db0-dede-407a-879f-73e912d6679c` = Testear la calidad

---

## Quick Reference — most-used commands

```bash
# Workspaces, spaces, lists
python scripts/clickup_client.py get_teams
python scripts/clickup_client.py get_spaces team_id="90171026229"
python scripts/clickup_client.py get_lists folder_id="<folder_id>"

# Tasks
python scripts/clickup_client.py create_task list_id="<id>" name="<verb + object>" \
  description="<protocol-compliant>" priority=2 time_estimate=21600000
python scripts/clickup_client.py update_task task_id="<id>" status="in progress"
python scripts/clickup_client.py get_task task_id="<id>"

# Reporting (always includes subtasks; pagination automatic)
python scripts/clickup_client.py task_counts team_id="90171026229"
python scripts/clickup_client.py assignee_breakdown team_id="90171026229"
python scripts/clickup_client.py standup_report team_id="90171026229"
```

Full command list, dependency/linking workflows, and time-tracking examples are in [reference.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/clickup/reference.md).

---

## Priority Levels

`1` = Urgent · `2` = High · `3` = Normal · `4` = Low

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/missing API token | Check `CLICKUP_API_TOKEN` in `~/.claude/settings.json` |
| `404 Not Found` | Invalid ID | Verify workspace/space/list/task IDs — Nebula IDs above are for `nebula.med` only |
| `429 Too Many Requests` | Rate limit (100 req/min) | Wait and retry; our pagination respects this |
| `400 Bad Request` | Invalid parameters | Check JSON format in arguments |

If you are using this skill outside the Nebula workspace, replace the Known IDs section before running any task-creation command — the IDs above will return 404.

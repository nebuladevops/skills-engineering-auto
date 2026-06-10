# Protocolo de tareas Nebula – DevOps

Versión inicial basada en definiciones de mayo–junio 2026. Supersedes the v1.0 protocol (`protocolo-tareas.docx`). Complementa a la página **Tabla Raci** en Team Operations.

This document is the long-form reference for the protocol enforced by the `clickup` skill. The summary in `skill.md` is sufficient for routine task creation; consult this file for edge cases, DoR/DoD disputes, RACI mapping, and meeting-transcript workflows.

---

## 1. Purpose and scope

This protocol defines what a well-formed DevOps task is and how it must be configured so that:

- It enters a sprint only when truly ready (**Definition of Ready / DoR**).
- It is marked complete only when it meets objective criteria (**Definition of Done / DoD**).
- It is consistent with the tech **RACI matrix** (who executes, who is accountable, who is consulted, who is informed).
- It can be reviewed and audited easily by people and by the ClickUp agent (**CTO Brain**).

Applies to tasks in the **DevOps space**, especially:

- Folder **Dev Sprints** (all active sprints).
- List **Bug Tracking**.
- (Optional, future) Product Backlog, Requests, QA / Test Scenarios & Cases.

---

## 2. Required fields — every task

A DevOps task is well-formed when it meets ALL of these minimums:

| Field | Rule | Example |
|-------|------|---------|
| Título | Verb + object, clear and actionable | "Migrar pay-gateway a Bun + Elysia + Biome", "Realizar QA completo del Scribe y documentar bugs encontrados". Antipatterns: "Pendientes", "Varios temas", "Cosas por hacer" |
| Historia de usuario | ≥1 line in the description: `Como [rol], quiero [acción] para [beneficio]` | "Como médico, quiero filtrar por fecha para encontrar consultas recientes más rápido" |
| Criterios de aceptación | Block `CRITERIOS DE ACEPTACION` with ≥2 `- [ ]` items, each objective and verifiable without ambiguity | — |
| Sprint points | Canonical estimation field: **Sprint points** custom field, scale 1/2/3/5/8 | 3 |
| Owner (R) | At least one assignee responsible for execution; recommended: one principal owner, subtasks for others | Oscar |
| Item Type | Coherent with the work (Task, QA, Bug, …) | Bug |
| Priority | Urgent / High / Normal / Low — always set | High |
| Tags | Systematic context tags: `backend`, `frontend`, `infra`, `ai`, `clinical`, `compliance`, `hipaa`, `sogamoso`, `pagos`, … | `backend`, `sogamoso` |

The user story applies always for features, relevant bugs, research, and product/UX tasks. It may be omitted for purely operational micro-tasks (upload a file, trivial move), but include it by default.

### Sprint points guide

| Points | Meaning |
|--------|---------|
| 1 | Very small task (< 2 hours) |
| 2 | ~Half a day |
| 3 | ~1 day, some complexity |
| 5 | 2–3 days, complex or with dependencies |
| 8 | Too large — must normally be split before execution |

**Rule:** every task entering a sprint must have Sprint points set.

---

## 3. Task types

Logical task types (expressed via Item Type + tags + the NOTAS text; it must be clear which type applies so the right DoD is used):

| Type | Definition | Usual min priority |
|------|-----------|--------------------|
| `feature` | New functionality that did not exist before. Usually Item Type = Task + layer tags (`frontend`, `backend`, `ai`) | Media |
| `bug-N1` | Critical: blocks users, corrupts data, or affects production | Urgente |
| `bug-N2` | Important, has a workaround, does not fully block | Alta |
| `bug-N3` | Minor or cosmetic, does not affect the main flow | Baja |
| `técnica` | Tech debt, refactor, infra improvements. No direct user-visible impact | Media |
| `compliance` | HIPAA, Habeas Data, audit, logging, RBAC, encryption, etc. | Alta |
| `research` | Discovery, technical or product exploration without an immediate code deliverable | Media |

---

## 4. Bug protocol

### 4.1 Severity (N1 / N2 / N3)

Every bug must declare its severity explicitly: **N1**, **N2**, or **N3**.

**N1 — Crítico**
- Blocks the physician or corrupts data. May require backend + frontend.
- Examples: bug that deletes clinical text; authentication bug blocking access; data loss on deploy.
- Action: enters the sprint **immediately**, priority **Urgent**.

**N2 — Importante**
- Affects functionality but has a workaround; does not fully block the main flow.
- Examples: Markdown that misformats; awkward but non-blocking keys/interactions.
- Action: enters the **next sprint**, priority **High**.

**N3 — Menor / cosmético**
- Does not affect usability or data.
- Examples: styles, alignment, visual details.
- Action: goes to **Backlog**, grouped into tech-debt sprints.

### 4.2 Minimum documentation for any bug

Every bug (N1/N2/N3) must include in the description:

1. Clear description of the problem.
2. **Pasos para reproducir**, numbered.
3. **Ambiente** where it occurs: producción / staging / local.
4. **Evidencia**: video or screenshots.
5. **Severidad** declared: N1, N2, or N3.

### 4.3 Special rules — Sogamoso

Any bug associated with Sogamoso:

- Is **never** classified N3 — must be N1 or N2.
- Must carry the `sogamoso` tag.
- Priority must be **Urgent** or **High**.

Sogamoso is the active production client; its stability is the priority.

---

## 5. Definition of Ready (DoR)

A task may enter a sprint (lists inside the **Dev Sprints** folder) only if it meets ALL 5 criteria:

1. **Título accionable** — starts with verb (infinitive or gerund) + object.
2. **Historia de usuario escrita** — at least one `Como [rol], quiero [acción] para [beneficio].` line in the description (when applicable).
3. **Criterios de aceptación (≥2)** — `CRITERIOS DE ACEPTACION` block with at least 2 `- [ ]` items.
4. **Estimación en puntos** — Sprint points field has a value from the 1/2/3/5/8 scale.
5. **Dependencias y dueño** — at least one assignee; dependencies explicitly mapped in the description (related task IDs) or stated as `Sin dependencias`.

If any point is missing, the task stays in Backlog (Product Backlog / Requests / Bug Tracking) and is marked **incompleta – necesita definición** before it can enter Dev Sprints.

---

## 6. Definition of Done (DoD)

The DoD depends on the task type.

### 6.1 Features técnicas
- Code merged with a reviewed PR (≥1 reviewer).
- Relevant tests passing in staging.
- All acceptance criteria checked complete.
- No open critical errors associated with this feature.

### 6.2 Features clínicas
- Everything in 6.1, **plus**:
- Explicit clinical sign-off from Santi or a panel physician (comment or clear evidence on the task).

### 6.3 Bugs
- Fix deployed to the corresponding environment (ideally production).
- Regression steps executed and documented.
- Explicit verification by the bug reporter (or designated QA).

### 6.4 Compliance / seguridad
- Meets the technical-features DoD.
- Audit log verified when applicable.
- Permissions/RBAC review if relevant.
- Recorded in the agreed compliance registry (doc or system).

---

## 7. RACI on tasks

The **Tabla Raci** page defines, per process: **A** (Accountable — answers for the result), **R** (Responsible — executes), **C** (Consulted — consulted before deciding), **I** (Informed — informed after).

### 7.1 Reflecting R and A in ClickUp

- **R (Responsible)** → the task's **assignees**. Recommended: one principal owner; subtasks for others if needed.
- **A (Accountable)** → the custom field **Accountable**. Exactly **one** person, and it must match the A defined in the Tabla Raci for the process (e.g. Seguridad & Compliance Técnico → Max; Infraestructura / DevOps → Oscar; per the current table).

### 7.2 C and I (Consulted / Informed)

No dedicated ClickUp field exists; reflect them as:

- **C (Consulted)** — mention the C people in comments when their input is needed; add them as watchers to follow the conversation.
- **I (Informed)** — mention them in a closing comment or the task's final summary; include them in the doc or channel where the result is communicated.

Whenever a relevant task is created, verify that R and A are coherent with the Tabla Raci and that there is a reasonable plan for C and I (even without dedicated fields).

---

## 8. Critical rules (no exceptions)

| # | Rule | Why |
|---|------|-----|
| 1 | Clinical QA is done by physicians, not the tech team. Mónica facilitates QA sessions, but final clinical evaluation belongs to physicians | Clinical judgment is required |
| 2 | Every clinical feature needs sign-off from Santi or a panel physician | Without that validation the feature is not done |
| 3 | A task without clear acceptance criteria → Backlog, never Sprint | Avoids clogging the sprint with ill-defined work |
| 4 | Meeting decisions that do not generate code are documented as **decisiones**, not sprint tasks | E.g. defining consultation types goes to a Decisiones section |
| 5 | An 8-point task must be split before execution | Oversized tasks must be segmented |
| 6 | Sogamoso bugs → always N1 or N2 + `sogamoso` label + Urgent/High priority | Sogamoso is the active production client |
| 7 | Any payments/subscriptions task must consider **tokenization (3D Secure)** | Wompy does not do recurring charges by default; tokenization is critical |
| 8 | Decisions about AI models / medical prompts → **C** of the key physicians (Mateo, Vale, Pablo, Santi) | Scribe outputs are clinical; the medical team has a vote on model behavior |
| 9 | Never create or move a task to a done-type status (`Closed`, `ready for deployment`, `not doing`) by default — not even when the linked PR is already merged | Done-status tasks disappear from default views while verification/deploy/cleanup may still be pending. Closing is the user's call |

---

## 9. The three paths to ClickUp

All three paths produce the same result: a well-formed task in ClickUp.

### Camino A — From a meeting (with AI)

Use when you have a recorded or transcribed meeting (`/clickup procesar transcripción`). AI extracts the tasks; each task's owner reviews owners, estimations, and priorities before loading.

**Output structure for Camino A:**

```
## SPRINT ESTA SEMANA (listas para entrar — cumplen DoR)
## BACKLOG (identificadas pero necesitan más definición)
## DECISIONES REGISTRADAS
## BLOQUEOS IDENTIFICADOS
```

### Camino B — Own task, manual (no AI)

Reference workflow only — this skill does not run Camino B.

### Camino C — Own task, with AI

Default mode of `/clickup`: describe in natural language and the skill prompts for missing fields.

---

## 10. Team reference for owner (R) suggestion

| Person | Areas of responsibility |
|--------|-------------------------|
| Oscar Vélez | Backend, DevOps, Azure infra, technical architecture, Langsmith, authentication. RACI A for Infraestructura / DevOps |
| Tomás Espitia | Frontend, fullstack, local storage, history export, forms |
| Mónica Rojas | Head of Frontend + facilitates clinical QA sessions with physicians |
| Luka (Daniel Díaz) | UI design, Figma, interfaces |
| Max Duque | CTO: macro architecture, HIPAA/Habeas Data compliance. RACI A for Seguridad & Compliance Técnico |
| Santi Suárez | CIO/physician: validates clinical features, sign-off on clinical records |
| Eri Pardo | COO: commercial priorities, clients, operations |
| Mateo, Vale, Pablo, Santi | Key physicians — Consulted on AI model / medical prompt decisions |

---

## 11. Use with the CTO Brain agent

The ClickUp agent (**CTO Brain**) uses this protocol to:

- Review new tasks in Dev Sprints and Bug Tracking and flag whether they meet minimum DoR/DoD.
- Suggest R and A coherent with the Tabla Raci.
- Flag violations of critical rules (Sogamoso, payments, compliance, etc.).
- Help generate tasks from transcripts (dailies, client meetings) already in the correct Nebula format.

Any change to this protocol must stay in sync with:

- The **Tabla Raci** page (tech RACI).
- The **CTO Brain prompt**, so the agent always applies the current version.

---

## 12. Product context (for owner suggestion and labels)

Nebula Medical builds **Scribe**: an AI platform that generates clinical records for physicians. It is the first module of a broader clinical orchestrator. Stack: Microsoft Azure + Claude (Anthropic).

When deciding the owner of a task, match the description to the areas in §10. When in doubt between two owners, prefer the one whose responsibility includes the broader architectural concern.

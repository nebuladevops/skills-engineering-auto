# Nebula Task Protocol v1.0 — full detail

This document is the long-form reference for the protocol enforced by the `clickup` skill. The summary in `skill.md` is sufficient for routine task creation; consult this file for edge cases, meeting-transcript workflows, and Definition-of-Ready disputes.

Source of truth: `protocolo-tareas.docx` (Nebula Medical, Manual del equipo de desarrollo · v1.0). This file is a faithful conversion meant for automated enforcement.

---

## 1. Principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | One task = one concrete result | Each task must produce something verifiable. If you can't mark it done with evidence, split it or sharpen the criteria. |
| 2 | No info, no sprint | A task without acceptance criteria, estimation, or owner does NOT enter a sprint — it stays in Backlog until complete. |
| 3 | The owner creates or validates it | Whoever executes the task knows best what it implies. If the task came from a meeting, the owner reviews it before accepting. |

---

## 2. Required fields

| Field | Description | Example |
|-------|-------------|---------|
| Título | Verb + object. Specific and actionable. | "Implementar filtro por fecha en lista de pacientes" |
| Historia de usuario | `Como [rol], quiero [acción] para [beneficio]` | "Como médico, quiero filtrar por fecha para encontrar consultas recientes más rápido" |
| Criterios de aceptación | Minimum 2 verifiable conditions, each objectively checkable | "✓ El filtro aparece visible en la vista de lista / ✓ Al aplicar el filtro, sólo se muestran las consultas del rango" |
| Estimación | Story points per the scale below | 3 points |
| Owner | Single responsible person | Oscar |
| Tipo | One of the types in §4 | feature |
| Prioridad | Urgente / Alta / Media / Baja | Alta |

### Recommended optional fields

- **Labels** — apply whenever they fit: `clinical`, `compliance`, `hipaa`, `sogamoso`, `miami`, `ux`, `backend`, `frontend`, `infra`, `deuda-tecnica`
- **Subtareas** — when the task has sequential steps worth tracking separately
- **Links / attachments** — Figma designs, related tickets, reference docs
- **Notas** — extra context the owner needs before starting

---

## 3. Task types

| Type | Definition | Min priority |
|------|-----------|--------------|
| `feature` | New functionality that did not exist before | Media |
| `bug-N1` | Critical bug: blocks the user, corrupts data, affects production. Enters the sprint immediately. | Urgente |
| `bug-N2` | Important bug with a workaround. Does not fully block. Enters the next sprint. | Alta |
| `bug-N3` | Minor or cosmetic bug. Does not affect the main flow. Goes to Backlog. | Baja |
| `técnica` | Tech debt, refactor, infra/config improvement. No direct user-visible impact. | Media |
| `compliance` | HIPAA, Habeas Data, audit logs, security. Anything regulation-related. | Alta |
| `research` | Investigation, discovery, technical exploration. Does not produce code directly. | Media |

### Special rule — Sogamoso bugs

Any bug reported from Sogamoso is automatically classified as `bug-N1` or `bug-N2`, never `bug-N3`. Priority is always Urgente or Alta. The label `sogamoso` is mandatory.

---

## 4. Estimation scale (story points)

Estimation measures complexity and relative effort — NOT clock-hours. It is a team appreciation, not a promise.

| Points | Description | Typical examples |
|--------|-------------|------------------|
| 1 | Simple and clear. < 2 hours. No dependencies. | Change a UI text, fix a typo, adjust a color |
| 2 | Clear. ~half a day. | Add a field to a form, tweak an existing validation |
| 3 | Some complexity. ~1 day. | Implement a new filter, build a new UI component |
| 5 | Complex. 2–3 days. May have dependencies. | Integrate a new API endpoint, build Magic Link auth |
| 8 | Large or highly uncertain. If it lands at 8, it probably needs to be split before execution. | Data migration, full module refactor |

### Sprint capacity

The team sprint capacity is **18–20 points total**. When planning, the sum of all task points must not exceed that range. If a single task is 8 points, always ask: can this be split into smaller tasks?

---

## 5. The three paths to ClickUp

All three paths produce the same result: a well-formed task in ClickUp.

### Camino A — From a meeting (with AI)

Use this when you have a recorded or transcribed meeting. AI extracts all tasks automatically.

| Step | Action | Responsible |
|------|--------|-------------|
| 1 | Get the meeting transcript | Meeting organizer |
| 2 | Open a new conversation with the skill (`/clickup procesar transcripción`) | — |
| 3 | Paste the transcript | — |
| 4 | Review the output: verify owners, estimations, priorities | Each task's owner |
| 5 | Adjust what doesn't fit and load the tasks into ClickUp | — |

**Output structure for Camino A:**

```
## SPRINT ESTA SEMANA (listas para entrar — cumplen DoR)
## BACKLOG (identificadas pero necesitan más definición)
## DECISIONES REGISTRADAS
## BLOQUEOS IDENTIFICADOS
```

### Camino B — Own task, manual (no AI)

Use this when you spotted something to do and want to create the task directly without AI assistance. Reference workflow only — this skill does not run Camino B.

### Camino C — Own task, with AI

Use this when you want to create your own task but need help structuring it. This is the default mode of the `/clickup` skill: describe in natural language and the skill prompts for missing fields.

---

## 6. Critical rules (no exceptions)

| # | Rule | Why |
|---|------|-----|
| 1 | Clinical QA is done by physicians, not the tech team | Evaluating whether a clinical record is medically correct requires clinical judgment. The tech team facilitates and documents findings, but final validation belongs to physicians. |
| 2 | Every clinical feature needs sign-off from Santi or a panel physician | Without clinical validation, a feature that touches the clinical history flow cannot be considered done. |
| 3 | A task without clear acceptance criteria at creation time goes to **Backlog**, never to the sprint | A poorly defined task in a sprint stalls the whole chain. Better to clarify before committing. |
| 4 | Meeting decisions that do not generate code are documented separately, not as tasks | If the team decided that the consultation types are X, that is a *decision* — not a task. Goes to the Decisiones section, not the sprint. |
| 5 | When a task reaches 8 points, split it before executing | Large tasks carry too much uncertainty. Splitting reduces risk and makes the sprint more predictable. |
| 6 | Never create or move a task to a done-type status (`Closed`, `ready for deployment`, `not doing`) by default — not even when the linked PR is already merged | ClickUp's default views hide done-status tasks, so closing one removes it from the team's view even when verification, deploy, or cleanup work is still pending. Closing is the user's call, not the skill's. |

---

## 7. Definition of Ready (DoR)

A task is ready to enter the sprint only when it meets ALL of these criteria. If any are missing, it goes to Backlog.

| Criterion | How to verify |
|-----------|---------------|
| ✓ Has a title with verb + object | The title states what to do, not just "fix X" |
| ✓ Has a user story | The benefiting user or system perspective is explicit |
| ✓ Has ≥2 verifiable acceptance criteria | Each one can be checked with concrete evidence |
| ✓ Has an estimation assigned | The owner or team evaluated complexity and assigned points |
| ✓ Has a single owner | Exactly one person is responsible for completion |
| ✓ Does not depend on a blocked task | If it depends on another task, that task is in progress or completed |
| ✓ Clinical features have a pending sign-off criterion identified | If the task touches the clinical flow, the acceptance criteria explicitly include clinical validation |

---

## 8. Pre-load checklist (before moving a task to the sprint)

| Question | If the answer is No |
|----------|---------------------|
| Does the owner make sense for this task type? | Reassign before loading. |
| Does the estimation look reasonable? (When in doubt, drop a level.) | Discuss with the owner and adjust. |
| Do the sprint tasks sum to at most 18–20 points? | Move lower-priority tasks to Backlog. |
| Is there any Sogamoso task that should be Urgente and isn't? | Change priority to Urgente and add `sogamoso` label. |
| Do clinical features have the Santi sign-off criterion? | Add the criterion before moving to the sprint. |
| Did meeting decisions end up documented as decisions, not as tasks? | Move them to the Decisiones section in the meeting notes. |

---

## 9. Team reference for owner suggestion

| Person | Areas of responsibility |
|--------|-------------------------|
| Oscar Vélez | Backend, DevOps, Azure infra, technical architecture, Langsmith, authentication |
| Tomás Espitia | Frontend, fullstack, local storage, history export, forms |
| Mónica Rojas | Head of Frontend + facilitates clinical QA sessions with physicians |
| Luka (Daniel Díaz) | UI design, Figma, interfaces |
| Max Duque | CTO: macro architecture, HIPAA/Habeas Data compliance, hiring |
| Santi Suárez | CIO/physician: validates clinical features, sign-off on clinical records |
| Eri Pardo | COO: commercial priorities, clients, operations |

---

## 10. Product context (for owner suggestion and labels)

Nebula Medical builds **Scribe**: an AI platform that generates clinical records for physicians. It is the first module of a broader clinical orchestrator. Stack: Microsoft Azure + Claude (Anthropic).

When deciding the owner of a task, match the description to the areas above. When in doubt between two owners, prefer the one whose responsibility includes the broader architectural concern (e.g., backend infra over a frontend touch-up if the task is dual).

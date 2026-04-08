---
name: e2e-next-test
description: "Workflow para escribir el siguiente test E2E de Scribe Nebula. Lee el COVERAGE_PLAN, encuentra el próximo caso pendiente, describe lo que el plan plantea, pregunta al usuario cuál es el comportamiento esperado, y escribe el test basado en esa respuesta — nunca en lo que el código hace actualmente."
---

# E2E Next Test — /e2e-next-test

Eres un ingeniero de QA senior especializado en pruebas E2E con Playwright para **Scribe Nebula Medical** (`C:/NEBULA/proto_scribe`). Tu objetivo es escribir tests que definan el comportamiento esperado del producto, no que reflejen cómo está implementado el código actualmente.

## Principio fundamental

> **El test debe fallar si el código no cumple la expectativa del usuario, no si el código cambió.**
> 
> Nunca leas el código fuente para determinar qué debe pasar. El código describe *cómo* está implementado. El usuario describe *qué* debe pasar. El test verifica que ambos coinciden.

## Flujo de trabajo obligatorio (en orden estricto)

### Paso 1 — Leer el COVERAGE_PLAN

Lee `tests/COVERAGE_PLAN.md` completo. Identifica el **próximo caso pendiente** (sin ✅ ni N/A) con mayor prioridad (P1 antes que P2, P2 antes que P3), empezando por la suite de menor número.

Si el usuario invocó el skill con argumentos (ej: `/e2e-next-test suite:3` o `/e2e-next-test caso:3.4`), usa ese caso específico en vez del siguiente en orden.

### Paso 2 — Presentar el caso al usuario

Muestra al usuario **exactamente** cómo está descrito en el plan, sin interpretar ni agregar información del código:

```
## Próximo caso: [número] — [nombre]

**Suite:** [nombre de la suite]
**Prioridad:** [P1/P2/P3]
**Tipo:** [Happy path / Error path / Validación / etc.]

**Descripción del COVERAGE_PLAN:**
> [texto exacto del plan]

**Archivos fuente relacionados:**
[lista del campo "Archivos objetivo" de la suite]
```

### Paso 3 — Preguntar por el comportamiento esperado

Haz **exactamente estas preguntas**, adaptadas al caso:

1. ¿Cuál es la experiencia que el usuario debería tener en este flujo? (describe con palabras, sin código)
2. ¿Qué debería ver o pasar si el flujo funciona correctamente?
3. ¿Qué debería ver o pasar si el flujo falla?
4. ¿Hay casos borde o condiciones especiales que debemos cubrir?

**NO leas el código fuente todavía.** Espera la respuesta del usuario antes de continuar.

### Paso 4 — Leer el código fuente (solo después de recibir la respuesta)

Una vez que el usuario definió el comportamiento esperado:

1. Lee los archivos fuente listados en la suite del COVERAGE_PLAN
2. Identifica los selectores reales (clases CSS, roles ARIA, texto visible) que usarás en el test
3. Identifica si hay comportamientos del código que **difieren** de lo que el usuario espera
4. Si hay diferencia, **reporta la discrepancia** antes de escribir el test:

```
⚠️ Discrepancia encontrada:
- El usuario espera: [expectativa]
- El código actual hace: [comportamiento real]
- Recomendación: [¿escribir el test con la expectativa (que fallará)? ¿o documentar como bug conocido?]
```

Pregunta al usuario cómo proceder antes de continuar.

### Paso 5 — Escribir el test

Escribe el test en el archivo correspondiente de `e2e/`. Usa estas reglas:

**Estructura obligatoria de cada test:**
```typescript
test('X.Y — descripción corta', {
  annotation: [
    {
      type: 'Descripción',
      description: 'Qué verifica este test y por qué es importante.'
    },
    {
      type: 'Comportamiento esperado',
      description: 'Lo que el usuario describió en el Paso 3.'
    },
    {
      type: 'Caso COVERAGE_PLAN',
      description: 'X.Y'
    }
  ]
}, async ({ page }) => {
  // ... test body
});
```

**Selectores — orden de preferencia:**
1. `getByRole` (accesibilidad: button, link, textbox, etc.)
2. `getByPlaceholder` / `getByLabel` / `getByText` (texto visible)
3. `getByTestId` (data-testid si existe)
4. CSS class específica (`.clase-unica`) solo si no hay otra opción

**Nunca usar:**
- `nth()` sin justificación
- Selectores genéricos como `div[class*="algo"]` sin combinarlo con algo más específico
- Timeouts fijos (`waitForTimeout`) sin documentar por qué

**Infraestructura del sidebar** (recordatorio para tests que necesiten el sidebar):
- El sidebar siempre arranca colapsado (useEffect en ChatSideBarContent)
- Para expandirlo: `await page.locator('svg[viewBox="0 0 100 108"]').click()`
- Para abrir sección Chats: `await page.getByRole('button', { name: 'Chats' }).click({ timeout: 5_000 })`
- Para abrir user menu: expandir primero, luego `await page.locator('div[class*="french-blue-10"][class*="duration-[400ms]"]').click()`

### Paso 6 — Actualizar COVERAGE_PLAN.md

Marca el caso como implementado en `tests/COVERAGE_PLAN.md`:

```
| X.Y | Descripción del caso | Tipo | P1 | ✅ `e2e/nombre-archivo.spec.ts` |
```

### Paso 7 — Reportar

Muestra al usuario:
- El test escrito
- Si se encontró alguna discrepancia entre expectativa y código
- El archivo actualizado en COVERAGE_PLAN.md

---

## Contexto del proyecto

**Framework:** Playwright v1.59, Next.js 16 App Router, React 19  
**Auth:** SSO via `/dev-login` → login humano. `e2e/.auth/user.json` guarda la sesión.  
**Correr tests:** `pnpm test:e2e` (Chromium) | `pnpm test:e2e:safari` (WebKit) | `pnpm test:e2e:login` (renovar sesión)  
**Reportes:** `tests/playwright-report/index.html` (HTML built-in) | `tests/coverage/index.html` (monocart, solo con `pnpm test:e2e:coverage`)

**Archivos de test existentes:**
- `e2e/auth.setup.ts` — setup SSO (no modificar)
- `e2e/smoke.spec.ts` — smoke test sesión
- `e2e/navigation.spec.ts` — Suite 11
- `e2e/auth-session.spec.ts` — Suite 1 (reducida)
- `e2e/chat-rooms.spec.ts` — Suite 3

**Suites pendientes por orden de prioridad:**
- Suite 3 (3.4, 3.5) — Chat Rooms CRUD
- Suite 4 (4.1, 4.9, 4.8...) — Mensajería AI
- Suite 12 — Canvas Editor
- Suite 13 — Chat AI Tools
- Suite 6 — Templates
- Suite 2 — Onboarding (requiere SSO nuevo)
- Suites 5, 7, 8, 9, 10 — P2/P3

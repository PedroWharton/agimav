import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Smoke test de Fase 9 (WS-B / WS-C / WS-E) contra el build de producción.
 * Sweep de lectura de todas las pantallas nuevas + flujos de alta encadenados
 * (cada flujo usa lo que crea el anterior, así no dependo de ids fijos).
 * El usuario autorizó cargar formularios — la base no tiene datos de cliente.
 *
 * Correr: SMOKE_EMAIL=... SMOKE_PASSWORD=... [SMOKE_MANT_ID=139] npx playwright test
 */

const EMAIL = process.env.SMOKE_EMAIL ?? "";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "";
const MANT_ID = process.env.SMOKE_MANT_ID ?? "139";
const TS = Date.now().toString().slice(-6);

type Result = { step: string; ok: boolean; detail?: string };
const results: Result[] = [];
const pageErrors: string[] = [];

async function softStep(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ step: name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const detail = (e as Error).message.split("\n")[0].slice(0, 220);
    results.push({ step: name, ok: false, detail });
    console.log(`  ✗ ${name}\n      ${detail}`);
  }
}

async function checkRoute(page: Page, path: string) {
  const errs: string[] = [];
  const onErr = (m: import("@playwright/test").ConsoleMessage) => {
    if (m.type() === "error") errs.push(m.text());
  };
  page.on("console", onErr);
  const resp = await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(400);
  page.off("console", onErr);

  const finalPath = new URL(page.url()).pathname;
  if (finalPath === "/login") throw new Error("redirigió a /login (sin sesión)");
  if (finalPath === "/sin-permisos")
    throw new Error("redirigió a /sin-permisos (falta permiso)");
  if (resp && resp.status() >= 500)
    throw new Error(`HTTP ${resp.status()}`);

  const heading = page.getByRole("heading").first();
  if (!(await heading.isVisible().catch(() => false)))
    throw new Error("sin heading visible — ¿página rota?");

  const i18n = errs.filter((e) => /MISSING_MESSAGE|IntlError/i.test(e));
  if (i18n.length) throw new Error(`i18n faltante: ${i18n[0].slice(0, 140)}`);
}

/** Combobox cmdk: abre el trigger, escribe query opcional, elige opción. */
async function pickCombobox(
  page: Page,
  trigger: Locator,
  opts: { query?: string; first?: boolean; option?: string | RegExp },
) {
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const input = page.locator("[cmdk-input]");
  await input.waitFor({ state: "visible" });
  if (opts.query) await input.fill(opts.query);
  await page.waitForTimeout(350);
  if (opts.first) {
    await page.locator("[cmdk-item]").first().click();
  } else if (opts.option) {
    await page.getByRole("option", { name: opts.option }).first().click();
  }
  await page.waitForTimeout(200);
}

test("smoke Fase 9 — WS-B / WS-C / WS-E", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Falta SMOKE_EMAIL / SMOKE_PASSWORD");
  page.on("pageerror", (e) => {
    pageErrors.push(e.message);
    console.log(`  [pageerror] ${e.message}`);
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  await page.goto("/login", { waitUntil: "load" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 90_000 });
  await page.waitForTimeout(600);
  console.log(`\n──── SMOKE FASE 9 ──── login OK → ${new URL(page.url()).pathname}`);

  // ── 1. Sweep de lectura ───────────────────────────────────────────────────
  const rutas: Array<[string, string]> = [
    ["sweep · listados índice", "/listados"],
    ["sweep · proveedores de servicio", "/listados/proveedores-servicio"],
    ["sweep · categorías de OT", "/listados/categorias-ot"],
    ["sweep · proveedores (WS-B)", "/listados/proveedores"],
    ["sweep · unidades productivas (WS-B)", "/listados/unidades-productivas"],
    ["sweep · usuarios (WS-B)", "/listados/usuarios"],
    ["sweep · mantenimiento (listado)", "/mantenimiento"],
    [`sweep · mantenimiento detalle #${MANT_ID}`, `/mantenimiento/${MANT_ID}`],
    ["sweep · OT (calendario)", "/ordenes-trabajo"],
    ["sweep · OT nueva (form)", "/ordenes-trabajo/nuevo"],
    ["sweep · movimientos diarios (listado)", "/movimientos-diarios"],
    ["sweep · movimiento diario nuevo (form)", "/movimientos-diarios/nuevo"],
    ["sweep · estadísticas (dashboard)", "/estadisticas"],
    ["sweep · estadísticas / gasto por usuario", "/estadisticas/usuarios"],
  ];
  for (const [label, path] of rutas) {
    await softStep(label, () => checkRoute(page, path));
  }

  // ── 2. Categoría de OT — alta ─────────────────────────────────────────────
  const catNombre = `SMOKE Cat ${TS}`;
  await softStep("WS-C · crear categoría de OT", async () => {
    await page.goto("/listados/categorias-ot", { waitUntil: "load" });
    await page.getByRole("button", { name: /^Nuevo$/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").first().fill(catNombre);
    await dialog.getByRole("button", { name: /Guardar/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(catNombre).first()).toBeVisible();
  });

  // ── 3. Proveedor de servicio — alta ───────────────────────────────────────
  const provNombre = `SMOKE Taller ${TS}`;
  await softStep("WS-C · crear proveedor de servicio", async () => {
    await page.goto("/listados/proveedores-servicio", { waitUntil: "load" });
    await page.getByRole("button", { name: /^Nuevo$/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").first().fill(provNombre);
    await dialog.getByRole("button", { name: /Guardar/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(provNombre).first()).toBeVisible();
  });

  // ── 4. OT nueva con programación (fecha programada + duración) ────────────
  let otUrl = "";
  await softStep("WS-C · crear OT con fecha programada y duración", async () => {
    await page.goto("/ordenes-trabajo/nuevo", { waitUntil: "load" });
    await page.waitForTimeout(400);
    await page.getByRole("textbox").first().fill(`SMOKE OT ${TS}`);
    await page.locator('input[type="date"]').first().fill("2026-06-15");
    await page.locator('input[type="number"]').first().fill("2");
    await page.getByRole("button", { name: /Crear OT/i }).click();
    await page.waitForURL(/\/ordenes-trabajo\/\d+/, { timeout: 25_000 });
    otUrl = new URL(page.url()).pathname;
    await expect(page.getByText(`SMOKE OT ${TS}`).first()).toBeVisible();
  });

  // ── 5. Servicio externo sobre la OT creada ────────────────────────────────
  const servDesc = `Servicio smoke ${TS}`;
  await softStep("WS-C · agregar servicio externo a la OT", async () => {
    if (!otUrl) throw new Error("sin OT creada");
    await page.goto(otUrl, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Agregar servicio/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: provNombre }).first().click();
    await dialog.getByRole("textbox").first().fill(servDesc);
    await dialog.getByRole("button", { name: /^Guardar$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(servDesc).first()).toBeVisible();
  });

  // ── 6. Movimiento diario — alta (consumible + herramienta) ────────────────
  let movUrl = "";
  await softStep("WS-C · crear movimiento diario", async () => {
    await page.goto("/movimientos-diarios/nuevo", { waitUntil: "load" });
    await page.waitForTimeout(500);
    const filas = page.locator("table tbody tr");
    // línea 1 — consumible
    const r1 = filas.nth(0);
    await pickCombobox(page, r1.locator("td").nth(0).getByRole("combobox"), {
      first: true,
    });
    await r1.locator("td").nth(1).locator("input").fill("1");
    // línea 2 — herramienta
    await page.getByRole("button", { name: /Agregar línea/i }).click();
    const r2 = filas.nth(1);
    await pickCombobox(page, r2.locator("td").nth(0).getByRole("combobox"), {
      first: true,
    });
    await r2.locator("td").nth(1).locator("input").fill("1");
    await r2.locator("td").nth(2).getByRole("combobox").click();
    await page.getByRole("option", { name: /Herramienta/i }).click();

    await page.getByRole("button", { name: /Guardar registro/i }).click();
    await page.waitForURL(/\/movimientos-diarios\/\d+/, { timeout: 25_000 });
    movUrl = new URL(page.url()).pathname;
  });

  // ── 7. Movimiento diario — devolver herramienta ───────────────────────────
  await softStep("WS-C · devolver herramienta (reintegra stock)", async () => {
    if (!movUrl) throw new Error("sin movimiento creado");
    await page.goto(movUrl, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^Devolver$/i }).first().click();
    await expect(page.getByText(/Devuelta/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── 8. WS-E — gasto por usuario ───────────────────────────────────────────
  await softStep("WS-E · gasto por usuario renderiza", async () => {
    await page.goto("/estadisticas/usuarios", { waitUntil: "load" });
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("heading", { name: /Gasto por usuario/i }).first(),
    ).toBeVisible();
  });

  // ── Limpieza ──────────────────────────────────────────────────────────────
  await softStep("limpieza · eliminar movimiento diario de prueba", async () => {
    if (!movUrl) throw new Error("sin movimiento que limpiar");
    await page.goto(movUrl, { waitUntil: "load" });
    await page.getByRole("button", { name: /Eliminar registro/i }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Eliminar/i })
      .click();
    await page.waitForURL(/\/movimientos-diarios$/, { timeout: 15_000 });
  });

  await softStep("limpieza · eliminar categoría de OT de prueba", async () => {
    await page.goto("/listados/categorias-ot", { waitUntil: "load" });
    const fila = page.locator("tr", { hasText: catNombre });
    await fila.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /Eliminar/i }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Eliminar/i })
      .click();
    await expect(page.getByText(catNombre)).toHaveCount(0, { timeout: 15_000 });
  });

  // ── Reporte ───────────────────────────────────────────────────────────────
  const fail = results.filter((r) => !r.ok);
  console.log("\n──── RESULTADO ────");
  console.log(`  ${results.length - fail.length}/${results.length} pasos OK`);
  if (pageErrors.length) {
    console.log(`  pageerrors (${pageErrors.length}):`);
    for (const e of [...new Set(pageErrors)]) console.log(`    · ${e}`);
  }
  for (const f of fail) console.log(`  ✗ ${f.step}\n      ${f.detail}`);
  console.log("───────────────────\n");

  expect(
    fail,
    `Fallaron ${fail.length}/${results.length}:\n${fail
      .map((f) => `- ${f.step}: ${f.detail}`)
      .join("\n")}`,
  ).toEqual([]);
});

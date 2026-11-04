/* =====================================================================
   МИМ Дафтар — the app: screens, buttons, forms and calculations.
   Sections: 1 helpers · 2 language · 3 state · 4 formatting
             5 calculations (jumbo rolls, cost per pack) · 6 icons
             7 building blocks · 8 screens · 9 form helpers · 10 forms
             11 calculator · 12 Excel/backup · 13 clicks · 14 start
   ===================================================================== */
"use strict";

/* ---------------- 1. Small helpers ---------------- */
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => isoDate(new Date());
const thisMonth = () => today().slice(0, 7);
const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[\s ]/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; };
const sum = (arr, f) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
const r2 = (n) => Math.round((+n || 0) * 100) / 100;

/* ---------------- 2. Language ---------------- */
let LANG = "tj";
try { LANG = localStorage.getItem("mim_lang") || "tj"; } catch (e) { /* private mode */ }

function t(key, vars) {
  let s = I18N[LANG] && I18N[LANG][key] !== undefined ? I18N[LANG][key] : (I18N.ru[key] ?? key);
  if (vars && typeof s === "string") for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}
function applyI18n() {
  document.documentElement.lang = LANG === "tj" ? "tg" : "ru";
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === LANG)));
  const sb = $("#btn-settings"); if (sb) sb.setAttribute("aria-label", t("settings"));
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem("mim_lang", l); } catch (e) { }
  applyI18n();
  if (!$("#screen-app").hidden) render();
}

/* ---------------- 3. App state ---------------- */
const DATA_KEYS = ["rolls", "customers", "production", "sales", "payments", "expenses"];
const DEFAULT_SETTINGS = {
  business: "МИМ", currency: "смн", default_price: 0, start_stock: 0, min_stock: 0,
  napkin_size_cm: 24, sheets_per_pack: 100, gsm: 17, ply: 1, waste_pct: 3, pack_cost: 0, min_paper_kg: 0
};
const S = {
  tab: "home",
  month: thisMonth(),
  online: true,
  settings: Object.assign({}, DEFAULT_SETTINGS),
  rolls: [], customers: [], production: [], sales: [], payments: [], expenses: []
};
const TABS = ["home", "sales", "debts", "stock", "report"];
const EXPENSE_CATS = ["salary", "power", "packaging", "transport", "rent", "repair", "tax", "other"];
const CURRENCIES = ["смн", "₸", "сом", "₽", "$"];

/** Copy the latest data (server + offline changes) into S */
function applyView() {
  const d = DB.view();
  DATA_KEYS.forEach((k) => (S[k] = d[k] || []));
  S.settings = Object.assign({}, DEFAULT_SETTINGS, (d.settings && d.settings[0]) || {});
}

/* ---------------- 4. Formatting ---------------- */
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const money = (n) => nf.format(r2(n)) + " " + (S.settings.currency || "");
const qf = (n) => nf.format(Math.round((+n || 0) * 1000) / 1000);
const kgf = (n) => nf.format(Math.round((+n || 0) * 10) / 10) + " " + t("kg");
const gf = (kg) => nf0.format((+kg || 0) * 1000) + " " + t("g");
const packs = (n) => qf(Math.round((+n || 0) * 100) / 100) + " " + t("packs_unit");
const catL = (c) => t("cats")[c] || c;
const byId = (list, id) => list.find((x) => x.id === id);
const clientName = (id) => { if (!id) return t("walkin"); const c = byId(S.customers, id); return c ? c.name : "—"; };
const rollName = (r) => (r ? "№" + r.label : "—");
const saleTotal = (s) => r2((+s.qty || 0) * (+s.price || 0));
const byNewest = (a, b) => (b.date || "").localeCompare(a.date || "") || String(b.created_at || "").localeCompare(String(a.created_at || ""));
const byName = (a, b) => a.name.localeCompare(b.name);

function shiftMonth(ym, delta) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
function monthLabel(ym) { const [y, m] = ym.split("-").map(Number); return t("months_nom")[m - 1] + " " + y; }
function dateLabel(ds) {
  if (!ds) return "";
  if (ds === today()) return t("today");
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (ds === isoDate(y)) return t("yesterday");
  const [yy, m, d] = ds.split("-").map(Number);
  return d + " " + t("months_gen")[m - 1] + (yy !== new Date().getFullYear() ? " " + yy : "");
}
function longDate(ds) { const [yy, m, d] = ds.split("-").map(Number); return d + " " + t("months_gen")[m - 1] + " " + yy; }
function greet() { const h = new Date().getHours(); return h < 12 ? t("greet_morning") : h < 18 ? t("greet_day") : t("greet_evening"); }
function timeAgo(ms) {
  if (!ms) return "";
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return t("just_now");
  if (min < 60) return t("min_ago", { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("hours_ago", { n: h });
  return dateLabel(isoDate(new Date(ms)));
}

/* ---------------- 5. Calculations ---------------- */
/* Packs */
function packStock() { return (+S.settings.start_stock || 0) + sum(S.production, (p) => p.qty) - sum(S.sales, (s) => s.qty); }
function packsLow() { const s = packStock(); return s < 0 || (+S.settings.min_stock > 0 && s <= +S.settings.min_stock); }

/* Clients */
function debts() {
  const d = {};
  S.customers.forEach((c) => (d[c.id] = 0));
  S.sales.forEach((s) => { if (s.customer_id) d[s.customer_id] = (d[s.customer_id] || 0) + saleTotal(s) - (+s.paid || 0); });
  S.payments.forEach((p) => { if (p.customer_id) d[p.customer_id] = (d[p.customer_id] || 0) - (+p.amount || 0); });
  return d;
}
const totalOwed = () => sum(Object.values(debts()).filter((v) => v > 0.004), (v) => v);
function lastPayment(cid) { const ps = S.payments.filter((p) => p.customer_id === cid).sort(byNewest); return ps[0] ? ps[0].date : null; }
function clientPrice(cid) { const c = cid && byId(S.customers, cid); return c && +c.price > 0 ? +c.price : +S.settings.default_price || 0; }

/* Napkin calculator (pure math, no data) — also used for the "norm" */
function calcNapkin(i) {
  const sheetG = Math.pow((+i.size || 0) / 100, 2) * (+i.gsm || 0) * (+i.ply || 1);   // grams per napkin
  const packG = sheetG * (+i.sheets || 0);                                            // grams of napkins in 1 pack
  const waste = Math.min(Math.max(+i.waste || 0, 0), 90) / 100;
  const paperPerPackKg = packG > 0 ? packG / 1000 / (1 - waste) : 0;                 // paper used incl. waste
  const packsPerRoll = paperPerPackKg > 0 ? (+i.rollKg || 0) / paperPerPackKg : 0;
  const pricePerKg = +i.rollKg > 0 ? (+i.rollPrice || 0) / +i.rollKg : 0;
  const paperCost = paperPerPackKg * pricePerKg;
  const cost = paperCost + (+i.bag || 0) + (+i.other || 0);
  const profit = (+i.price || 0) - cost;
  return { sheetG, packG, paperPerPackKg, packsPerRoll, pricePerKg, paperCost, cost, profit, profitPerRoll: profit * packsPerRoll };
}
/** Paper per pack (kg) from the napkin settings */
function normKgPerPack() {
  const s = S.settings;
  return calcNapkin({ size: s.napkin_size_cm, gsm: s.gsm, ply: s.ply, sheets: s.sheets_per_pack, waste: s.waste_pct, rollKg: 1 }).paperPerPackKg;
}

/* Jumbo rolls */
const packsFromRoll = (id) => sum(S.production.filter((p) => p.roll_id === id), (p) => p.qty);
function rollResult(r) {
  const made = packsFromRoll(r.id);
  const used = Math.max(0, (+r.weight_kg || 0) - (+r.leftover_kg || 0));
  const kgPerPack = made > 0 ? used / made : null;
  const norm = normKgPerPack();
  return {
    made, used, kgPerPack,
    costPerPack: made > 0 ? (+r.cost || 0) / made : null,
    vsNorm: kgPerPack && norm > 0 ? (kgPerPack / norm - 1) * 100 : null
  };
}
const doneRolls = () => S.rolls.filter((r) => r.status === "done").sort((a, b) => (b.finished_date || "").localeCompare(a.finished_date || ""));
/** Real paper per pack from the last 5 finished rolls; if none yet, the norm from settings */
function kgPerPack() {
  const res = doneRolls().map(rollResult).filter((x) => x.made > 0).slice(0, 5);
  const p = sum(res, (x) => x.made);
  if (p > 0) return { kg: sum(res, (x) => x.used) / p, actual: true };
  return { kg: normKgPerPack(), actual: false };
}
function rollRemaining(r) {
  if (r.status === "done") return 0;
  if (r.status === "stock") return +r.weight_kg || 0;
  return Math.max(0, (+r.weight_kg || 0) - packsFromRoll(r.id) * kgPerPack().kg);
}
const paperKg = () => sum(S.rolls.filter((r) => r.status !== "done"), rollRemaining);
function packsPossible() { const k = kgPerPack().kg; return k > 0 ? Math.floor(paperKg() / k) : 0; }
function avgDailyPacks() { const d = new Date(); d.setDate(d.getDate() - 30); const from = isoDate(d); return sum(S.production.filter((p) => p.date > from), (p) => p.qty) / 30; }
function paperDaysLeft() { const a = avgDailyPacks(); return a > 0 ? packsPossible() / a : null; }
const paperLow = () => +S.settings.min_paper_kg > 0 && paperKg() <= +S.settings.min_paper_kg;
function paperPricePerKg() {
  const rs = [...S.rolls].filter((r) => +r.cost > 0).sort(byNewest).slice(0, 5);
  const w = sum(rs, (r) => r.weight_kg);
  return w > 0 ? sum(rs, (r) => r.cost) / w : 0;
}
const nextRollLabel = () => S.rolls.reduce((m, r) => Math.max(m, +r.label || 0), 0) + 1;
const rollsByStatus = (st) => S.rolls.filter((r) => r.status === st).sort((a, b) => a.label - b.label);

/* Month */
function monthStats(ym) {
  const inM = (x) => (x.date || "").slice(0, 7) === ym;
  const sales = S.sales.filter(inM), exps = S.expenses.filter(inM), rolls = S.rolls.filter(inM);
  const revenue = sum(sales, saleTotal);
  const expenses = sum(exps, (e) => e.amount);
  const raw = sum(rolls, (r) => r.cost);
  const byCat = {};
  exps.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + (+e.amount || 0)));
  if (raw > 0) byCat.__raw = raw;
  const made = sum(S.production.filter(inM), (p) => p.qty);
  return {
    made, sold: sum(sales, (s) => s.qty), revenue,
    received: sum(sales, (s) => s.paid) + sum(S.payments.filter(inM), (p) => p.amount),
    unpaid: sum(sales, (s) => saleTotal(s) - (+s.paid || 0)),
    expenses, raw, rollsKg: sum(rolls, (r) => r.weight_kg), profit: revenue - expenses - raw, byCat, sales, exps, rolls
  };
}
/** What one pack costs: paper + bag + share of other monthly costs */
function packCost(ym) {
  const k = kgPerPack();
  const ms = monthStats(ym);
  // If a bag price per pack is set, "packaging" expenses are already counted there.
  const other = sum(ms.exps.filter((e) => !(+S.settings.pack_cost > 0 && e.category === "packaging")), (e) => e.amount);
  const overhead = ms.made > 0 ? other / ms.made : 0;
  const paper = k.kg * paperPricePerKg();
  const bag = +S.settings.pack_cost || 0;
  const total = paper + bag + overhead;
  return { kg: k.kg, actual: k.actual, paper, bag, overhead, total, price: +S.settings.default_price || 0, profit: (+S.settings.default_price || 0) - total };
}

/* ---------------- 6. Icons ---------------- */
const IC = {
  home: '<path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  sales: '<path d="M3.5 4.5h2.2l2.1 10.5h10.8l2-7.5H6.6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17.5" cy="19" r="1.4"/>',
  debts: '<path d="M5 4.5h11a3 3 0 0 1 3 3v12.5H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9.5 8.5h5"/>',
  stock: '<path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/>',
  report: '<path d="M4 20V4M4 20h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
  made: '<path d="M5 5h14v5H5zM5 14h14v5H5z"/><path d="M14 5l5 5M14 14l5 5"/>',
  cash: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  spent: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11.5h6M9 15h3"/>',
  roll: '<ellipse cx="8" cy="12" rx="4" ry="7"/><path d="M8 5h9c2.2 0 4 3.1 4 7s-1.8 7-4 7H8"/><ellipse cx="8" cy="12" rx="1.3" ry="2.3"/>',
  rolldone: '<ellipse cx="8" cy="12" rx="4" ry="7"/><ellipse cx="8" cy="12" rx="1.3" ry="2.3"/><path d="m14 12 2.5 2.5L21 9"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.7.6 3 2.1 3.4 4.7"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h3.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1.5 1.5 0 0 1-1.6 1.5C10.5 20 4 13.5 3.5 5.6A1.5 1.5 0 0 1 5 4z"/>',
  chat: '<path d="M4 19.5l1.3-3.8A8 8 0 1 1 8.5 19z"/>',
  print: '<path d="M7 8V3.5h10V8M7 17H4.5V9.5A1.5 1.5 0 0 1 6 8h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><path d="M7 13.5h10v7H7z"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  logout: '<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14M10 8l-4 4 4 4M6 12h9"/>'
};
const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

/* ---------------- 7. Building blocks ---------------- */
const head = (title, buttons) => `<div class="page-head"><h1>${esc(title)}</h1>${buttons ? `<div class="btn-row">${buttons}</div>` : ""}</div>`;
const btnPrimary = (act, label, icon = "plus", id) => `<button type="button" class="btn primary" data-act="${act}" ${id ? `data-id="${esc(id)}"` : ""}>${ico(icon)}${esc(label)}</button>`;
const btnPlain = (act, label, icon, id) => `<button type="button" class="btn" data-act="${act}" ${id ? `data-id="${esc(id)}"` : ""}>${icon ? ico(icon) : ""}${esc(label)}</button>`;
const emptyBox = (txt) => `<div class="empty">${esc(txt || t("empty"))}</div>`;
const monthSwitch = () => `<div class="month-switch no-print">
  <button type="button" class="icon-btn" data-act="mprev" aria-label="‹">${ico("left")}</button>
  <b>${esc(monthLabel(S.month))}</b>
  <button type="button" class="icon-btn" data-act="mnext" aria-label="›" ${S.month >= thisMonth() ? "disabled" : ""}>${ico("right")}</button></div>`;
const statusPill = (r) => `<span class="pill ${r.status === "use" ? "good" : r.status === "done" ? "" : "blue"}">${esc(t("st_" + r.status))}</span>`;

function row({ kind, id, title, sub, end, endSub, dot }) {
  const icon = { sale: "sales", made: "made", cash: "cash", spent: "spent", roll: "roll" }[dot];
  return `<button type="button" class="item" data-act="open" data-kind="${kind}" data-id="${esc(id)}">
    ${dot ? `<span class="dot ${dot}">${ico(icon)}</span>` : ""}
    <span class="item-main"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>
    ${end !== undefined ? `<span class="item-end"><b>${esc(end)}</b>${endSub || ""}</span>` : ""}</button>`;
}
function grouped(list, rowFn) {
  if (!list.length) return emptyBox();
  let h = "", cur = null;
  for (const x of list) {
    if (x.date !== cur) { if (cur !== null) h += "</div>"; cur = x.date; h += `<h3 class="day">${esc(dateLabel(cur))}</h3><div class="list">`; }
    h += rowFn(x);
  }
  return h + "</div>";
}
const saleRow = (s) => {
  const d = saleTotal(s) - (+s.paid || 0);
  return row({
    kind: "sale", id: s.id, dot: "sale", title: clientName(s.customer_id),
    sub: packs(s.qty) + " × " + money(s.price), end: money(saleTotal(s)),
    endSub: d > 0.004 ? `<span class="pill bad">${t("debt")} ${esc(money(d))}</span>` : `<span class="pill good">${t("paid")}</span>`
  });
};
const madeRow = (p) => row({
  kind: "production", id: p.id, dot: "made", title: t("made"),
  sub: [p.roll_id ? t("roll") + " " + rollName(byId(S.rolls, p.roll_id)) : "", p.note].filter(Boolean).join(" · "), end: "+" + packs(p.qty)
});
const rollBuyRow = (r) => row({
  kind: "roll", id: r.id, dot: "roll", title: t("roll") + " " + rollName(r) + (r.supplier ? " · " + r.supplier : ""),
  sub: kgf(r.weight_kg) + (+r.cost > 0 ? " · " + money(r.cost / r.weight_kg) + "/" + t("kg") : ""), end: "−" + money(r.cost)
});
const expenseRow = (e) => row({ kind: "expense", id: e.id, dot: "spent", title: catL(e.category), sub: e.note || "", end: "−" + money(e.amount) });
const paymentRow = (p) => row({ kind: "payment", id: p.id, dot: "cash", title: t("payment") + ": " + clientName(p.customer_id), sub: p.note || "", end: "+" + money(p.amount) });

function allEvents() {
  const ev = (list, f) => list.map((x) => ({ x, date: x.date, created_at: x.created_at, f }));
  return [...ev(S.sales, saleRow), ...ev(S.production, madeRow), ...ev(S.payments, paymentRow),
  ...ev(S.expenses, expenseRow), ...ev(S.rolls, rollBuyRow)].sort(byNewest);
}

/* ---------------- 8. Screens ---------------- */
function renderChrome() {
  applyI18n();
  const labels = { home: "nav_home", sales: "nav_sales", debts: "nav_debts", stock: "nav_stock", report: "nav_report" };
  $("#tabs").innerHTML = TABS.map((k) => `<a href="#${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ico(k)}<span>${t(labels[k])}</span></a>`).join("");
  // Internet / sync status
  const pending = DB.pendingCount(), failed = DB.failedCount();
  let b = "";
  if (!S.online) b += `<div class="banner offline"><span>${esc(t("offline_banner"))}${pending ? " " + esc(t("pending_n", { n: pending })) : ""}</span></div>`;
  else if (pending) b += `<div class="banner"><span>${esc(t("pending_n", { n: pending }))}</span><button type="button" class="link" data-act="sync">${t("send_now")}</button></div>`;
  if (failed) b += `<div class="banner bad"><span>${esc(t("failed_n", { n: failed }))}</span><button type="button" class="link" data-act="clear_failed">${t("ok")}</button></div>`;
  $("#banner").innerHTML = b;
  const line = $("#sync-line");
  if (line) {
    line.removeAttribute("data-i18n");
    line.textContent = S.online ? (pending ? t("pending_n", { n: pending }) : t("tagline")) : t("offline_short") + (DB.cacheTime() ? " · " + t("updated") + " " + timeAgo(DB.cacheTime()) : "");
  }
}
function render() {
  renderChrome();
  const view = { home: vHome, sales: vSales, debts: vDebts, stock: vStock, report: vReport }[S.tab] || vHome;
  $("#view").innerHTML = view();
}

/* --- Home --- */
function setupChecklist() {
  const steps = [
    { done: +S.settings.default_price > 0, key: "step_price", act: "settings" },
    { done: S.rolls.length > 0, key: "step_rolls", act: "f_rolls" },
    { done: S.customers.length > 0, key: "step_clients", act: "f_client" }
  ];
  if (steps.every((s) => s.done)) return "";
  return `<div class="card"><h2>${t("setup_steps_title")}</h2><ol class="steps">${steps.map((s, i) =>
    `<li class="${s.done ? "done" : ""}"><span class="n">${s.done ? "✓" : i + 1}</span><span>${esc(t(s.key))}</span>${s.done ? "" : `<button type="button" class="btn" data-act="${s.act}">${t("do_it")}</button>`}</li>`).join("")}</ol></div>`;
}
function paperLine() {
  const days = paperDaysLeft();
  return `≈ ${esc(packs(packsPossible()))}${days !== null ? " · " + esc(t("days_left", { n: nf0.format(days) })) : ""}`;
}
function vHome() {
  const stock = packStock(), ms = monthStats(thisMonth()), owed = totalOwed();
  const actions = [
    { act: "f_sale", key: "act_sold", icon: "sales", tone: "blue" },
    { act: "f_made", key: "act_made", icon: "made", tone: "green" },
    { act: "f_payment", key: "act_paid", icon: "cash", tone: "green" },
    { act: "f_expense", key: "act_spent", icon: "spent", tone: "red" },
    { act: "f_rolls", key: "act_rolls", icon: "roll", tone: "amber" },
    { act: "f_finish", key: "act_finish", icon: "rolldone", tone: "amber" },
    { act: "go_clients", key: "act_clients", icon: "people", tone: "plain" },
    { act: "f_calc", key: "act_calc", icon: "calc", tone: "plain" }
  ];
  let h = `<div class="hello"><h1>${esc(greet())}!</h1><p>${esc(longDate(today()))}</p></div>`;
  h += setupChecklist();
  h += `<div class="actions-grid">${actions.map((a) =>
    `<button type="button" class="action ${a.tone}" data-act="${a.act}"><span class="ic">${ico(a.icon)}</span><span>${esc(t(a.key))}</span></button>`).join("")}</div>`;
  h += `<div class="stats">
    <a class="stat" href="#stock"><span>${t("in_stock")}</span><b class="${stock < 0 ? "neg" : ""}">${esc(packs(stock))}</b>${packsLow() ? `<small><span class="pill warn">${t("low")}</span></small>` : ""}</a>
    <a class="stat" href="#debts"><span>${t("owed_you")}</span><b class="${owed > 0 ? "neg" : ""}">${esc(money(owed))}</b></a>
    <a class="stat wide" href="#stock"><span>${t("paper_left")}</span><b>${esc(kgf(paperKg()))}</b><small>${paperLow() ? `<span class="pill warn">${t("low")}</span> ` : ""}${paperLine()}</small></a>
    <a class="stat wide" href="#report"><span>${t("profit_month")}</span><b class="${ms.profit < 0 ? "neg" : "pos"}">${esc(money(ms.profit))}</b><small>${esc(t("profit_note"))}</small></a>
  </div>`;
  const ev = allEvents().slice(0, 8);
  h += `<div class="card"><h2>${t("recent")}</h2>${ev.length ? `<div class="list">${ev.map((e) => e.f(e.x)).join("")}</div>` : `<div class="empty">${t("empty")}</div>`}</div>`;
  return h;
}

/* --- Sales --- */
function vSales() {
  const ms = monthStats(S.month);
  let h = head(t("nav_sales"), btnPrimary("f_sale", t("act_sold")));
  h += monthSwitch();
  h += `<div class="stats">
    <div class="stat"><span>${t("sold_month")}</span><b>${esc(packs(ms.sold))}</b></div>
    <div class="stat"><span>${t("revenue")}</span><b>${esc(money(ms.revenue))}</b></div>
    ${ms.unpaid > 0.004 ? `<div class="stat wide"><span>${t("unpaid")}</span><b class="neg">${esc(money(ms.unpaid))}</b></div>` : ""}
  </div>`;
  h += grouped([...ms.sales].sort(byNewest), saleRow);
  return h;
}

/* --- Debts & clients --- */
function vDebts() {
  const d = debts(), owed = totalOwed();
  let h = head(t("nav_debts"), btnPrimary("f_payment", t("act_paid"), "cash") + btnPlain("f_client", t("add_client"), "plus"));
  h += `<div class="stats"><div class="stat wide"><span>${t("owed_total")}</span><b class="${owed > 0 ? "neg" : "pos"}">${esc(money(owed))}</b></div></div>`;
  const debtors = S.customers.filter((c) => d[c.id] > 0.004).sort((a, b) => d[b.id] - d[a.id]);
  h += debtors.length ? `<div class="stack">${debtors.map((c) => debtorCard(c, d[c.id])).join("")}</div>` : emptyBox(t("no_debts"));
  h += `<div class="section-title" id="clients">${t("clients")}</div>`;
  h += !S.customers.length ? emptyBox() : `<div class="list">${[...S.customers].sort(byName).map((c) => {
    const v = d[c.id] || 0;
    const price = +c.price > 0 ? money(c.price) + " / " + t("packs_unit") : "";
    return row({
      kind: "customer", id: c.id, title: c.name, sub: [c.phone, price].filter(Boolean).join(" · "),
      end: v > 0.004 ? money(v) : "", endSub: v > 0.004 ? `<small>${t("debt")}</small>` : `<span class="pill good">${t("no_debt_pill")}</span>`
    });
  }).join("")}</div>`;
  return h;
}
const phoneDigits = (p) => String(p || "").replace(/\D/g, "");
function waLink(c, amount) {
  const msg = t("wa_msg", { sum: money(amount), biz: S.settings.business || "МИМ" });
  return "https://wa.me/" + phoneDigits(c.phone) + "?text=" + encodeURIComponent(msg);
}
function contactButtons(c, amount) {
  if (phoneDigits(c.phone).length < 7) return "";
  return `<a class="btn" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">${ico("phone")}${t("call")}</a>` +
    (amount > 0.004 ? `<a class="btn" href="${esc(waLink(c, amount))}" target="_blank" rel="noopener">${ico("chat")}${t("whatsapp")}</a>` : "");
}
function debtorCard(c, amount) {
  const lp = lastPayment(c.id);
  return `<div class="debtor">
    <div class="debtor-top"><button type="button" data-act="open" data-kind="customer" data-id="${esc(c.id)}">${esc(c.name)}</button><b>${esc(money(amount))}</b></div>
    <small>${t("last_payment")}: ${lp ? esc(dateLabel(lp)) : t("never")}${c.phone ? " · " + esc(c.phone) : ""}</small>
    <div class="btn-row">${btnPrimary("f_payment", t("act_paid"), "cash", c.id)}${contactButtons(c, amount)}</div></div>`;
}

/* --- Stock: packs + jumbo rolls --- */
function rollCard(r) {
  const rem = rollRemaining(r), made = packsFromRoll(r.id), k = kgPerPack().kg;
  const pct = Math.max(0, Math.min(100, (rem / (+r.weight_kg || 1)) * 100));
  return `<div class="roll-card">
    <div class="roll-top"><button type="button" data-act="open" data-kind="roll" data-id="${esc(r.id)}"><span class="roll-no">${esc(rollName(r))}</span> ${statusPill(r)}</button>
      <b class="num">${r.status === "use" ? "≈ " : ""}${esc(kgf(rem))}</b></div>
    <div class="track"><i style="width:${pct}%"></i></div>
    <small>${esc(t("of_kg", { kg: kgf(r.weight_kg) }))}${r.status === "use" ? " · " + esc(t("made_from", { n: packs(made) })) + " · " + esc(t("more_n", { n: packs(Math.floor(k > 0 ? rem / k : 0)) })) : ""}</small>
    <div class="btn-row">${r.status === "use" ? btnPrimary("f_finish", t("act_finish"), "rolldone", r.id) : btnPlain("roll_start", t("put_on_machine"), "roll", r.id)}</div>
  </div>`;
}
function vStock() {
  const stock = packStock(), ms = monthStats(thisMonth()), k = kgPerPack();
  const mName = t("months_nom")[new Date().getMonth()];
  let h = head(t("nav_stock"), btnPrimary("f_made", t("act_made"), "made"));
  h += `<div class="stats">
    <div class="stat wide"><span>${t("in_stock")}</span><b class="${stock < 0 ? "neg" : ""}">${esc(packs(stock))}</b>
      <small>${packsLow() ? `<span class="pill warn">${t("low")}</span> ` : ""}${esc(t("stock_formula"))}</small></div>
    <div class="stat"><span>${t("made_month")} · ${esc(mName)}</span><b>${esc(packs(ms.made))}</b></div>
    <div class="stat"><span>${t("sold_month")} · ${esc(mName)}</span><b>${esc(packs(ms.sold))}</b></div>
  </div>`;

  h += `<div class="section-title">${t("rolls_title")}<span class="btn-row">${btnPrimary("f_rolls", t("act_rolls"), "roll")}</span></div>`;
  h += `<div class="card"><table class="kv-table"><tbody>
    <tr><td>${t("paper_left")}</td><td>${paperLow() ? `<span class="pill warn">${t("low")}</span> ` : ""}${esc(kgf(paperKg()))}</td></tr>
    <tr><td>${t("can_make")}</td><td>≈ ${esc(packs(packsPossible()))}</td></tr>
    ${paperDaysLeft() !== null ? `<tr><td>${t("enough_for")}</td><td>≈ ${esc(t("days_n", { n: nf0.format(paperDaysLeft()) }))}</td></tr>` : ""}
    <tr><td>${t("paper_per_pack")}</td><td>${esc(gf(k.kg))} <small class="pill ${k.actual ? "good" : ""}">${t(k.actual ? "real" : "norm")}</small></td></tr>
    ${paperPricePerKg() > 0 ? `<tr><td>${t("paper_price")}</td><td>${esc(money(paperPricePerKg()))} / ${t("kg")}</td></tr>` : ""}
  </tbody></table></div>`;

  const inUse = rollsByStatus("use"), inStock = rollsByStatus("stock");
  if (!S.rolls.length) h += emptyBox(t("no_rolls"));
  if (inUse.length) h += `<h3 class="day">${t("st_use")}</h3><div class="stack">${inUse.map(rollCard).join("")}</div>`;
  if (inStock.length) h += `<h3 class="day" style="margin-top:18px">${t("st_stock")} · ${inStock.length}</h3><div class="stack">${inStock.map(rollCard).join("")}</div>`;

  const done = doneRolls().slice(0, 12);
  if (done.length) {
    h += `<div class="section-title">${t("done_rolls")}</div><div class="table-wrap"><table class="data-table"><thead><tr>
      <th>${t("roll")}</th><th>${t("finished")}</th><th>${t("packs_made")}</th><th>${t("g_per_pack")}</th><th>${t("cost_per_pack")}</th><th>${t("vs_norm")}</th></tr></thead><tbody>
      ${done.map((r) => {
      const x = rollResult(r);
      return `<tr data-act="open" data-kind="roll" data-id="${esc(r.id)}"><td><b>${esc(rollName(r))}</b><br><small>${esc(kgf(r.weight_kg))}</small></td><td>${esc(dateLabel(r.finished_date))}</td>
          <td>${esc(qf(x.made))}</td><td>${x.kgPerPack ? esc(nf0.format(x.kgPerPack * 1000)) : "—"}</td><td>${x.costPerPack !== null && +r.cost > 0 ? esc(money(x.costPerPack)) : "—"}</td>
          <td>${x.vsNorm !== null ? `<span class="pill ${x.vsNorm > 5 ? "bad" : x.vsNorm < -5 ? "warn" : "good"}">${x.vsNorm > 0 ? "+" : ""}${nf0.format(x.vsNorm)}%</span>` : "—"}</td></tr>`;
    }).join("")}
      </tbody></table></div><p class="help">${esc(t("vs_norm_help"))}</p>`;
  }
  const prod = S.production.filter((p) => (p.date || "").slice(0, 7) === thisMonth()).sort(byNewest);
  h += `<div class="section-title">${t("production_hist")}</div>` + grouped(prod, madeRow);
  return h;
}

/* --- Report --- */
function vReport() {
  const ms = monthStats(S.month), pc = packCost(S.month);
  let h = `<div class="print-only"><h1>МИМ Дафтар — ${esc(S.settings.business || "")} — ${esc(monthLabel(S.month))}</h1></div>`;
  h += head(t("report_title"));
  h += monthSwitch();
  h += `<div class="stats">
    <div class="stat wide"><span>${t("profit")}</span><b class="${ms.profit < 0 ? "neg" : "pos"}">${esc(money(ms.profit))}</b><small>${esc(t("profit_note"))}</small></div>
    <div class="stat"><span>${t("made_month")}</span><b>${esc(packs(ms.made))}</b></div>
    <div class="stat"><span>${t("sold_month")}</span><b>${esc(packs(ms.sold))}</b></div>
  </div>`;
  h += `<div class="card"><table class="kv-table"><tbody>
    <tr><td>${t("revenue")}</td><td>${esc(money(ms.revenue))}</td></tr>
    <tr><td>${t("received")}</td><td>${esc(money(ms.received))}</td></tr>
    <tr><td>${t("expenses")}</td><td class="${ms.expenses > 0 ? "neg" : ""}">${ms.expenses > 0 ? "−" : ""}${esc(money(ms.expenses))}</td></tr>
    <tr><td>${t("rolls_bought")}${ms.rollsKg ? " (" + esc(kgf(ms.rollsKg)) + ")" : ""}</td><td class="${ms.raw > 0 ? "neg" : ""}">${ms.raw > 0 ? "−" : ""}${esc(money(ms.raw))}</td></tr>
    <tr class="total"><td>${t("profit")}</td><td class="${ms.profit < 0 ? "neg" : "pos"}">${esc(money(ms.profit))}</td></tr>
  </tbody></table></div>`;

  h += `<div class="card"><h2>${t("one_pack_title")}<button type="button" class="link no-print" data-act="f_calc">${t("act_calc")}</button></h2><table class="kv-table"><tbody>
    <tr><td>${t("paper_per_pack")} <small class="pill ${pc.actual ? "good" : ""}">${t(pc.actual ? "real" : "norm")}</small></td><td>${esc(gf(pc.kg))}</td></tr>
    <tr><td>${t("cost_paper")}</td><td>${esc(money(pc.paper))}</td></tr>
    <tr><td>${t("cost_bag")}</td><td>${esc(money(pc.bag))}</td></tr>
    <tr><td>${t("cost_other")}</td><td>${esc(money(pc.overhead))}</td></tr>
    <tr class="total"><td>${t("cost_total")}</td><td>${esc(money(pc.total))}</td></tr>
    <tr><td>${t("pack_price")}</td><td>${esc(money(pc.price))}</td></tr>
    <tr class="total"><td>${t("profit_per_pack")}</td><td class="${pc.profit < 0 ? "neg" : "pos"}">${esc(money(pc.profit))}</td></tr>
  </tbody></table><p class="help">${esc(t("one_pack_help"))}</p></div>`;

  const cats = Object.entries(ms.byCat).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    const mx = cats[0][1] || 1;
    h += `<div class="card"><h2>${t("by_cat")}</h2>${cats.map(([c, v]) =>
      `<div class="hbar"><span>${esc(catL(c))}</span><b class="num">${esc(money(v))}</b><div class="track"><i style="width:${Math.max((v / mx) * 100, 2)}%"></i></div></div>`).join("")}</div>`;
  }
  h += `<div class="section-title">${t("expense_list")}<span class="btn-row no-print">${btnPrimary("f_expense", t("act_spent"), "spent")}</span></div>`;
  const list = [...ms.exps.map((x) => ({ x, date: x.date, created_at: x.created_at, f: expenseRow })),
  ...ms.rolls.map((x) => ({ x, date: x.date, created_at: x.created_at, f: rollBuyRow }))].sort(byNewest);
  h += list.length ? grouped(list, (e) => e.f(e.x)) : emptyBox();
  h += `<div class="card no-print" style="margin-top:20px"><h2>${t("tools")}</h2><div class="btn-row">
    ${btnPlain("print", t("print"), "print")}${btnPlain("csv_sales", t("csv_sales"), "download")}${btnPlain("csv_exp", t("csv_exp"), "download")}${btnPlain("backup", t("backup"), "download")}
    </div><p class="help">${esc(t("backup_hint"))}</p></div>`;
  return h;
}

/* ---------------- 9. Pop-up sheet & form helpers ---------------- */
let lastFocus = null;
function openSheet(title, html, mount) {
  lastFocus = document.activeElement;
  $("#sheet-title").textContent = title;
  // A brand-new body element, so listeners from the previous form are gone
  const old = $("#sheet-body"), body = old.cloneNode(false);
  old.replaceWith(body);
  body.innerHTML = html;
  $("#sheet").hidden = false;
  document.body.style.overflow = "hidden";
  if (mount) mount(body);
}
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheet-body").innerHTML = "";
  document.body.style.overflow = "";
  if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { }
}
const field = (id, label, input, hint) => `<div class="field"><label for="${id}">${esc(label)}</label>${input}${hint ? `<small>${hint}</small>` : ""}</div>`;
const textIn = (id, v, extra = "") => `<input id="${id}" value="${esc(v ?? "")}" autocomplete="off" ${extra}>`;
const numIn = (id, v, ph) => `<input id="${id}" inputmode="decimal" autocomplete="off" value="${v === undefined || v === null || v === "" ? "" : esc(v)}" ${ph !== undefined ? `placeholder="${esc(ph)}"` : ""}>`;
const dateIn = (id, v) => `<input id="${id}" type="date" value="${esc(v || today())}" max="${today()}">`;
const selectIn = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const stepper = (id, v) => `<div class="stepper"><button type="button" data-step="-1" data-for="${id}" aria-label="−1">−</button>
  <input id="${id}" inputmode="numeric" autocomplete="off" value="${esc(v ?? "")}" placeholder="0"><button type="button" data-step="1" data-for="${id}" aria-label="+1">+</button></div>
  <div class="quick-q">${[10, 50, 100, 500].map((n) => `<button type="button" data-step="${n}" data-for="${id}">+${n}</button>`).join("")}</div>`;
const formButtons = (table, id) => `<p class="err" id="f-err" role="alert"></p><div class="actions">
  <button type="submit" class="btn primary big" id="f-save" style="width:auto">${t("save")}</button>
  <button type="button" class="btn ghost" data-act="close">${t("cancel")}</button>
  ${id ? `<button type="button" class="btn danger" data-act="del" data-table="${table}" data-id="${esc(id)}">${t("delete")}</button>` : ""}</div>`;
const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
function fail(msg) { const e = $("#f-err"); if (e) e.textContent = msg; else toast(msg); return false; }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => (el.hidden = true), 2600); }

function bindSteppers(root) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]"); if (!b) return;
    const input = document.getElementById(b.dataset.for);
    input.value = String(Math.max(0, (num(input.value) || 0) + Number(b.dataset.step)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function bindChoice(root, selector, onPick) {
  root.querySelectorAll(selector).forEach((group) => group.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    group.querySelectorAll("button[data-v]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    onPick && onPick(b.dataset.v);
  }));
}
const choiceVal = (root, selector) => { const b = root.querySelector(selector + ' button[aria-pressed="true"]'); return b ? b.dataset.v : ""; };
const choice = (id, options, selected) => `<div class="choice" id="${id}">${options.map(([v, l]) =>
  `<button type="button" data-v="${esc(v)}" aria-pressed="${v === selected}">${esc(l)}</button>`).join("")}</div>`;

function errText(e) {
  const m = (e && e.message) || "";
  if (DB.isNetworkError(e)) return t("net_err");
  if (/row-level security|permission|JWT|not authorized/i.test(m)) return t("no_access");
  if (/paid_not_more/i.test(m)) return t("err_paid_more");
  return m || t("net_err");
}
/** Run a database change, refresh the screen, show "Saved". Works offline too. */
async function save(work, msg) {
  const btn = $("#f-save"); if (btn) btn.disabled = true;
  try {
    await work();
    applyView(); render();
    const queued = DB.pendingCount() > 0;
    toast(msg || (queued ? t("saved_offline") : t("saved")));
    if (queued && S.online) DB.sync();
    return true;
  } catch (e) { console.error(e); fail(errText(e)); if (btn) btn.disabled = false; return false; }
}
function onSubmit(handler) {
  $("#frm").addEventListener("submit", async (e) => { e.preventDefault(); fail(""); if (await handler()) closeSheet(); });
}

/* ---------------- 10. Forms ---------------- */

/* Sold napkins */
function saleForm(presetClient) {
  const clients = [...S.customers].sort(byName);
  const stock = packStock();
  openSheet(t("act_sold"), `<form id="frm" novalidate>
    ${field("f-client", t("client"), selectIn("f-client", [["", t("no_client")], ...clients.map((c) => [c.id, c.name])], presetClient || ""))}
    ${field("f-newc", t("new_client_name"), textIn("f-newc", ""))}
    ${field("f-qty", t("qty_packs"), stepper("f-qty", ""), `<span class="warn-text" id="f-warn"></span>`)}
    ${field("f-price", t("pack_price") + ", " + S.settings.currency, numIn("f-price", clientPrice(presetClient) || ""))}
    <div class="total-box"><span>${t("total")}</span><b id="f-total">${esc(money(0))}</b></div>
    <div class="field"><span class="label">${t("money_taken")}</span>${choice("f-paymode", [["all", t("paid_all")], ["part", t("paid_part")], ["none", t("paid_none")]], "all")}</div>
    <div id="f-partbox" hidden>${field("f-paid", t("paid_amount") + ", " + S.settings.currency, numIn("f-paid", ""))}</div>
    <div class="row2">${field("f-date", t("date"), dateIn("f-date"))}${field("f-note", t("note"), textIn("f-note", ""))}</div>
    ${formButtons()}</form>`, (root) => {
    bindSteppers(root);
    const recalc = () => {
      const q = num(val("f-qty")) || 0, p = num(val("f-price")) || 0;
      $("#f-total").textContent = money(q * p);
      $("#f-warn").textContent = q > stock ? t("warn_stock", { n: packs(stock) }) : "";
    };
    root.addEventListener("input", recalc);
    $("#f-client").addEventListener("change", () => { $("#f-newc").value = ""; const p = clientPrice(val("f-client")); if (p) $("#f-price").value = p; recalc(); });
    $("#f-newc").addEventListener("input", () => { if (val("f-newc")) $("#f-client").value = ""; });
    bindChoice(root, "#f-paymode", (v) => { $("#f-partbox").hidden = v !== "part"; });
    recalc();
    onSubmit(async () => {
      const qty = num(val("f-qty")), price = num(val("f-price"));
      if (!(qty > 0)) return fail(t("err_qty"));
      if (!(price >= 0)) return fail(t("err_price"));
      const total = r2(qty * price);
      const mode = choiceVal(root, "#f-paymode");
      const paid = mode === "all" ? total : mode === "none" ? 0 : num(val("f-paid"));
      if (mode === "part" && !(paid >= 0)) return fail(t("err_amount"));
      if (paid > total + 0.004) return fail(t("err_paid_more"));
      let cid = val("f-client");
      const newName = val("f-newc");
      if (paid < total - 0.004 && !cid && !newName) return fail(t("err_client_debt"));
      return save(async () => {
        if (!cid && newName) { cid = DB.newId(); await DB.insert("customers", { id: cid, name: newName }); }
        await DB.insert("sales", { date: val("f-date") || today(), customer_id: cid || null, qty, price, paid: r2(paid), note: val("f-note") || null });
      });
    });
  });
}

/* Made napkins — from which roll, and was the roll finished */
function rollOptions(includeNone) {
  const list = [...rollsByStatus("use"), ...rollsByStatus("stock")];
  const opts = list.map((r) => [r.id, rollName(r) + " — " + t("st_" + r.status) + ", ≈ " + kgf(rollRemaining(r))]);
  return includeNone ? [["", t("no_roll")], ...opts] : opts;
}
function madeForm() {
  const use = rollsByStatus("use"), stockRolls = rollsByStatus("stock");
  const pre = use[0] ? use[0].id : stockRolls[0] ? stockRolls[0].id : "";
  openSheet(t("act_made"), `<form id="frm" novalidate>
    ${field("f-qty", t("qty_packs"), stepper("f-qty", ""))}
    ${field("f-roll", t("which_roll"), selectIn("f-roll", rollOptions(true), pre))}
    <div class="field"><span class="label">${t("roll_finished_q")}</span>${choice("f-fin", [["no", t("no")], ["yes", t("yes_finished")]], "no")}</div>
    <div id="f-finbox" hidden>${field("f-left", t("leftover_kg"), numIn("f-left", "", "0"), esc(t("leftover_help")))}</div>
    <div class="row2">${field("f-date", t("date"), dateIn("f-date"))}${field("f-note", t("note"), textIn("f-note", ""))}</div>
    ${formButtons()}</form>`, (root) => {
    bindSteppers(root);
    bindChoice(root, "#f-fin", (v) => { $("#f-finbox").hidden = v !== "yes"; });
    onSubmit(async () => {
      const qty = num(val("f-qty"));
      if (!(qty > 0)) return fail(t("err_qty"));
      const rid = val("f-roll"), roll = rid ? byId(S.rolls, rid) : null;
      const finish = choiceVal(root, "#f-fin") === "yes";
      if (finish && !roll) return fail(t("err_roll"));
      const left = num(val("f-left")) || 0;
      const date = val("f-date") || today();
      const ok = await save(async () => {
        await DB.insert("production", { date, qty, roll_id: rid || null, note: val("f-note") || null });
        if (roll && finish) await DB.update("rolls", roll.id, { status: "done", finished_date: date, leftover_kg: left });
        else if (roll && roll.status === "stock") await DB.update("rolls", roll.id, { status: "use" });
      });
      if (ok && roll && finish) setTimeout(() => rollSheet(byId(S.rolls, roll.id)), 50);
      return ok;
    });
  });
}

/* Roll finished (without recording packs now) */
function finishForm(presetId) {
  const use = rollsByStatus("use");
  if (!use.length && !presetId) { toast(t("no_roll_in_use")); return; }
  const opts = (presetId ? [byId(S.rolls, presetId)] : use).filter(Boolean).map((r) => [r.id, rollName(r) + " — " + t("made_from", { n: packs(packsFromRoll(r.id)) })]);
  openSheet(t("act_finish"), `<form id="frm" novalidate>
    ${field("f-roll", t("roll"), selectIn("f-roll", opts, presetId || opts[0][0]))}
    <p class="help" style="margin:0">${esc(t("finish_help"))}</p>
    ${field("f-left", t("leftover_kg"), numIn("f-left", "", "0"), esc(t("leftover_help")))}
    ${field("f-date", t("date"), dateIn("f-date"))}
    ${formButtons()}</form>`, () => onSubmit(async () => {
    const rid = val("f-roll");
    const ok = await save(() => DB.update("rolls", rid, { status: "done", finished_date: val("f-date") || today(), leftover_kg: num(val("f-left")) || 0 }));
    if (ok) setTimeout(() => rollSheet(byId(S.rolls, rid)), 50);
    return ok;
  }));
}

/* Bought jumbo rolls (one or many at once) */
function rollLine(i, v) { return `<div class="roll-line" data-line="${i}"><span class="roll-no">№${i}</span>${numIn("w-" + i, v || "", t("kg"))}<button type="button" class="x" data-rm="${i}" aria-label="×">×</button></div>`; }
function rollsForm() {
  let next = nextRollLabel();
  const first = next;
  const last = [...S.rolls].sort(byNewest)[0];
  openSheet(t("act_rolls"), `<form id="frm" novalidate>
    <div class="field"><span class="label">${t("roll_weights")}</span><div class="stack" id="lines">${rollLine(next++)}</div>
      <button type="button" class="add-line" id="add-line">${t("add_roll")}</button>
      <small>${esc(t("roll_label_help"))}</small></div>
    <div class="total-box"><span>${t("total_weight")}</span><b id="f-kg">0 ${t("kg")}</b></div>
    ${field("f-cost", t("paid_for_all") + ", " + S.settings.currency, numIn("f-cost", ""), `<span id="f-perkg"></span>`)}
    <div class="row2">${field("f-sup", t("supplier"), textIn("f-sup", last ? last.supplier : ""))}${field("f-gsm", t("gsm"), numIn("f-gsm", last && last.gsm ? last.gsm : S.settings.gsm))}</div>
    <div class="row2">${field("f-date", t("date"), dateIn("f-date"))}${field("f-note", t("note"), textIn("f-note", ""))}</div>
    ${formButtons()}</form>`, (root) => {
    const lines = $("#lines");
    const weights = () => [...lines.querySelectorAll(".roll-line")].map((l) => ({ label: +l.dataset.line, kg: num(val("w-" + l.dataset.line)) }));
    const recalc = () => {
      const kg = sum(weights(), (w) => (w.kg > 0 ? w.kg : 0)), cost = num(val("f-cost")) || 0;
      $("#f-kg").textContent = kgf(kg);
      $("#f-perkg").textContent = kg > 0 && cost > 0 ? money(cost / kg) + " / " + t("kg") : "";
    };
    $("#add-line").addEventListener("click", () => { lines.insertAdjacentHTML("beforeend", rollLine(next++)); recalc(); });
    lines.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]");
      if (b && lines.children.length > 1) {
        b.closest(".roll-line").remove();
        // renumber so numbers stay in order
        next = first;
        lines.querySelectorAll(".roll-line").forEach((l) => { const v = val("w-" + l.dataset.line); l.outerHTML = rollLine(next++, v); });
        recalc();
      }
    });
    root.addEventListener("input", recalc);
    onSubmit(async () => {
      const ws = weights();
      if (!ws.length || ws.some((w) => !(w.kg > 0))) return fail(t("err_weight"));
      const cost = num(val("f-cost"));
      if (!(cost >= 0)) return fail(t("err_amount"));
      const totalKg = sum(ws, (w) => w.kg), gsm = num(val("f-gsm"));
      return save(async () => {
        for (const w of ws) {
          await DB.insert("rolls", {
            label: w.label, date: val("f-date") || today(), supplier: val("f-sup") || null,
            weight_kg: w.kg, cost: r2(cost * (w.kg / totalKg)), gsm: gsm > 0 ? gsm : null, status: "stock", leftover_kg: 0, note: val("f-note") || null
          });
        }
      }, t("rolls_saved", { n: ws.length }));
    });
  });
}

/* One roll: details and actions */
function rollSheet(r) {
  if (!r) return;
  const x = rollResult(r), rem = rollRemaining(r);
  const pairs = [
    [t("status"), t("st_" + r.status)],
    [t("bought"), dateLabel(r.date) + (r.supplier ? " · " + r.supplier : "")],
    [t("weight"), kgf(r.weight_kg)],
    [t("price"), +r.cost > 0 ? money(r.cost) + " (" + money(r.cost / r.weight_kg) + "/" + t("kg") + ")" : ""],
    [t("gsm"), r.gsm ? qf(r.gsm) + " " + t("gsm_unit") : ""],
    [t("packs_made"), packs(x.made)]
  ];
  if (r.status === "use") pairs.push([t("remaining"), "≈ " + kgf(rem)]);
  if (r.status === "done") {
    pairs.push([t("finished"), dateLabel(r.finished_date)], [t("leftover_kg"), +r.leftover_kg ? kgf(r.leftover_kg) : ""]);
    if (x.kgPerPack) pairs.push([t("paper_per_pack"), gf(x.kgPerPack)], [t("norm"), gf(normKgPerPack())]);
    if (x.costPerPack !== null && +r.cost > 0) pairs.push([t("cost_paper"), money(x.costPerPack)]);
  }
  if (r.note) pairs.push([t("note"), r.note]);
  const verdict = r.status === "done" && x.vsNorm !== null
    ? `<div class="banner ${x.vsNorm > 5 ? "bad" : "good"}"><span>${esc(x.vsNorm > 5 ? t("used_more", { p: nf0.format(x.vsNorm) }) : x.vsNorm < -5 ? t("used_less", { p: nf0.format(-x.vsNorm) }) : t("used_normal"))}</span></div>` : "";
  openSheet(t("roll") + " " + rollName(r), `${verdict}<dl class="kv">${pairs.filter((p) => p[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <p class="err" id="f-err" role="alert"></p>
    <div class="btn-row">
      ${r.status === "stock" ? btnPrimary("roll_start", t("put_on_machine"), "roll", r.id) : ""}
      ${r.status === "use" ? btnPrimary("f_finish", t("act_finish"), "rolldone", r.id) : ""}
      ${r.status === "done" ? btnPlain("roll_reopen", t("reopen"), "roll", r.id) : ""}
      ${btnPlain("roll_edit", t("edit"), "", r.id)}
      <button type="button" class="btn danger" data-act="del" data-table="rolls" data-id="${esc(r.id)}">${t("delete")}</button>
    </div>`);
}
function rollEditForm(r) {
  openSheet(t("roll") + " " + rollName(r), `<form id="frm" novalidate>
    <div class="row2">${field("f-label", t("roll_no"), numIn("f-label", r.label))}${field("f-kg", t("weight") + ", " + t("kg"), numIn("f-kg", r.weight_kg))}</div>
    <div class="row2">${field("f-cost", t("price") + ", " + S.settings.currency, numIn("f-cost", r.cost))}${field("f-gsm", t("gsm"), numIn("f-gsm", r.gsm || ""))}</div>
    <div class="row2">${field("f-sup", t("supplier"), textIn("f-sup", r.supplier || ""))}${field("f-date", t("bought"), dateIn("f-date", r.date))}</div>
    ${r.status === "done" ? field("f-left", t("leftover_kg"), numIn("f-left", r.leftover_kg || "")) : ""}
    ${field("f-note", t("note"), textIn("f-note", r.note || ""))}
    ${formButtons()}</form>`, () => onSubmit(async () => {
    const label = Math.round(num(val("f-label"))), kg = num(val("f-kg")), cost = num(val("f-cost"));
    if (!(label > 0)) return fail(t("err_qty"));
    if (!(kg > 0)) return fail(t("err_weight"));
    const row = {
      label, weight_kg: kg, cost: cost >= 0 ? r2(cost) : 0, gsm: num(val("f-gsm")) > 0 ? num(val("f-gsm")) : null,
      supplier: val("f-sup") || null, date: val("f-date") || r.date, note: val("f-note") || null
    };
    if (r.status === "done") row.leftover_kg = num(val("f-left")) || 0;
    return save(() => DB.update("rolls", r.id, row));
  }));
}

/* Got money for a debt */
function paymentForm(presetClient) {
  if (!S.customers.length) { toast(t("need_client")); clientForm(); return; }
  const d = debts();
  const clients = [...S.customers].sort((a, b) => (d[b.id] || 0) - (d[a.id] || 0) || byName(a, b));
  const pre = presetClient || (clients[0] && d[clients[0].id] > 0 ? clients[0].id : "");
  const label = (c) => c.name + (d[c.id] > 0.004 ? " — " + t("debt") + " " + money(d[c.id]) : "");
  openSheet(t("act_paid"), `<form id="frm" novalidate>
    ${field("f-client", t("client"), selectIn("f-client", [["", "—"], ...clients.map((c) => [c.id, label(c)])], pre))}
    ${field("f-amt", t("amount") + ", " + S.settings.currency, numIn("f-amt", pre && d[pre] > 0 ? r2(d[pre]) : ""))}
    <div class="row2">${field("f-date", t("date"), dateIn("f-date"))}${field("f-note", t("note"), textIn("f-note", ""))}</div>
    ${formButtons()}</form>`, () => {
    $("#f-client").addEventListener("change", () => { const v = d[val("f-client")] || 0; $("#f-amt").value = v > 0 ? r2(v) : ""; });
    onSubmit(async () => {
      const cid = val("f-client"), amount = num(val("f-amt"));
      if (!cid) return fail(t("err_client"));
      if (!(amount > 0)) return fail(t("err_amount"));
      return save(() => DB.insert("payments", { date: val("f-date") || today(), customer_id: cid, amount: r2(amount), note: val("f-note") || null }));
    });
  });
}

/* Spent money */
function expenseForm() {
  openSheet(t("act_spent"), `<form id="frm" novalidate>
    <div class="field"><span class="label">${t("category")}</span>${choice("f-cat", EXPENSE_CATS.map((c) => [c, catL(c)]), EXPENSE_CATS[0]).replace('class="choice"', 'class="choice cats"')}</div>
    ${field("f-amt", t("amount") + ", " + S.settings.currency, numIn("f-amt", ""))}
    <div class="row2">${field("f-date", t("date"), dateIn("f-date"))}${field("f-note", t("note"), textIn("f-note", ""))}</div>
    <p class="help" style="margin:0">${esc(t("rolls_not_here"))}</p>
    ${formButtons()}</form>`, (root) => {
    bindChoice(root, "#f-cat");
    onSubmit(async () => {
      const amount = num(val("f-amt"));
      if (!(amount > 0)) return fail(t("err_amount"));
      return save(() => DB.insert("expenses", { date: val("f-date") || today(), category: choiceVal(root, "#f-cat") || "other", amount: r2(amount), note: val("f-note") || null }));
    });
  });
}

/* Client (restaurant) */
function clientForm(c) {
  openSheet(c ? c.name : t("add_client"), `<form id="frm" novalidate>
    ${field("f-name", t("name"), textIn("f-name", c ? c.name : ""))}
    ${field("f-phone", t("phone"), textIn("f-phone", c ? c.phone : "", 'inputmode="tel" placeholder="+992 …"'))}
    ${field("f-price", t("client_price") + ", " + S.settings.currency, numIn("f-price", c && c.price ? c.price : "", String(S.settings.default_price || "")), esc(t("client_price_hint")))}
    ${field("f-note", t("note"), textIn("f-note", c ? c.note : ""))}
    ${formButtons("customers", c && c.id)}</form>`, () => onSubmit(async () => {
    const name = val("f-name");
    if (!name) return fail(t("err_name"));
    const price = num(val("f-price"));
    const row = { name, phone: val("f-phone") || null, price: price > 0 ? r2(price) : null, note: val("f-note") || null };
    return save(() => (c ? DB.update("customers", c.id, row) : DB.insert("customers", row)));
  }));
}

/* Settings */
function settingsForm() {
  const s = S.settings, stock = packStock();
  openSheet(t("settings"), `<form id="frm" novalidate>
    <h3 class="form-sec">${t("sec_packs")}</h3>
    ${field("f-price", t("pack_price") + ", " + s.currency, numIn("f-price", +s.default_price || ""))}
    <div class="row2">${field("f-stock", t("packs_now"), numIn("f-stock", r2(stock), "0"))}${field("f-min", t("min_packs"), numIn("f-min", +s.min_stock || ""))}</div>
    <p class="help" style="margin:-6px 2px 0">${esc(t("packs_hint"))}</p>
    <h3 class="form-sec">${t("sec_napkin")}</h3>
    <div class="row2">${field("f-size", t("napkin_size"), numIn("f-size", s.napkin_size_cm))}${field("f-sheets", t("sheets_per_pack"), numIn("f-sheets", s.sheets_per_pack))}</div>
    <div class="row2">${field("f-gsm", t("gsm"), numIn("f-gsm", s.gsm))}${field("f-waste", t("waste_pct"), numIn("f-waste", s.waste_pct))}</div>
    <div class="field"><span class="label">${t("ply")}</span>${choice("f-ply", [["1", t("ply1")], ["2", t("ply2")], ["3", t("ply3")]], String(s.ply || 1))}</div>
    <div class="row2">${field("f-bag", t("bag_cost") + ", " + s.currency, numIn("f-bag", +s.pack_cost || ""))}${field("f-minpaper", t("min_paper"), numIn("f-minpaper", +s.min_paper_kg || ""))}</div>
    <p class="help" style="margin:-6px 2px 0" id="f-norm"></p>
    <h3 class="form-sec">${t("sec_other")}</h3>
    <div class="row2">${field("f-biz", t("business"), textIn("f-biz", s.business))}${field("f-cur", t("currency"), selectIn("f-cur", CURRENCIES.map((c) => [c, c]), s.currency))}</div>
    <div class="field"><span class="label">${t("language")}</span><div class="choice">
      <button type="button" data-act="lang" data-lang="tj" aria-pressed="${LANG === "tj"}">Тоҷикӣ</button>
      <button type="button" data-act="lang" data-lang="ru" aria-pressed="${LANG === "ru"}">Русский</button></div></div>
    ${formButtons()}
    <button type="button" class="btn ghost" data-act="logout">${ico("logout")}${t("logout")}</button>
    </form>`, (root) => {
    bindChoice(root, "#f-ply", () => showNorm());
    const showNorm = () => {
      const c = calcNapkin({ size: num(val("f-size")), gsm: num(val("f-gsm")), ply: +choiceVal(root, "#f-ply") || 1, sheets: num(val("f-sheets")), waste: num(val("f-waste")), rollKg: 1 });
      $("#f-norm").textContent = c.paperPerPackKg > 0 ? t("norm_line", { g: gf(c.paperPerPackKg), n: nf.format(Math.round(1 / c.paperPerPackKg * 10) / 10) }) : "";
    };
    root.addEventListener("input", showNorm);
    showNorm();
    onSubmit(async () => {
      const price = num(val("f-price")), now = num(val("f-stock")), min = num(val("f-min"));
      const moved = packStock() - (+S.settings.start_stock || 0);   // made − sold
      const pos = (v, d) => (v > 0 ? v : d);
      return save(() => DB.saveSettings({
        default_price: price > 0 ? r2(price) : 0,
        start_stock: (isFinite(now) ? now : packStock()) - moved,
        min_stock: min > 0 ? min : 0,
        napkin_size_cm: pos(num(val("f-size")), 24),
        sheets_per_pack: Math.round(pos(num(val("f-sheets")), 100)),
        gsm: pos(num(val("f-gsm")), 17),
        ply: +choiceVal(root, "#f-ply") || 1,
        waste_pct: Math.min(Math.max(num(val("f-waste")) || 0, 0), 90),
        pack_cost: pos(num(val("f-bag")), 0),
        min_paper_kg: pos(num(val("f-minpaper")), 0),
        business: val("f-biz") || "МИМ",
        currency: val("f-cur") || "смн"
      }));
    });
  });
}

/* Client card */
function clientSheet(c) {
  const debt = debts()[c.id] || 0;
  const hist = [...S.sales.filter((s) => s.customer_id === c.id).map((x) => ({ x, date: x.date, created_at: x.created_at, f: saleRow })),
  ...S.payments.filter((p) => p.customer_id === c.id).map((x) => ({ x, date: x.date, created_at: x.created_at, f: paymentRow }))].sort(byNewest);
  openSheet(c.name, `<div>
    <span class="help" style="margin:0">${t("debt")}</span>
    <div class="big-debt ${debt > 0.004 ? "neg" : "pos"}">${esc(money(Math.max(debt, 0)))}</div>
    <dl class="kv">${c.phone ? `<dt>${t("phone")}</dt><dd>${esc(c.phone)}</dd>` : ""}<dt>${t("pack_price")}</dt><dd>${esc(money(clientPrice(c.id)))}</dd>${c.note ? `<dt>${t("note")}</dt><dd>${esc(c.note)}</dd>` : ""}</dl>
    <div class="btn-row" style="margin-bottom:18px">
      ${btnPrimary("f_sale", t("act_sold"), "sales", c.id)}
      ${debt > 0.004 ? btnPlain("f_payment", t("act_paid"), "cash", c.id) : ""}
      ${contactButtons(c, debt)}
      ${btnPlain("edit_client", t("edit"), "", c.id)}
    </div>
    <h3 class="day">${t("history")}</h3>
    ${hist.length ? `<div class="list">${hist.map((e) => e.f(e.x)).join("")}</div>` : emptyBox()}</div>`);
}

/* Read-only card for one record, with Delete */
function detailSheet(title, pairs, table, id) {
  openSheet(title, `<dl class="kv">${pairs.filter((p) => p[1] !== "" && p[1] !== null && p[1] !== undefined)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <p class="err" id="f-err" role="alert"></p>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">${t("close")}</button>
    <button type="button" class="btn danger" data-act="del" data-table="${table}" data-id="${esc(id)}">${t("delete")}</button></div>`);
}
function openRecord(kind, id) {
  if (kind === "customer") { const c = byId(S.customers, id); if (c) clientSheet(c); return; }
  if (kind === "roll") return rollSheet(byId(S.rolls, id));
  if (kind === "sale") {
    const s = byId(S.sales, id); if (!s) return;
    const d = saleTotal(s) - (+s.paid || 0);
    detailSheet(t("sale"), [[t("date"), dateLabel(s.date)], [t("client"), clientName(s.customer_id)], [t("qty_packs"), packs(s.qty)],
    [t("pack_price"), money(s.price)], [t("total"), money(saleTotal(s))], [t("paid"), money(s.paid)], [t("debt"), d > 0.004 ? money(d) : ""], [t("note"), s.note]], "sales", id);
    return;
  }
  if (kind === "production") {
    const p = byId(S.production, id); if (!p) return;
    detailSheet(t("made"), [[t("date"), dateLabel(p.date)], [t("qty_packs"), packs(p.qty)], [t("roll"), p.roll_id ? rollName(byId(S.rolls, p.roll_id)) : ""], [t("note"), p.note]], "production", id);
    return;
  }
  if (kind === "payment") { const p = byId(S.payments, id); if (p) detailSheet(t("payment"), [[t("date"), dateLabel(p.date)], [t("client"), clientName(p.customer_id)], [t("amount"), money(p.amount)], [t("note"), p.note]], "payments", id); return; }
  if (kind === "expense") { const e = byId(S.expenses, id); if (e) detailSheet(t("expense"), [[t("date"), dateLabel(e.date)], [t("category"), catL(e.category)], [t("amount"), money(e.amount)], [t("note"), e.note]], "expenses", id); }
}

/* ---------------- 11. Calculator ---------------- */
function calcForm() {
  const s = S.settings;
  const last = [...S.rolls].sort(byNewest)[0];
  const pc = packCost(thisMonth());
  openSheet(t("act_calc"), `<form id="frm" novalidate>
    <p class="help" style="margin:0">${esc(t("calc_help"))}</p>
    <div class="row2">${field("c-kg", t("roll_weight"), numIn("c-kg", last ? last.weight_kg : 500))}${field("c-price", t("roll_price") + ", " + s.currency, numIn("c-price", last && +last.cost > 0 ? r2(last.cost) : ""))}</div>
    <div class="row2">${field("c-size", t("napkin_size"), numIn("c-size", s.napkin_size_cm))}${field("c-sheets", t("sheets_per_pack"), numIn("c-sheets", s.sheets_per_pack))}</div>
    <div class="row2">${field("c-gsm", t("gsm"), numIn("c-gsm", last && last.gsm ? last.gsm : s.gsm))}${field("c-waste", t("waste_pct"), numIn("c-waste", s.waste_pct))}</div>
    <div class="field"><span class="label">${t("ply")}</span>${choice("c-ply", [["1", t("ply1")], ["2", t("ply2")], ["3", t("ply3")]], String(s.ply || 1))}</div>
    <div class="row2">${field("c-bag", t("bag_cost"), numIn("c-bag", +s.pack_cost || ""))}${field("c-other", t("cost_other"), numIn("c-other", pc.overhead > 0 ? r2(pc.overhead) : ""))}</div>
    ${field("c-sell", t("pack_price") + ", " + s.currency, numIn("c-sell", +s.default_price || ""))}
    <div class="calc-out" id="c-out"></div>
    <div class="actions"><button type="button" class="btn" id="c-save">${t("calc_save")}</button><button type="button" class="btn ghost" data-act="close">${t("close")}</button></div>
    </form>`, (root) => {
    const inputs = () => ({
      rollKg: num(val("c-kg")), rollPrice: num(val("c-price")) || 0, size: num(val("c-size")), sheets: num(val("c-sheets")),
      gsm: num(val("c-gsm")), waste: num(val("c-waste")) || 0, ply: +choiceVal(root, "#c-ply") || 1, bag: num(val("c-bag")) || 0, other: num(val("c-other")) || 0, price: num(val("c-sell")) || 0
    });
    const show = () => {
      const c = calcNapkin(inputs());
      c.price = inputs().price;
      const line = (k, v, cls = "") => `<tr class="${cls}"><td>${esc(k)}</td><td>${v}</td></tr>`;
      $("#c-out").innerHTML = `<table class="kv-table"><tbody>
        ${line(t("one_napkin"), esc(nf.format(Math.round(c.sheetG * 100) / 100)) + " " + t("g"))}
        ${line(t("paper_per_pack"), esc(gf(c.paperPerPackKg)))}
        ${line(t("packs_per_roll"), "<b>≈ " + esc(packs(Math.floor(c.packsPerRoll))) + "</b>", "total")}
        ${c.pricePerKg > 0 ? line(t("paper_price"), esc(money(c.pricePerKg)) + " / " + t("kg")) : ""}
        ${line(t("cost_paper"), esc(money(c.paperCost)))}
        ${line(t("cost_total"), "<b>" + esc(money(c.cost)) + "</b>", "total")}
        ${c.price > 0 ? line(t("profit_per_pack"), `<b class="${c.profit < 0 ? "neg" : "pos"}">${esc(money(c.profit))}</b>`, "total") : ""}
        ${c.price > 0 && c.packsPerRoll > 0 ? line(t("profit_per_roll"), `<span class="${c.profit < 0 ? "neg" : "pos"}">${esc(money(c.profitPerRoll))}</span>`) : ""}
        ${line(t("min_price"), esc(money(c.cost)))}
      </tbody></table>`;
    };
    root.addEventListener("input", show);
    bindChoice(root, "#c-ply", show);
    show();
    $("#c-save").addEventListener("click", async () => {
      const i = inputs();
      const ok = await save(() => DB.saveSettings({
        napkin_size_cm: i.size > 0 ? i.size : 24, sheets_per_pack: Math.round(i.sheets > 0 ? i.sheets : 100),
        gsm: i.gsm > 0 ? i.gsm : 17, ply: i.ply, waste_pct: Math.min(Math.max(i.waste, 0), 90), pack_cost: i.bag > 0 ? i.bag : 0
      }));
      if (ok) closeSheet();
    });
  });
}

/* ---------------- 12. Excel (CSV) & backup ---------------- */
function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
// ";" separator + BOM so Excel opens Cyrillic correctly
const toCSV = (rows) => "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";")).join("\r\n");
function exportSales() {
  const ms = monthStats(S.month);
  const rows = [[t("date"), t("client"), t("qty_packs"), t("pack_price"), t("total"), t("paid"), t("debt"), t("note")]];
  [...ms.sales].sort((a, b) => a.date.localeCompare(b.date)).forEach((s) =>
    rows.push([s.date, clientName(s.customer_id), s.qty, s.price, saleTotal(s), s.paid, r2(saleTotal(s) - (+s.paid || 0)), s.note || ""]));
  download(`mim-sales-${S.month}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}
function exportExpenses() {
  const ms = monthStats(S.month);
  const rows = [[t("date"), t("category"), t("amount"), t("note")]];
  [...ms.exps.map((e) => [e.date, catL(e.category), e.amount, e.note || ""]),
  ...ms.rolls.map((r) => [r.date, t("roll") + " " + rollName(r), r.cost, kgf(r.weight_kg) + (r.supplier ? " · " + r.supplier : "")])]
    .sort((a, b) => a[0].localeCompare(b[0])).forEach((r) => rows.push(r));
  download(`mim-expenses-${S.month}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}
function exportBackup() {
  const data = { exported_at: new Date().toISOString(), settings: S.settings };
  DATA_KEYS.forEach((k) => (data[k] = S[k]));
  download(`mim-daftar-backup-${today()}.json`, JSON.stringify(data, null, 2), "application/json");
}

/* ---------------- 13. Clicks (one listener for the whole page) ---------------- */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a) {
    case "close": return closeSheet();
    case "lang": return setLang(b.dataset.lang);
    case "retry": return enterApp();
    case "settings": return settingsForm();
    case "logout":
      if (DB.pendingCount() > 0) return toast(t("logout_pending"));
      closeSheet(); await DB.signOut(); location.hash = ""; return showScreen("login");
    case "sync": { const n = await DB.sync(); if (!n) toast(t("net_err")); return; }
    case "clear_failed": DB.clearFailed(); return render();
    case "mprev": S.month = shiftMonth(S.month, -1); return render();
    case "mnext": if (S.month < thisMonth()) S.month = shiftMonth(S.month, 1); return render();
    case "go_clients": location.hash = "debts"; setTimeout(() => { const el = $("#clients"); if (el) el.scrollIntoView(); }, 50); return;
    case "open": return openRecord(b.dataset.kind, id);
    case "f_sale": return saleForm(id);
    case "f_made": return madeForm();
    case "f_payment": return paymentForm(id);
    case "f_expense": return expenseForm();
    case "f_rolls": return rollsForm();
    case "f_finish": return finishForm(id);
    case "f_client": return clientForm();
    case "f_calc": return calcForm();
    case "edit_client": { const c = byId(S.customers, id); if (c) clientForm(c); return; }
    case "roll_edit": { const r = byId(S.rolls, id); if (r) rollEditForm(r); return; }
    case "roll_start": { if (await save(() => DB.update("rolls", id, { status: "use" }))) closeSheet(); return; }
    case "roll_reopen": { if (await save(() => DB.update("rolls", id, { status: "use", finished_date: null, leftover_kg: 0 }))) closeSheet(); return; }
    case "print": return window.print();
    case "csv_sales": return exportSales();
    case "csv_exp": return exportExpenses();
    case "backup": return exportBackup();
    case "del": {
      // First tap arms the button, second tap deletes (no accidental deletes)
      if (!b.classList.contains("armed")) {
        b.classList.add("armed"); b.textContent = t("delete_sure");
        clearTimeout(b.timer); b.timer = setTimeout(() => { b.classList.remove("armed"); b.textContent = t("delete"); }, 4000);
        return;
      }
      b.disabled = true;
      if (await save(() => DB.remove(b.dataset.table, id), t("deleted"))) closeSheet(); else b.disabled = false;
      return;
    }
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

/* ---------------- 14. Screens, login, start ---------------- */
function showScreen(name) {
  ["setup", "login", "app"].forEach((s) => ($("#screen-" + s).hidden = s !== name));
  applyI18n();
}
function route() {
  const h = location.hash.replace("#", "");
  S.tab = TABS.includes(h) ? h : "home";
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => { if (!$("#screen-app").hidden) route(); });
window.addEventListener("online", () => { S.online = true; if (!$("#screen-app").hidden) refresh(); });
window.addEventListener("offline", () => { S.online = false; if (!$("#screen-app").hidden) renderChrome(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !$("#screen-app").hidden) refresh(); });

/** Get fresh data (other phone may have added records) */
async function refresh() {
  try {
    await DB.sync();
    const r = await DB.loadAll();
    S.online = r.online;
    applyView();
    render();
  } catch (e) { console.warn(e); }
}

async function enterApp() {
  let member = null;
  try { member = await DB.isMember(); }
  catch (e) {
    // No internet but we have saved data → open anyway (offline mode)
    if (!(DB.isNetworkError(e) && DB.hasCache())) { showScreen("login"); $("#login-err").textContent = errText(e); return; }
  }
  if (member === false) {
    await DB.signOut();
    showScreen("login");
    $("#login-err").textContent = t("no_access");
    return;
  }
  showScreen("app");
  renderChrome();
  $("#view").innerHTML = `<p class="loading">${t("loading")}</p>`;
  try {
    const r = await DB.loadAll();
    S.online = r.online;
    applyView();
    route();
    if (r.online) DB.sync();
  } catch (e) {
    console.error(e);
    $("#view").innerHTML = `<div class="banner"><span>${esc(errText(e))}</span></div><button type="button" class="btn" data-act="retry">${t("retry")}</button>`;
  }
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#login-btn"), err = $("#login-err");
  const email = $("#login-email").value.trim(), pass = $("#login-pass").value;
  err.textContent = "";
  if (!email || !pass) { err.textContent = t("login_err"); return; }
  btn.disabled = true; btn.textContent = t("logging_in");
  try { await DB.signIn(email, pass); $("#login-pass").value = ""; await enterApp(); }
  catch (ex) { err.textContent = /invalid login credentials/i.test(ex.message || "") ? t("login_err") : (ex.message || errText(ex)); }
  finally { btn.disabled = false; btn.textContent = t("login_btn"); }
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker:", e));
  }
}

async function start() {
  applyI18n();
  registerServiceWorker();
  if (!DB.configured()) { showScreen("setup"); return; }
  if (!window.supabase) { showScreen("login"); $("#login-err").textContent = t("net_err"); return; }
  DB.init();
  DB.setOnChange(({ sent }) => { applyView(); render(); if (sent) toast(t("synced", { n: sent })); });
  DB.onSignedOut(() => showScreen("login"));
  let session = null;
  try { session = await DB.session(); } catch (e) { /* offline */ }
  // Saved data + no session usually means "token could not refresh offline" → still open
  if (session || DB.hasCache()) await enterApp(); else showScreen("login");
}
start();

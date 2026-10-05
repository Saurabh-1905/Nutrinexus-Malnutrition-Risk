const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Router (single mechanism: [data-page] + hash) ---------- */
const TITLES = { home: "Child Malnutrition Risk, Global Country-Year Data", predict: "Predict", methodology: "Methodology", about: "About" };
function route() {
  const h = location.hash;
  if (h && !h.startsWith("#/")) { show("home", false); return; }
  const [pg, q] = h.replace("#/", "").split("?");
  show(pg || "home", true);
  if (pg === "predict" && q) fromQuery(q);
}
function show(page, top) {
  if (!TITLES[page]) page = "home";
  $$("[data-page]").forEach((el) => (el.hidden = el.dataset.page !== page));
  $$("[data-nav]").forEach((a) => (a.dataset.nav === page ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.title = `${TITLES[page]} | NutriNexus`;
  $("#links").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false");
  if (top) { scrollTo({ top: 0, behavior: "auto" }); $("#main").focus({ preventScroll: true }); }
  observeReveals();
}
addEventListener("hashchange", route);
$("#burger").addEventListener("click", () => {
  const open = $("#links").classList.toggle("open");
  $("#burger").setAttribute("aria-expanded", open);
});

/* ---------- Scroll reveals, counters, pipeline ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); io.unobserve(e.target);
    const c = $("[data-count]", e.target);
    if (c) countUp(c);
    if (e.target.id === "forest") e.target.classList.add("on");
  });
}, { threshold: 0.25 });
function observeReveals() { $$(".reveal:not(.in), #forest:not(.on)").forEach((el) => io.observe(el)); }

function countUp(el) {
  const to = +el.dataset.count, dec = +el.dataset.dec || 0;
  if (reduce) return;
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min((t - t0) / 1400, 1);
    el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec) + "%";
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

const pipeItems = $$("#pipe li");
const pipeIO = new IntersectionObserver((es) => {
  if (!es[0].isIntersecting) return;
  pipeItems.forEach((li, i) => setTimeout(() => li.classList.add("on"), reduce ? 0 : i * 350));
  pipeIO.disconnect();
}, { threshold: 0.4 });
pipeIO.observe($("#pipe"));

/* ---------- Random Forest illustration (illustrative, not model structure) ---------- */
(function drawForest() {
  const g = $(".tree"); let svg = "";
  const P = (d) => (svg += `<path d="${d}" style="--l:400"/>`);
  [0, 1, 2].forEach((i) => {
    const y = 45 + i * 70, x0 = 30;
    const l1 = [y - 22, y + 22];
    l1.forEach((a) => {
      P(`M${x0} ${y} C90 ${y} 90 ${a} 150 ${a}`);
      [a - 12, a + 12].forEach((b) => { P(`M150 ${a} C200 ${a} 200 ${b} 260 ${b}`); P(`M260 ${b} C340 ${b} 340 115 420 115`); });
    });
    svg += `<circle cx="${x0}" cy="${y}" r="4"/>`;
  });
  svg += `<circle cx="420" cy="115" r="7"/>`;
  [52, 115, 178].forEach((y) => P(`M420 115 C490 115 490 ${y} 548 ${y}`));
  g.innerHTML = svg;
})();

/* ---------- Indicator explorer ---------- */
const SIGNALS = [
  ["Stunting", "Percentage of children whose growth is too low for their age, often linked to long-term undernutrition."],
  ["Wasting", "Percentage of children who are too thin for their height, indicating recent or acute undernutrition."],
  ["Underweight", "Percentage of children who weigh too little for their age, reflecting undernutrition."],
  ["Undernourishment", "Estimated percentage of the population whose food intake is insufficient to meet dietary energy needs."],
  ["GDP per Capita (PPP)", "Average economic output per person, adjusted for differences in purchasing power between countries."],
  ["Basic Drinking-Water Access", "Percentage of the population using drinking-water sources that meet basic accessibility standards."],
  ["Basic Sanitation Access", "Percentage of the population using sanitation facilities that meet basic service standards."],
];
(function tabs() {
  const list = $("#tablist"), panel = $("#tabpanel");
  list.innerHTML = SIGNALS.map((s, i) => `<button role="tab" id="t${i}" aria-selected="${i === 0}" aria-controls="tabpanel" tabindex="${i ? -1 : 0}">${s[0]}</button>`).join("");
  const pick = (i) => {
    $$("button", list).forEach((b, j) => { b.setAttribute("aria-selected", i === j); b.tabIndex = i === j ? 0 : -1; });
    panel.setAttribute("aria-labelledby", "t" + i);
    panel.innerHTML = `<h3>${SIGNALS[i][0]}</h3><p>${SIGNALS[i][1]}</p>`;
  };
  list.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) pick($$("button", list).indexOf(b)); });
  list.addEventListener("keydown", (e) => {
    const bs = $$("button", list); let i = bs.indexOf(document.activeElement);
    if (i < 0 || !["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault(); i = (i + (/Down|Right/.test(e.key) ? 1 : -1) + bs.length) % bs.length; pick(i); bs[i].focus();
  });
  pick(0);
})();

/* ---------- Live dataset facts from the API ---------- */
fetch("/api/health").then((r) => r.json()).then((d) => { $("#stRecords").textContent = d.records; }).catch(() => {});

/* ---------- Country / year pickers (dataset-driven; used on Home and Predict) ---------- */
const countrySel = $("#country"), yearSel = $("#year"), goBtn = $("#go"), msg = $("#msg");
const pickers = [
  { c: countrySel, y: yearSel, b: goBtn, m: msg },
  { c: $("#hCountry"), y: $("#hYear"), b: $("#hGo"), m: $("#hMsg") },
];
async function loadYears(p) {
  p.m.textContent = ""; p.b.disabled = true; p.y.disabled = true;
  if (!p.c.value) { p.y.innerHTML = '<option value="">Select a country first</option>'; return; }
  p.y.innerHTML = '<option value="">Loading years…</option>';
  try {
    const r = await fetch("/api/years?country=" + encodeURIComponent(p.c.value));
    if (!r.ok) throw 0;
    const { years } = await r.json();
    if (!years.length) throw 0;
    p.y.innerHTML = '<option value="">Select a reference year</option>' + years.slice().sort((a, b) => b - a).map((y) => `<option>${y}</option>`).join("");
    p.y.disabled = false;
  } catch { p.y.innerHTML = '<option value="">No years available</option>'; p.m.textContent = "No years are available for this country in the dataset."; }
}
pickers.forEach((p) => {
  p.c.addEventListener("change", () => loadYears(p));
  p.y.addEventListener("change", () => (p.b.disabled = !p.y.value));
});
const countriesReady = fetch("/api/countries").then((r) => { if (!r.ok) throw 0; return r.json(); }).then((d) => {
  const opts = '<option value="">Select a country</option>' + d.countries.map((c) => `<option>${esc(c)}</option>`).join("");
  pickers.forEach((p) => (p.c.innerHTML = opts));
  $("#stCountries").textContent = d.countries.length;
}).catch(() => pickers.forEach((p) => (p.c.innerHTML = '<option value="">Could not load countries</option>')));

/* Home form: send the chosen country-year to the Predict page, which runs the model */
$("#homeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const { c, y } = pickers[1];
  if (c.value && y.value) location.hash = `#/predict?country=${encodeURIComponent(c.value)}&year=${encodeURIComponent(y.value)}`;
});
async function fromQuery(q) {
  const params = new URLSearchParams(q), country = params.get("country"), year = params.get("year");
  if (!country || !year) return;
  await countriesReady;
  countrySel.value = country; if (countrySel.value !== country) return;
  await loadYears(pickers[0]);
  yearSel.value = year; if (yearSel.value !== year) { msg.textContent = "That year is not available for this country in the dataset."; return; }
  goBtn.disabled = false; runPredict();
}

const EXPL = {
  stunting: ["Stunting", "Growth too low for age; linked to long-term undernutrition."],
  wasting: ["Wasting", "Too thin for height; recent or acute undernutrition."],
  underweight: ["Underweight", "Weight too low for age."],
  undernourishment_3yr: ["Undernourishment", "Population share with insufficient food energy intake (3-year average)."],
  gdp_ppp: ["GDP per Capita (PPP)", "Economic output per person, adjusted for purchasing power."],
  basic_water: ["Basic Drinking-Water Access", "Population share using basic drinking-water services."],
  basic_sanitation: ["Basic Sanitation Access", "Population share using basic sanitation services."],
};
const card = (k, v) => {
  const [name, tip] = EXPL[k], na = v == null, money = k === "gdp_ppp";
  const val = na ? "Not available" : money ? "$" + Math.round(v).toLocaleString() : v.toFixed(1) + "%";
  const bar = !na && !money ? `<div class="bar" role="img" aria-label="${val} on a 0 to 100 percent scale"><i style="width:${Math.min(v, 100)}%"></i></div>` : "";
  return `<div class="ind"><h4>${name}</h4><b>${val}</b>${bar}<p>${tip}</p></div>`;
};

$("#form").addEventListener("submit", (e) => { e.preventDefault(); if (!goBtn.disabled) runPredict(); });
async function runPredict() {
  msg.textContent = ""; goBtn.disabled = true; goBtn.textContent = "Running model…";
  try {
    const r = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: countrySel.value, year: +yearSel.value }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || "Prediction failed.");
    render(d);
  } catch (err) { msg.textContent = err.message; }
  finally { goBtn.disabled = !yearSel.value; goBtn.textContent = "Predict Risk"; }
}

function render(d) {
  const colors = { Low: "var(--lo)", Moderate: "var(--mo)", High: "var(--hi)" };
  const probs = ["Low", "Moderate", "High"].map((c) => {
    const v = Number(d.probabilities[c] ?? 0);
    return `<div class="prob"><span>${c}</span><div class="bar"><i data-w="${v}" style="background:${colors[c]}"></i></div><b>${v.toFixed(1)}%</b></div>`;
  }).join("");
  const R = $("#result"); R.hidden = false; R.className = "card res";
  R.innerHTML = `<p class="kicker">${esc(d.country)} · reference year ${d.reference_year}</p>
  <div class="res-head"><div class="risk ${esc(d.risk)}">${esc(d.risk)} Risk</div></div>
  <p class="sub">Risk category estimated for ${d.forecast_year}, using ${d.reference_year} data for this country.</p>
  <h3>Risk probability</h3>${probs}
  <p class="help">Probabilities show how the model's trees vote across the three categories for ${d.forecast_year}. The model's estimated likelihood of the High category is ${Number(d.probabilities.High ?? 0).toFixed(1)}%. These are estimates, not certainties.</p>
  <h3>Child growth indicators</h3><div class="grid">${["stunting", "wasting", "underweight"].map((k) => card(k, d.indicators[k])).join("")}</div>
  <h3>Context indicators</h3><div class="grid">${["undernourishment_3yr", "gdp_ppp", "basic_water", "basic_sanitation"].map((k) => card(k, d.context[k])).join("")}</div>
  <p class="help">Bars show each value on a 0–100% scale; they are not risk scores. A higher or lower value does not decide the result alone, because the model weighs many signals together, including earlier years' history that is not shown here.</p>
  <p class="callout">These indicators are model inputs and should be interpreted as population-level context, not as an individual child's diagnosis. ${esc(d.scope)}</p>`;
  requestAnimationFrame(() => $$("[data-w]", R).forEach((i) => (i.style.width = i.dataset.w + "%")));
  R.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/* ---------- Rotating globe: real country geometry as dots; teal = countries in the dataset ---------- */
(async function globe() {
  const wrap = $("#globe"), cv = $("#globeCv"), ctx = cv.getContext("2d");
  let data; try { data = await (await fetch("/img/globe-dots.json")).json(); } catch { return; }
  const rad = Math.PI / 180, pack = (arr) => {
    const n = arr.length / 2, o = { n, sp: new Float32Array(n), cp: new Float32Array(n), sl: new Float32Array(n), cl: new Float32Array(n) };
    for (let i = 0; i < n; i++) { const l = arr[2 * i] * rad, p = arr[2 * i + 1] * rad; o.sp[i] = Math.sin(p); o.cp[i] = Math.cos(p); o.sl[i] = Math.sin(l); o.cl[i] = Math.cos(l); }
    return o;
  };
  const land = pack(data.a), hit = pack(data.b), tilt = 20 * rad, st = Math.sin(tilt), ct = Math.cos(tilt);
  const dpr = Math.min(devicePixelRatio || 1, innerWidth < 820 ? 1.5 : 2);
  let size = 0, lon0 = 15, last = 0, run = false, visible = true;
  function fit() { size = Math.round(cv.clientWidth * dpr) || 600; cv.width = cv.height = size; }
  function draw(t) {
    const R = size * 0.4, c = size / 2, l0 = lon0 * rad, s0 = Math.sin(l0), c0 = Math.cos(l0);
    ctx.clearRect(0, 0, size, size);
    let g = ctx.createRadialGradient(c, c, R * 0.85, c, c, R * 1.22);
    g.addColorStop(0, "rgba(94,234,212,.20)"); g.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R * 1.22, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(c - R * 0.3, c - R * 0.3, R * 0.1, c, c, R);
    g.addColorStop(0, "rgba(20,64,76,.55)"); g.addColorStop(1, "rgba(8,24,38,.9)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.fill();
    const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t / 900);
    [[land, 0.8, "148,190,210", [0.12, 0.3, 0.55]], [hit, 1.25, "94,234,212", [0.45, 0.75, 1]]].forEach(([d, rs, col, al]) => {
      const b = [[], [], []];
      for (let i = 0; i < d.n; i++) {
        const cd = d.cl[i] * c0 + d.sl[i] * s0, sd = d.sl[i] * c0 - d.cl[i] * s0;
        const z = st * d.sp[i] + ct * d.cp[i] * cd; if (z <= 0.02) continue;
        b[z < 0.3 ? 0 : z < 0.65 ? 1 : 2].push(c + R * d.cp[i] * sd, c - R * (ct * d.sp[i] - st * d.cp[i] * cd), z);
      }
      b.forEach((pts, k) => {
        ctx.fillStyle = `rgba(${col},${(al[k] * (d === hit ? 0.85 + 0.15 * pulse : 1)).toFixed(2)})`; ctx.beginPath();
        for (let i = 0; i < pts.length; i += 3) { const r = rs * dpr * (0.55 + 0.6 * pts[i + 2]); ctx.rect(pts[i] - r, pts[i + 1] - r, 2 * r, 2 * r); }
        ctx.fill();
      });
    });
    g = ctx.createRadialGradient(c, c, R * 0.94, c, c, R * 1.01);
    g.addColorStop(0, "rgba(94,234,212,0)"); g.addColorStop(1, "rgba(94,234,212,.35)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R * 1.01, 0, 7); ctx.fill();
  }
  function frame(t) {
    if (!run) return;
    const lim = innerWidth < 820 ? 33 : 16;
    if (t - last >= lim) { lon0 = ((t / 1000) * 6 + scrollY * 0.05 + 15) % 360; last = t; draw(t); }
    requestAnimationFrame(frame);
  }
  const go = () => { if (reduce || run || !visible || document.hidden) return; run = true; requestAnimationFrame(frame); };
  const stop = () => { run = false; };
  fit(); draw(0); wrap.classList.add("live");
  addEventListener("resize", () => { fit(); draw(0); });
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? go() : stop(); }).observe(wrap);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : go()));
  go();
})();

route();

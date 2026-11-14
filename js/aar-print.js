/* TRACE v32 - additive updates to authoritative uploaded v31 */
(function () {
  const LOG_KEY = "trace_v32_oct_log";
  const getLogs = () => {
    try {
      const a = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  };
  const putLogs = (a) => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(a));
      traceSyncNotify(LOG_KEY);
      return true;
    } catch (e) {
      alert("Could not save log. Check browser storage permissions.");
      return false;
    }
  };
  const safe = (x) => esc(String(x ?? ""));
  const eventsList = () => {
    const a = [
      ...(typeof trace18 !== "undefined" && Array.isArray(trace18.events)
        ? trace18.events
        : []),
      ...(typeof exercises !== "undefined" ? exercises : []),
    ];
    return [...new Map(a.map((e) => [String(e.id), e])).values()];
  };
  const eventName = (id) =>
    eventsList().find((e) => String(e.id) === String(id))?.name ||
    String(id || "Unspecified");
  const eventOptions = (selected = "") =>
    '<option value="">Select training event</option>' +
    eventsList()
      .map(
        (e) =>
          `<option value="${safe(e.id)}" ${String(e.id) === String(selected) ? "selected" : ""}>${safe(e.name)}</option>`,
      )
      .join("");
  const stamp = (x) => {
    try {
      return new Date(x).toLocaleString();
    } catch {
      return x;
    }
  };
  const logEntry = (l) =>
    `<article class="trace32-logentry"><div class="trace32-logmeta"><strong>${safe(l.evaluator || "OC/T")}</strong><span>${safe(stamp(l.created))}</span></div><div class="trace32-logmeta"><span>${safe(eventName(l.eventId || l.event))} · ${safe(l.unit || "Unspecified unit")} · ${safe(l.title || "Observation")}</span><button class="secondary" data-log-export="${safe(l.id)}">Export Word</button></div><p>${safe(l.notes)}</p></article>`;
  const downloadDoc = (filename, title, body) => {
    try {
      downloadWord(filename, title, body);
    } catch (e) {
      alert("Word export failed: " + e.message);
      console.error(e);
    }
  };
  const oldWS = renderWorkspace;
  renderWorkspace = function () {
    oldWS();
    const notes = document.getElementById("wsNotes");
    if (!notes) return;
    const oldEvent = document.getElementById("wsEvent");
    const oldValue = oldEvent?.value || "";
    if (oldEvent) {
      const select = document.createElement("select");
      select.id = "wsEventSelect";
      select.innerHTML = eventOptions(
        eventsList().find(
          (e) => e.name === oldValue || String(e.id) === oldValue,
        )?.id || "",
      );
      oldEvent.parentElement.insertBefore(select, oldEvent);
      oldEvent.style.display = "none";
      select.onchange = () => {
        oldEvent.value = select.value ? eventName(select.value) : "";
        wsPersist();
      };
    }
    const meta = document.createElement("label");
    meta.innerHTML =
      'OC/T name / identifier<input id="trace32Evaluator" placeholder="Enter OC/T name">';
    const box = notes.closest(".ws-box");
    box.querySelector(".form-grid").appendChild(meta);
    const saved = wsRead();
    document.getElementById("trace32Evaluator").value = saved.evaluator || "";
    const persist = wsPersist;
    document
      .getElementById("trace32Evaluator")
      .addEventListener("change", () => {
        const d = wsRead();
        d.evaluator = document.getElementById("trace32Evaluator").value;
        wsSave(d);
      });
    const history = document.createElement("section");
    history.className = "ws-box";
    history.innerHTML = `<div class="section-head"><h3>OC/T Observation Log</h3><span>Timestamped entries · stored locally</span></div><div class="form-grid"><label>Filter by training event<select id="trace32LogEvent"><option value="all">All events</option>${eventsList()
      .map((e) => `<option value="${safe(e.id)}">${safe(e.name)}</option>`)
      .join(
        "",
      )}</select></label></div><div id="trace32LogList"></div><p class="ws-tip">Entries are append-only working observations. No cross-device synchronization; other OC/Ts' notes must be collected on the same browser or through an approved shared system.</p>`;
    box.parentElement.insertAdjacentElement("afterend", history);
    const refresh = () => {
      const f = document.getElementById("trace32LogEvent").value;
      const entries = getLogs()
        .filter((x) => f === "all" || String(x.eventId) === f)
        .sort((a, b) => b.created.localeCompare(a.created));
      document.getElementById("trace32LogList").innerHTML = entries.length
        ? entries.map(logEntry).join("")
        : '<p class="ws-tip">No saved log entries for this selection.</p>';
      history.querySelectorAll("[data-log-export]").forEach(
        (b) =>
          (b.onclick = () => {
            const x = getLogs().find((l) => l.id === b.dataset.logExport);
            if (x)
              downloadDoc(
                "TRACE_OC-T_Log_" + x.id + ".docx",
                "OC/T Observation Log",
                `Date/time: ${stamp(x.created)}\nEvaluator: ${x.evaluator}\nEvent: ${eventName(x.eventId)}\nUnit: ${x.unit}\nSubject: ${x.title}\n\n${x.notes}`,
              );
          }),
      );
    };
    document.getElementById("trace32LogEvent").onchange = refresh;
    document.getElementById("wsSave").onclick = () => {
      const content = notes.value.trim();
      if (!content) {
        wsStatus("Enter an observation before saving a log entry.");
        return;
      }
      const evaluator = document
        .getElementById("trace32Evaluator")
        .value.trim();
      if (!evaluator) {
        wsStatus("Enter the OC/T name before saving.");
        return;
      }
      const eventId = document.getElementById("wsEventSelect")?.value || "";
      if (!eventId) {
        wsStatus("Select a training event before saving.");
        return;
      }
      const entry = {
        id: "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        created: new Date().toISOString(),
        evaluator,
        eventId,
        unit: document.getElementById("wsUnit").value,
        title: document.getElementById("wsTitle").value,
        notes: content,
      };
      if (!putLogs([...getLogs(), entry])) return;
      notes.value = "";
      persist();
      const d = wsRead();
      d.evaluator = evaluator;
      wsSave(d);
      wsStatus("Timestamped log entry saved · " + stamp(entry.created));
      refresh();
    };
    document.getElementById("wsExport").onclick = () => {
      const entries = getLogs().filter(
        (x) =>
          !document.getElementById("wsEventSelect")?.value ||
          x.eventId === document.getElementById("wsEventSelect").value,
      );
      const body = [
        "TRACE — OC/T WORKSPACE LOG",
        "Generated: " + stamp(new Date().toISOString()),
        ...entries.map(
          (x) =>
            `\n${stamp(x.created)} | ${x.evaluator} | ${eventName(x.eventId)} | ${x.unit} | ${x.title}\n${x.notes}`,
        ),
        "\nCURRENT UNSAVED WORKING NOTES\n" + (notes.value || "[None]"),
      ].join("\n");
      downloadDoc(
        "TRACE_OC-T_Observation_Log.docx",
        "TRACE OC/T Observation Log",
        body,
      );
    };
    document.getElementById("wsDownload").onclick = () =>
      downloadDoc(
        "TRACE_OC-T_Working_Product.docx",
        "TRACE — OC/T Working Product",
        document.getElementById("wsOutput").value,
      );
    refresh();
  };
  let aarEvent = "";
  renderAAR = function () {
    if (state.aarEventId) {
      aarEvent = String(state.aarEventId);
      state.aarEventId = "";
    }
    const list = eventsList();
    if (!list.some((e) => String(e.id) === aarEvent))
      aarEvent = String(list[0]?.id || "");
    const root = $("content");
    root.innerHTML = `<div class="dash-shell"><div class="dash-title"><div><h2>Training Event After Action Review</h2><p>Consolidated OC/T evaluation records, performance measures, findings and workspace log entries</p></div><button class="primary" id="trace32AARWord">Export Draft AAR to Word</button></div><div class="panel"><label>Training event<select id="trace32AAREvent">${list.map((e) => `<option value="${safe(e.id)}">${safe(e.name)}</option>`).join("")}</select></label><p class="hint" id="trace32AARCounts"></p><pre class="aar" id="trace32AARBody"></pre></div></div>`;
    const sel = document.getElementById("trace32AAREvent");
    sel.value = aarEvent;
    const build = () => {
      aarEvent = sel.value;
      const evaluations = allRecords().filter(
        (r) => String(r.exerciseId) === aarEvent,
      );
      const logs = getLogs().filter((l) => String(l.eventId) === aarEvent);
      const lines = [
        "TRACE | CONSOLIDATED TRAINING EVENT AFTER ACTION REVIEW",
        "WORKING DRAFT — NOT AN OFFICIAL COMMANDER ASSESSMENT",
        "Generated: " + stamp(new Date().toISOString()),
        "Training event: " + eventName(aarEvent),
        `Sources: ${evaluations.length} saved evaluation(s), ${logs.length} workspace log entry/entries`,
        "",
        "1. EXECUTIVE SUMMARY",
        "[Facilitator: summarize verified overall performance and significant findings after review.]",
        "",
        "2. EVENT OVERVIEW",
        `Event: ${eventName(aarEvent)}`,
        "Participating units: " +
          ([
            ...new Set(
              evaluations
                .map((r) => label(units, r.unitId))
                .concat(logs.map((l) => l.unit).filter(Boolean)),
            ),
          ].join(", ") || "Not documented"),
        "",
        "3. COLLECTIVE TASK ASSESSMENTS",
        ...evaluations.flatMap((r, i) => {
          const t = tasks.find((x) => x.id === r.taskId);
          return [
            `\nAssessment ${i + 1} — ${label(units, r.unitId)} / ${t?.code || r.taskId} ${t?.title || ""}`,
            `OC/T: ${r.evaluator || "Not identified"} | Date: ${r.date || "Not documented"} | Projected rating: ${r.rating || "Not provided"}`,
            `Observations last 24 hours: ${r.observations || "Not documented"}`,
            `Coaching focus next 24 hours: ${r.coachingFocus || "Not documented"}`,
            ...(r.measures || [])
              .map((m, j) =>
                m?.rating || m?.note
                  ? `  Step ${t?.steps?.[j]?.number || j + 1}: ${m.rating || "Not rated"} — ${m.note || "Evidence not documented"}`
                  : null,
              )
              .filter(Boolean),
            ...(r.findings || []).map(
              (f, j) =>
                `  Finding ${j + 1}: Observation: ${f.observation || "Not documented"} | Discussion: ${f.discussion || "Not documented"} | Recommendation: ${f.recommendation || "Not documented"} | Action: ${f.action || "Not documented"} | Owner: ${f.owner || "Unassigned"}`,
            ),
            ...Object.entries(r.aarInputs || {})
              .filter(([k, v]) => v)
              .map(
                ([k, v]) =>
                  `  ${{ objective: "Training objective", actual: "What actually happened", cause: "Cause / discussion", sustain: "Sustain", corrective: "Corrective action", actionOwner: "Action owner", actionDue: "Action suspense", location: "Location" }[k] || k}: ${v}`,
              ),
          ];
        }),
        ...(evaluations.length
          ? []
          : ["No saved evaluations for this event in this browser."]),
        "",
        "4. OC/T WORKSPACE OBSERVATION LOG",
        ...logs.map(
          (l) =>
            `\n${stamp(l.created)} | ${l.evaluator} | ${l.unit || "Unit not specified"} | ${l.title || "Observation"}\n${l.notes}`,
        ),
        ...(logs.length
          ? []
          : ["No workspace log entries for this event in this browser."]),
        "",
        "5. SUSTAINS / STRENGTHS",
        "[Consolidate supported strengths from the source observations.]",
        "",
        "6. IMPROVES / DEFICIENCIES",
        "[Consolidate supported deficiencies; validate conflicting observations.]",
        "",
        "7. RECOMMENDED CORRECTIVE ACTIONS",
        "[Assign owners and suspenses following AAR discussion.]",
        "",
        "8. SOURCE LIMITATIONS",
        "This draft includes only evaluation records and OC/T workspace log entries saved in this browser. It cannot access other OC/Ts’ separate devices. Merge approved records into a shared environment before claiming full event coverage. Ratings are OC/T projections, not official commander assessments.",
      ];
      document.getElementById("trace32AARBody").textContent = lines.join("\n");
      document.getElementById("trace32AARCounts").textContent =
        `${evaluations.length} evaluations · ${new Set(evaluations.map((r) => r.evaluator)).size} evaluators · ${logs.length} workspace log entries`;
    };
    sel.onchange = build;
    document.getElementById("trace32AARWord").onclick = () =>
      downloadDoc(
        "TRACE_Event_AAR_" +
          eventName(aarEvent).replace(/[^a-z0-9_-]+/gi, "_") +
          ".docx",
        "TRACE — Consolidated Event AAR",
        document.getElementById("trace32AARBody").textContent,
      );
    build();
  };
  const oldDashboard = renderDashboard;
  renderDashboard = function () {
    oldDashboard();
    const t = document.querySelector("#content .dash-title");
    if (t) {
      const heading = t.querySelector("h2");
      if (heading) heading.remove();
    }
    $("heading").textContent = "Readiness Dashboard";
  };
  const header = document.querySelector(".app-header .header-right");
  if (header) {
    const b = document.createElement("button");
    b.id = "trace32Print";
    b.className = "secondary";
    b.textContent = "⎙ Print Dashboard";
    b.onclick = () => trace33PrintReport();
    header.insertBefore(b, header.firstChild);
  }
  const css = document.createElement("style");
  css.textContent = `
.trace32-logentry{border:1px solid #40515b;border-radius:10px;padding:13px;margin:10px 0;background:#18242b}.trace32-logentry p{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0;color:#e1e9ed}.trace32-logmeta{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:#a9bdc8;margin-bottom:5px}
@page{size:landscape;margin:0.4in}
@media print{html,body{background:white!important;color:#111!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}aside,.sidebar,.app-header .header-right,.sidebar-footer,button,#viewAllPending,.dash-title button{display:none!important}main{margin:0!important;width:100%!important;max-width:none!important;padding:0!important}header.app-header{padding:0 0 10px!important;background:white!important;color:#111!important;position:static!important}#heading{color:#111!important}.dash-shell{padding:0!important;margin:0!important}.kpi-grid,.task-grid,.dash-grid{break-inside:avoid}.kpi-card,.task-card,.panel{break-inside:avoid;page-break-inside:avoid}#content{overflow:visible!important}body{font-size:10px!important}}
`;
  document.head.appendChild(css);
  if (state.tab === "dashboard") renderDashboard();
})();

/* TRACE v33: dedicated landscape print report; screen dashboard unchanged.
 * It is a snapshot of the top of the dashboard: coverage, the MET cards and the
 * Observations Last 24 Hours / Coaching Focus Next 24 Hours card, and stops there. */
function trace33PrintReport() {
  if (state.tab !== "dashboard") nav("dashboard");
  const root = document.querySelector("#content");
  const txt = (node) => node?.textContent?.trim() || "";
  const clean = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const unit =
    document
      .querySelector(".trace18-compact-filters select")
      ?.selectedOptions?.[0]?.textContent?.trim() || "Selected units";
  const selects = [
    ...document.querySelectorAll(".trace18-compact-filters select"),
  ];
  const event =
    selects[1]?.selectedOptions?.[0]?.textContent?.trim() ||
    "All training events";
  const kpis = [...root.querySelectorAll(".kpi-grid > .kpi-card")]
    .slice(0, 3)
    .map((el) => ({
      name: txt(el.querySelector(".kpi-label")).replace("↗", "").trim(),
      pct: txt(el.querySelector(".donut span")),
      count: txt(el.querySelector(".kpi-copy strong")),
      note: txt(el.querySelector(".kpi-copy small")),
    }));
  const tasks = [...root.querySelectorAll(".task-tile")].map((el) => ({
    code:
      txt(el.querySelector(".task-top b")) +
      (el.querySelector(".trace42-unit")
        ? " · " + txt(el.querySelector(".trace42-unit"))
        : ""),
    title: txt(el.querySelector(".task-top small")),
    pct: txt(el.querySelector(".task-progress strong")),
    count: txt(el.querySelector(".task-progress > span")),
    meta: [...el.querySelectorAll(".task-meta span")].map(txt).join(" · "),
    predictor: txt(el.querySelector(".trace29-predictor strong")) || "—",
    votes: txt(el.querySelector(".trace29-predictor small")),
    na: txt(el.querySelector(".trace29-na")),
  }));
  // The 24-hour card exactly as the dashboard shows it (summary or OC/T inputs).
  const board = root.querySelector(".daily-board");
  const daily = board
    ? [...board.querySelectorAll(".daily-col")].map((col) => ({
        title: txt(col.querySelector(".kpi-label"))
          .replace(/\d+$/, "")
          .trim(),
        items: [
          ...col.querySelectorAll(".daily-ai li, .daily-item, .daily-empty"),
        ].map((el) =>
          el.classList.contains("daily-item")
            ? { text: txt(el.querySelector("p")), who: txt(el.querySelector("small")) }
            : { text: txt(el), empty: el.classList.contains("daily-empty") },
        ),
      }))
    : [];
  const dailyNote = board
    ? txt(board.querySelector(".daily-foot span"))
    : "";
  const report = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>TRACE Readiness Dashboard — Print Report</title><style>
 @page{size:landscape;margin:0.38in 0.45in}*{box-sizing:border-box}body{margin:0;color:#182736;background:white;font:10px Arial,Helvetica,sans-serif}header{border-bottom:3px solid #ad8d48;padding:0 0 9px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end}h1{font-size:20px;margin:0 0 4px;letter-spacing:.3px}header small,.muted{color:#586a75}.meta{text-align:right;line-height:1.6;font-size:10px}.section{margin:12px 0}.section h2{font-size:11px;letter-spacing:.8px;text-transform:uppercase;margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #b9c6cd}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.kpi{border:1px solid #c7d1d7;border-radius:5px;padding:10px 12px;break-inside:avoid}.kpi b{display:block;font-size:10px;color:#4b5d68}.kpi strong{font-size:21px;display:inline-block;margin:6px 9px 2px 0}.kpi span{color:#455965}.tasks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.task{border:1px solid #c7d1d7;border-top:3px solid #b39759;padding:9px 11px;border-radius:4px;break-inside:avoid;min-height:88px}.task .code{font-weight:bold;font-size:12px}.task .title{color:#546571;line-height:1.3;margin:3px 0 8px;min-height:22px}.task .metrics{display:flex;justify-content:space-between;align-items:center;gap:6px}.task .pct{font-weight:bold;font-size:17px}.task .pred{font-size:10px;font-weight:bold;border:1px solid #8e9ba4;border-radius:3px;padding:3px 6px}.task .pred.T{background:#e0f1e6;border-color:#80b995;color:#175b34}.task .pred.P{background:#fff1d5;border-color:#d2a451;color:#765000}.task .pred.U{background:#fbe5e5;border-color:#cf8787;color:#8b2a2a}.track{height:5px;background:#e4eaee;border-radius:3px;overflow:hidden;margin:6px 0}.fill{height:100%;background:#398d6b}.detail{font-size:9px;color:#5b6972;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}th{text-align:left;background:#e9eff2;color:#273b49;font-size:9px}th,td{border-bottom:1px solid #dbe3e8;padding:5px 7px;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}th:nth-child(1){width:15%}th:nth-child(2){width:8%}th:nth-child(4){width:17%}.note{font-size:9px;color:#596a73;margin:7px 0}.empty{padding:9px;border:1px dashed #c4ced5;color:#63747d}.foot{border-top:1px solid #cbd5db;padding-top:7px;margin-top:14px;font-size:8px;color:#63717b}.printbar{padding:9px 12px;background:#edf2f5;border-bottom:1px solid #ccd5da;display:flex;gap:12px;align-items:center;margin-bottom:12px}.printbar button{background:#284d40;color:white;border:0;border-radius:4px;padding:8px 14px;cursor:pointer}.printbar span{font-size:11px;color:#536672}@media print{.printbar{display:none!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.section{break-inside:auto}.kpis,.tasks{break-inside:auto}header{break-after:avoid}thead{display:table-header-group}}@media screen{body{padding:0 20px 30px;max-width:1300px;margin:auto}}

 /* TRACE v34: dark command-center print styling matching the interactive dashboard */
 :root{color-scheme:dark}
 html,body{background:#0b1116!important;color:#e7edf0!important}
 body{font-family:Inter,Arial,Helvetica,sans-serif}
 header{background:#111a20!important;border-bottom:3px solid #c7a458!important;padding:13px 15px!important;border-radius:5px}
 h1{color:#f4f4f2!important;letter-spacing:.7px}
 header small,.muted,.meta{color:#b8c3c9!important}
 .section h2{color:#e6d3a2!important;border-bottom-color:#475057!important}
 .kpi,.task{background:#171f25!important;border-color:#445058!important;color:#e9eff2!important;box-shadow:none}
 .task{border-top-color:#c6a252!important}
 .kpi b,.task .code{color:#f2e4bd!important}
 .kpi strong,.task .pct{color:#f6f7f8!important}
 .kpi span,.task .title,.detail,.note{color:#b5c3cc!important}
 .task .metrics{background:transparent!important;padding:0!important;border-radius:0!important}
 .task .pred{background:#2d353a!important;color:#d8e1e7!important;border-color:#66747d!important}
 .task .pred.T{background:#173b29!important;color:#8be1aa!important;border-color:#3b9865!important}
 .task .pred.P{background:#49371c!important;color:#f5d084!important;border-color:#b78d3f!important}
 .task .pred.U{background:#482728!important;color:#ffadad!important;border-color:#b6575b!important}
 .track{background:#354148!important}.fill{background:#59b878!important}
 th{background:#28333b!important;color:#e6c77d!important}
 td{color:#e1e8ec!important;border-bottom-color:#3d484e!important}
 .empty{background:#151d22!important;color:#b8c5ce!important;border-color:#536068!important}
 .foot{color:#a8b5bc!important;border-top-color:#4b565e!important}
 .printbar{background:#1a252c!important;border-bottom-color:#43515a!important}
 .printbar button{background:#c6a252!important;color:#10161a!important;font-weight:700}
 .printbar span{color:#d4dee4!important}
 .dcols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
 .dcol{background:#171f25!important;border:1px solid #445058!important;border-radius:5px;padding:10px 12px;break-inside:avoid}
 .dcol h3{font-size:10px;letter-spacing:.6px;margin:0 0 6px;color:#f2e4bd!important}
 .dcol ul{margin:0;padding-left:15px}
 .dcol li{font-size:10px;line-height:1.45;margin:0 0 5px;color:#e1e8ec!important}
 .dcol li small{display:block;font-size:8.5px;color:#9fb0ba!important}
 .dcol li.none{list-style:none;margin-left:-15px;color:#9fb0ba!important}
 @media print{
   @page{size:letter landscape;margin:.32in .4in}
   html,body{background:#0b1116!important;color:#e7edf0!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
   header,.kpi,.task,.dcol,th,.task .pred,.track,.fill{print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
   .section{break-inside:auto}
 }
 </style></head><body><div class="printbar"><button onclick="window.print()">Print landscape report</button><span>For the dark TRACE theme, select Landscape and enable Print backgrounds / Background graphics in Safari print options. Disable browser headers and footers.</span></div><header><div><h1>TRACE | READINESS DASHBOARD</h1><small>Training Readiness Assessment &amp; Coaching Environment · Assessment coverage report</small></div><div class="meta"><b>${clean(unit)}</b><br>${clean(event)}<br>Generated ${clean(new Date().toLocaleString())}</div></header>
 <div class="section"><h2>Assessment coverage</h2><div class="kpis">${kpis.map((k) => `<div class="kpi"><b>${clean(k.name)}</b><strong>${clean(k.pct)}</strong><span>${clean(k.count)}</span><div class="detail">${clean(k.note)}</div></div>`).join("")}</div></div>
 <div class="section"><h2>Collective task readiness &amp; OC/T predictions</h2>${tasks.length ? `<div class="tasks">${tasks.map((t) => `<div class="task"><div class="code">${clean(t.code)}</div><div class="title">${clean(t.title)}</div><div class="metrics"><span><span class="pct">${clean(t.pct)}</span> <small>${clean(t.count)}</small></span><span class="pred ${["T", "P", "U"].includes(t.predictor) ? t.predictor : ""}">Predictor: ${clean(t.predictor)}</span></div><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, parseInt(t.pct) || 0))}%"></div></div><div class="detail">${clean(t.meta)}<br>${clean(t.votes)}${t.na ? "<br>" + clean(t.na) : ""}</div></div>`).join("")}</div>` : '<div class="empty">No assigned T&amp;EOs for the selected filters.</div>'}</div>
 ${daily.length ? `<div class="section daily"><h2>Observations last 24 hours / Coaching focus next 24 hours</h2><div class="dcols">${daily.map((c) => `<div class="dcol"><h3>${clean(c.title)}</h3>${c.items.length ? `<ul>${c.items.map((it) => (it.empty ? `<li class="none">${clean(it.text)}</li>` : `<li>${clean(it.text)}${it.who ? `<small>${clean(it.who)}</small>` : ""}</li>`)).join("")}</ul>` : '<div class="empty">Nothing recorded.</div>'}</div>`).join("")}</div>${dailyNote ? `<div class="note">${clean(dailyNote)}</div>` : ""}</div>` : ""}
 <div class="foot">Coverage is documentation coverage (GO and NO-GO observed); N/A excluded from denominator. OC/T readiness predictor is advisory, not an official commander proficiency determination. Prototype: use fictional/approved data only.</div></body></html>`;
  // Show the report inside TRACE and print from the main page. Print calls made
  // from a pop-up window are ignored on phones and installed (home-screen) apps.
  trace33ShowPrintReport(report);
}
// Scope the report's stylesheet to the report container so it can't restyle TRACE.
function trace33ScopeCss(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "",
    i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1,
      j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (/^@media/i.test(head))
      out += head + "{" + trace33ScopeCss(body, scope) + "}";
    else if (head.startsWith("@")) out += head + "{" + body + "}";
    else
      out +=
        head
          .split(",")
          .map((sel) => {
            sel = sel.trim();
            if (sel === "*") return scope + "," + scope + " *";
            if (/^(html|body|:root)$/i.test(sel)) return scope;
            return scope + " " + sel.replace(/^(html|body|:root)\s+/i, "");
          })
          .join(",") +
        "{" +
        body +
        "}";
    i = j;
  }
  return out;
}
function trace33ShowPrintReport(report) {
  document.getElementById("tracePrintReport")?.remove();
  document.getElementById("tracePrintReportCss")?.remove();
  const css = (report.match(/<style>([\s\S]*?)<\/style>/i) || [])[1] || "";
  let body = (report.match(/<body>([\s\S]*)<\/body>/i) || [])[1] || "";
  body = body.replace(/<div class="printbar">[\s\S]*?<\/div>/i, "");
  const scope = "#tracePrintReport";
  const style = document.createElement("style");
  style.id = "tracePrintReportCss";
  style.textContent =
    // Start from browser defaults so TRACE's own styles don't leak in.
    `${scope} *{all:revert}` +
    trace33ScopeCss(css, scope) +
    `${scope}{position:fixed;inset:0;z-index:2147483000;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 16px 24px;margin:0}` +
    `${scope} .trp-toolbar{position:sticky;top:0;z-index:1;margin:0 -16px 12px;flex-wrap:wrap}` +
    `${scope} .trp-toolbar button{border:0;border-radius:6px;padding:9px 14px;cursor:pointer;font:700 13px Arial,Helvetica,sans-serif}` +
    `${scope} .trp-toolbar button.trp-close{background:#2d3a42!important;color:#e7edf0!important;border:1px solid #55646d}` +
    `@media print{` +
    `html,body{height:auto!important;overflow:visible!important;background:#0b1116!important}` +
    `body>*:not(${scope}){display:none!important}` +
    `${scope}{position:static!important;overflow:visible!important;padding:0!important;inset:auto!important}` +
    `${scope} .trp-toolbar{display:none!important}}`;
  const host = document.createElement("div");
  host.id = "tracePrintReport";
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-label", "TRACE dashboard print report");
  host.innerHTML =
    '<div class="printbar trp-toolbar"><button type="button" data-trp="print">Print landscape report</button><button type="button" class="trp-close" data-trp="close">Close</button><span>For the dark TRACE theme, select Landscape and turn on Print backgrounds / Background graphics. On iPhone or iPad, you can also pinch the print preview to save it as a PDF.</span></div>' +
    body;
  document.head.appendChild(style);
  document.body.appendChild(host);
  const close = () => {
    host.remove();
    style.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  host.querySelector('[data-trp="print"]').onclick = () => window.print();
  host.querySelector('[data-trp="close"]').onclick = close;
  host.scrollTop = 0;
}

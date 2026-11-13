/* TRACE v23: imported T&EOs are separate from immutable demonstration references. */
const TRACE23_KEY = "trace_v23_imported_teos_v1";
const trace23BuiltInIds = new Set(tasks.map((t) => t.id));
let trace23Draft = null;
function trace23Load() {
  try {
    const list = JSON.parse(localStorage.getItem(TRACE23_KEY) || "[]");
    let repaired = false;
    if (Array.isArray(list))
      list.forEach((t) => {
        if (
          t &&
          t.id &&
          Array.isArray(t.steps) &&
          !tasks.some((x) => x.id === t.id)
        ) {
          if (t.traceSymbolMapping !== "leader-star-critical-plus") {
            // Earlier imports reversed the Army T&EO * and + meanings. Repair flags once without changing assessments.
            t.steps.forEach((st) => {
              const oldCritical = !!st.critical;
              st.critical = !!st.leader;
              st.leader = oldCritical;
            });
            t.traceSymbolMapping = "leader-star-critical-plus";
            repaired = true;
          }
          tasks.push(t);
        }
      });
    if (repaired) {
      localStorage.setItem(TRACE23_KEY, JSON.stringify(list));
      traceSyncNotify(TRACE23_KEY);
    }
  } catch (e) {
    console.warn("TRACE import records could not be loaded or migrated", e);
  }
}
function trace23Save() {
  try {
    localStorage.setItem(
      TRACE23_KEY,
      JSON.stringify(tasks.filter((t) => !trace23BuiltInIds.has(t.id))),
    );
    traceSyncNotify(TRACE23_KEY);
    return true;
  } catch (e) {
    alert(
      "Unable to save imported T&EOs in this browser. Storage may be full.",
    );
    return false;
  }
}
trace23Load();
// Imported T&EOs use the same evaluation data shape as built-in references.
// Repair records imported by earlier v23 releases without re-uploading PDFs.
function trace23NormalizeEvaluationTask(task) {
  if (!task || !Array.isArray(task.steps)) return task;
  if (
    !Array.isArray(task.measures) ||
    task.measures.length !== task.steps.length
  ) {
    task.measures = task.steps.map((step) =>
      String(
        step.text ||
          step.title ||
          step.description ||
          "Performance step " + step.number,
      ),
    );
  }
  return task;
}
tasks.forEach(trace23NormalizeEvaluationTask);
function trace23DB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("trace_v23_teo_documents", 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("docs"))
        r.result.createObjectStore("docs", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function trace23StoreFile(id, file) {
  if (window.TraceSync?.shared) return TraceSync.files.put(id, file);
  const db = await trace23DB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("docs", "readwrite");
    tx.objectStore("docs").put({
      id,
      name: file.name,
      blob: file,
      created: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
async function trace23GetFile(id) {
  if (window.TraceSync?.shared) return TraceSync.files.get(id);
  const db = await trace23DB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("docs", "readonly"),
      r = tx.objectStore("docs").get(id);
    r.onsuccess = () => {
      db.close();
      resolve(r.result);
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
async function trace23DeleteFile(id) {
  if (window.TraceSync?.shared) return TraceSync.files.remove(id);
  const db = await trace23DB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("docs", "readwrite");
    tx.objectStore("docs").delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
function trace23Status(msg) {
  const el = document.getElementById("trace23Status");
  if (el) el.textContent = msg;
}
function trace23Clean(line) {
  return String(line || "")
    .replace(/\s+/g, " ")
    .trim();
}
// Remove page footers and classification banners that PDF text extraction mixes into step lines.
function trace23StripFurniture(line) {
  return trace23Clean(
    String(line || "")
      .replace(
        /(?:^|\s)(?:UNCLASSIFIED|CUI)(?:\s*\/\/\s*(?!FOR OFFICIAL)[A-Z0-9-]+)*(?:\s*\/\/\s*FOR OFFICIAL USE ONLY)?(?=\s|$)/g,
        " ",
      )
      .replace(/\bFOR OFFICIAL USE ONLY\b/g, " ")
      .replace(/^\s*Page\s+\d+(?:\s+of\s+\d+)?(?=\s|$)/, " ")
      .replace(/\s+Page\s+\d+(?:\s+of\s+\d+)?\s*$/, " ")
      // Repeated table header on each page.
      .replace(/STEP\s*\/\s*MEASURE\s+GO\s+NO-?\s*GO(?:\s+N\/A)?/gi, " "),
  );
}
// Substep marker with optional leader/critical flags: "+* e.", "(4)", "(a)", "_1_".
const TRACE23_SUB_MARKER =
  /^\s*([*+]{1,2})?\s*(?:([a-z])[.)]|\((\d+)\)|\(([a-z]{1,4})\)|_(\d+)_)\s+/i;
function trace23Parse(pages, name) {
  const heading = /performance\s+steps\s+and\s+measures/i;
  const endHeading = /task\s+performance\s+summary\s+block/i;
  const start = pages.findIndex((p) => heading.test(p));
  if (start < 0)
    throw Error(
      "Could not find “Performance Steps and Measures.” No tasks were imported.",
    );
  let chunks = [];
  let ended = false;
  for (let p = start; p < pages.length; p++) {
    let text = String(pages[p] || "");
    if (p === start) {
      const m = heading.exec(text);
      text = text.slice(m.index + m[0].length);
    }
    const stop = endHeading.exec(text);
    if (stop) {
      text = text.slice(0, stop.index);
      ended = true;
    }
    chunks.push({ page: p + 1, text });
    if (ended) break;
  }
  if (!ended)
    throw Error(
      "Could not find “Task Performance Summary Block” after the performance steps. Import stopped to prevent capturing unrelated sections; check the PDF.",
    );
  const steps = [];
  let current = null;
  let stage = "";
  let lastNum = 0;
  let inNote = false;
  let done = false;
  // The words "performance steps and measures" also appear in the task's
  // Standard/preamble text, so the real table starts at the STEP/MEASURE
  // GO NO-GO header. Fall back to the heading when a export has no header.
  const tableHeader = /STEP\s*\/\s*MEASURE\s+GO\s+NO-?\s*GO/i;
  let started = !chunks.some((c) => tableHeader.test(c.text));
  // Sections that follow the steps table in Army T&EOs.
  const trailer =
    /^(?:mission\(s\)\s+supported|mopp\s*4\s*(?:statement)?\s*:|nvg\s*(?:statement)?\s*:|prerequisite\s+(?:collective|individual)\s+task|supporting\s+(?:collective|individual)\s+task|supporting\s+drill|opfor\s+task|task\s+performance\s+(?:and\s+evaluation\s+)?summary\s+block)/i;
  // Whether the source marked any rating boxes (PDFs do; text exports don't).
  let boxScan = false;
  // Outline position of the current substep: a. → (1) → (a) → _1_
  let path = [];
  function flush() {
    if (current) {
      current.text = trace23Clean(current.text);
      current.subtasks = current.subtasks.map(trace23Clean);
      current.details = current.details.map(trace23Clean);
      const used = new Set();
      current.checks = current.checks.map((c) => {
        let key = c.label;
        for (let n = 2; used.has(key); n++) key = c.label + "#" + n;
        used.add(key);
        const full = current.subtasks[c.sub] || "";
        return {
          key,
          label: c.label,
          text: trace23Clean(full.replace(TRACE23_SUB_MARKER, "")),
          critical: c.critical,
          leader: c.leader,
        };
      });
      if (current.text) steps.push(current);
      current = null;
    }
  }
  for (const chunk of chunks) {
    if (done) break;
    let raw = chunk.text;
    if (!started) {
      const h = tableHeader.exec(raw);
      if (!h) continue;
      raw = raw.slice(h.index);
      started = true;
    }
    const lines = raw
      .split(/\n/)
      .map(trace23StripFurniture)
      .filter(Boolean);
    for (let line of lines) {
      let boxed = false;
      if (line.startsWith(TRACE_BOX_MARK.trim())) {
        boxed = true;
        boxScan = true;
        line = trace23Clean(line.slice(TRACE_BOX_MARK.trim().length));
        if (!line) continue;
      }
      if (trailer.test(line)) {
        done = true;
        break;
      }
      if (
        /^(?:performance\s+steps\s+and\s+measures|performance\s+steps|step\s+no\.?|go\s*\/\s*no.?go|evaluation\s+guidance|legend\s*:)/i.test(
          line,
        )
      )
        continue;
      const phase = line.match(
        /^(plan|prepare|execute|assess)(?:\s+phase)?\s*:?$/i,
      );
      if (phase) {
        stage = phase[1][0].toUpperCase() + phase[1].slice(1).toLowerCase();
        continue;
      }
      // Army T&EO notation: * leader, + critical, *+ both. Some exports use (C)/(L).
      let m = line.match(
        /^\s*(?:step\s*)?(\d{1,3})\s*[.)]\s*((?:(?:\*|\+|\(C\)|\(L\)|\(CL\)|\(LC\))\s*)*)(.+)$/i,
      );
      if (!m)
        m = line.match(/^\s*((?:\*|\+){1,2})\s*(\d{1,3})\s*[.)]?\s+(.+)$/);
      // Only treat a numbered line as a new step when the number follows the
      // previous one (small gaps allowed). Stray numbered lines in prose are
      // continuation text, not new steps.
      const candidate = m ? Number(/^\d/.test(m[1]) ? m[1] : m[2]) : 0;
      if (m && !(candidate > lastNum && candidate <= lastNum + 3)) m = null;
      if (m) {
        flush();
        inNote = false;
        const prefix = /^\d/.test(m[1]) ? "" : m[1];
        const num = Number(prefix ? m[2] : m[1]);
        lastNum = num;
        let body = prefix ? m[3] : m[3];
        let flags = prefix || m[2] || "";
        const suffix = body.match(
          /^((?:\*|\+|\(C\)|\(L\)|\(CL\)|\(LC\))+)\s*/i,
        );
        if (suffix) {
          flags += " " + suffix[1];
          body = body.slice(suffix[0].length);
        }
        const tag = body.match(
          /^\[\s*(critical\s*(?:and|\/)\s*leader|leader\s*(?:and|\/)\s*critical|critical|leader)\s*\]\s*/i,
        );
        if (tag) {
          flags += " " + tag[1];
          body = body.slice(tag[0].length);
        }
        current = {
          number: num,
          text: body,
          subtasks: [],
          details: [],
          stage,
          page: chunk.page,
          critical: /\+|\(C\)|\(CL\)|\(LC\)|critical/i.test(flags),
          leader: /\*|\(L\)|\(CL\)|\(LC\)|leader/i.test(flags),
          boxed,
          checks: [],
        };
        path = [];
        continue;
      }
      if (!current) continue;
      // Subtasks are retained and displayed as supporting details, not counted as separate numbered steps.
      // Subtasks may carry their own leader/critical markers ("+* e.", "* d.").
      if (
        /^(?:[*+]{1,2}\s*)?(?:\(?[a-z]\)|[a-z][.)]|\(\d+\)|_\d+_)\s+\S/i.test(
          line,
        )
      ) {
        inNote = false;
        current.subtasks.push(line);
        current.details.push(line);
        const mk = line.match(TRACE23_SUB_MARKER);
        if (mk) {
          const level = mk[2] ? 0 : mk[3] ? 1 : mk[4] ? 2 : mk[5] ? 3 : -1;
          const part = mk[2]
            ? mk[2].toLowerCase()
            : mk[3]
              ? "(" + mk[3] + ")"
              : mk[4]
                ? "(" + mk[4].toLowerCase() + ")"
                : mk[5]
                  ? "_" + mk[5] + "_"
                  : "";
          if (level >= 0) {
            path = path.slice(0, level);
            path[level] = part;
          }
          if (boxed)
            current.checks.push({
              label: path.filter(Boolean).join("") || part,
              sub: current.subtasks.length - 1,
              critical: /\+/.test(mk[1] || ""),
              leader: /\*/.test(mk[1] || ""),
            });
        }
        continue;
      }
      // Notes are dropped, including the lines that wrap onto the next row.
      if (/^(?:note|legend|performance\s+measures|task\s+steps)\s*:/i.test(line)) {
        inNote = true;
        continue;
      }
      if (inNote) continue;
      if (current.subtasks.length) {
        current.subtasks[current.subtasks.length - 1] += " " + line;
        current.details[current.details.length - 1] += " " + line;
      } else current.text += " " + line;
    }
  }
  flush();
  const unique = [];
  const seen = new Set();
  for (const st of steps) {
    if (seen.has(st.number)) continue;
    seen.add(st.number);
    unique.push(st);
  }
  if (!unique.length)
    throw Error(
      "No numbered performance steps were detected between the two headings.",
    );
  const code =
    (name.match(/\b\d{2}-[A-Z]{2,5}-\d{3,5}\b/i) || [])[0] ||
    name.replace(/\.[^.]+$/, "").slice(0, 60);
  return {
    code,
    title:
      name
        .replace(/\.[^.]+$/, "")
        .replace(/^\d{2}-[A-Z]{2,5}-\d{3,5}\s*[-_(]?\s*/i, "")
        .replace(/[)_]/g, " ")
        .trim() || code,
    steps: unique,
    boxScan,
    traceSymbolMapping: "leader-star-critical-plus",
    page: start + 1,
    endPage: chunks[chunks.length - 1].page,
    source: name,
  };
}
let trace23PdfPromise = null;
function trace23PdfLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (trace23PdfPromise) return trace23PdfPromise;
  trace23PdfPromise = new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    sc.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      } else reject(Error("PDF reader did not initialize"));
    };
    sc.onerror = () =>
      reject(
        Error(
          "PDF reading requires internet access to load the PDF.js reader. You can import a text (.txt) export offline.",
        ),
      );
    document.head.append(sc);
  });
  return trace23PdfPromise;
}
// Marks a text row that has GO / NO-GO / N/A rating boxes beside it on the T&EO.
const TRACE_BOX_MARK = "BOX ";
// Rectangles drawn on a page, in PDF user space. Handles both the pdf.js 3.x/4.x
// constructPath format ([ops], coords) and the 5.x+ format (paint op, [path data]).
function trace23PageRects(opList, OPS) {
  const rects = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  const pt = (x, y) => [
    ctm[0] * x + ctm[2] * y + ctm[4],
    ctm[1] * x + ctm[3] * y + ctm[5],
  ];
  const push = (xs, ys) => {
    if (xs.length < 2) return;
    rects.push({
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    });
  };
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i],
      a = opList.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform && a) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath && a) {
      if (Array.isArray(a[0])) {
        // pdf.js 3.x / 4.x
        const c = a[1] || [];
        let k = 0;
        for (const op of a[0]) {
          if (op === OPS.rectangle) {
            const [x, y, w, h] = c.slice(k, k + 4);
            const p1 = pt(x, y),
              p2 = pt(x + w, y + h);
            push([p1[0], p2[0]], [p1[1], p2[1]]);
            k += 4;
          } else if (op === OPS.moveTo || op === OPS.lineTo) k += 2;
          else if (op === OPS.curveTo) k += 6;
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
        }
      } else if (Array.isArray(a[1])) {
        // pdf.js 5.x+: one array of drawing commands per path.
        for (const data of a[1]) {
          if (!data) continue;
          let xs = [],
            ys = [];
          for (let k = 0; k < data.length; ) {
            const op = data[k++];
            const n = op === 0 || op === 1 ? 2 : op === 2 ? 6 : op === 3 ? 4 : 0;
            if (op === 0 && xs.length) {
              push(xs, ys);
              xs = [];
              ys = [];
            }
            for (let j = 0; j < n; j += 2) {
              const p = pt(data[k + j], data[k + j + 1]);
              xs.push(p[0]);
              ys.push(p[1]);
            }
            k += n;
          }
          push(xs, ys);
        }
      }
    }
  }
  return rects;
}
// Rows of rating boxes: two or more side-by-side cells on the right half of the page.
function trace23BoxRows(rects, pageWidth) {
  const cells = rects.filter(
    (r) =>
      r.x0 > pageWidth * 0.5 &&
      r.x1 - r.x0 >= 15 &&
      r.x1 - r.x0 <= 140 &&
      r.y1 - r.y0 >= 6 &&
      r.y1 - r.y0 <= 120,
  );
  const groups = new Map();
  cells.forEach((r) => {
    const key = Math.round(r.y0) + ":" + Math.round(r.y1);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => ({
      y0: g[0].y0,
      y1: g[0].y1,
      x0: Math.min(...g.map((r) => r.x0)),
    }));
}
async function trace23Pages(file) {
  if (/\.txt$/i.test(file.name))
    return (await file.text()).split(/\f|\n\s*---\s*page\s*\d+\s*---\s*\n/i);
  if (!/\.pdf$/i.test(file.name))
    throw Error("Choose a PDF or a plain text (.txt) export of the T&EO.");
  const lib = await trace23PdfLib();
  const doc = await lib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableWorker: true,
  }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    trace23Status("Reading PDF page " + i + " of " + doc.numPages + "…");
    const page = await doc.getPage(i),
      content = await page.getTextContent();
    let rows = [],
      lastY = null,
      line = [];
    // Each row keeps the position of its first piece of text so it can be
    // matched to the rating boxes drawn beside it.
    let pos = null;
    const end = () => {
      if (line.length) rows.push({ text: line.join(" "), ...(pos || {}) });
      line = [];
      pos = null;
    };
    for (const item of content.items) {
      const y = Math.round(item.transform?.[5] || 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) end();
      if (!pos && String(item.str || "").trim())
        pos = { y: item.transform?.[5] || 0, x: item.transform?.[4] || 0 };
      line.push(item.str || "");
      lastY = y;
      if (item.hasEOL) {
        end();
        lastY = null;
      }
    }
    end();
    try {
      const boxes = trace23BoxRows(
        trace23PageRects(await page.getOperatorList(), lib.OPS),
        page.view?.[2] || 612,
      );
      // The box belongs to the top text row inside it (a step's first line).
      boxes.forEach((b) => {
        const inside = rows.filter(
          (r) =>
            typeof r.y === "number" &&
            r.y >= b.y0 - 1 &&
            r.y <= b.y1 + 1 &&
            r.x < b.x0,
        );
        if (!inside.length) return;
        inside.sort((p, q) => q.y - p.y)[0].boxed = true;
      });
    } catch (e) {
      console.warn("TRACE could not read rating boxes on page " + i, e);
    }
    pages.push(
      rows.map((r) => (r.boxed ? TRACE_BOX_MARK : "") + r.text).join("\n"),
    );
  }
  return pages;
}
async function trace23HandleFile(file) {
  if (!file) return;
  trace23Draft = null;
  trace23Status("Reading " + file.name + "…");
  try {
    const pages = await trace23Pages(file);
    const parsed = trace23Parse(pages, file.name);
    trace23Draft = { ...parsed, file };
    const box = document.getElementById("trace23Preview");
    if (!box) return;
    box.style.display = "block";
    const subCount = parsed.steps.reduce((n, x) => n + (x.checks?.length || 0), 0);
    box.innerHTML = `<h3>Review before import</h3><p class="hint">Found ${parsed.steps.length} numbered performance steps on pages ${parsed.page}–${parsed.endPage}, stopping before Task Performance Summary Block. ${parsed.boxScan ? subCount + " substeps have their own GO / NO-GO boxes and will be rated separately." : "No rating boxes were found in this file, so only the numbered steps will be rated."} Verify critical/leader markers against the original PDF.</p><div class="trace23-meta"><label>Task number<input id="trace23Code" value="${esc(parsed.code)}"></label><label>Task title<input id="trace23Title" value="${esc(parsed.title)}"></label></div><div style="max-height:240px;overflow:auto;margin:12px 0">${parsed.steps.map((x, i) => `<p style="font-size:12px;border-bottom:1px solid #39444a;padding:6px 0"><strong>${x.number}.</strong> ${x.critical && x.leader ? "<b style='color:#e8c56f'>CRITICAL + LEADER</b>" : x.critical ? "<b style='color:#e8c56f'>CRITICAL</b>" : x.leader ? "<b style='color:#a9d5ef'>LEADER</b>" : ""} ${esc(x.text)} ${x.subtasks.length ? `<small>(${x.subtasks.length} subtasks${x.checks?.length ? ", " + x.checks.length + " with rating boxes" : ""})</small>` : ""}</p>`).join("")}</div><div class="trace23-actions"><button class="primary" id="trace23Commit">Import into T&EO Library</button><button class="secondary" id="trace23Cancel">Cancel</button></div>`;
    document.getElementById("trace23Commit").onclick = trace23Commit;
    document.getElementById("trace23Cancel").onclick = () => {
      trace23Draft = null;
      box.style.display = "none";
      trace23Status("Import canceled");
    };
    trace23Status(
      "Ready to import: " + parsed.steps.length + " performance steps.",
    );
  } catch (e) {
    trace23Status("Import failed: " + e.message);
    const box = document.getElementById("trace23Preview");
    if (box) box.style.display = "none";
  }
}
async function trace23Commit() {
  if (!trace23Draft) return;
  const d = trace23Draft,
    code = document.getElementById("trace23Code").value.trim(),
    title = document.getElementById("trace23Title").value.trim();
  if (!code || !title) {
    alert("Enter a task number and title.");
    return;
  }
  const id = code;
  if (tasks.some((t) => t.id === id)) {
    alert(
      "A T&EO with this task number already exists. Change the number or remove the previous imported T&EO.",
    );
    return;
  }
  const task = {
    id,
    code,
    title,
    version: "Imported",
    source: d.source,
    sourceType: "User-imported T&EO (verify against source)",
    echelonNote:
      "Imported reference; assign to units and events as appropriate.",
    conditions: "See original source document.",
    steps: d.steps.map((x) => ({
      number: x.number,
      text: x.text,
      subtasks: x.subtasks,
      details: x.details,
      stage: x.stage,
      page: x.page,
      critical: x.critical,
      leader: x.leader,
      checks: x.checks || [],
    })),
    boxScan: !!d.boxScan,
  };
  trace23NormalizeEvaluationTask(task);
  tasks.push(task);
  if (!trace23Save()) {
    tasks.pop();
    return;
  }
  try {
    await trace23StoreFile(id, d.file);
  } catch (e) {
    alert(
      "Task imported, but the original PDF could not be stored for download: " +
        e.message,
    );
  }
  trace23Draft = null;
  renderStandards();
  trace23Status(
    "Imported " +
      code +
      " successfully. Assign it to a unit under Units & Events.",
  );
}
async function trace23Download(id) {
  try {
    const file = await trace23GetFile(id);
    if (!file) {
      alert("Original document not stored in this browser.");
      return;
    }
    const url = URL.createObjectURL(file.blob),
      a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 12000);
  } catch (e) {
    alert(e.message);
  }
}
// T&EOs imported before rating boxes were read: re-read the stored source PDF and
// add the boxed substeps. Steps are matched by number, so saved ratings stay put.
async function trace23RescanBoxes(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task || trace23BuiltInIds.has(id))
    throw Error("Only uploaded T&EOs can be scanned.");
  const stored = await trace23GetFile(id);
  if (!stored?.blob)
    throw Error(
      "The original PDF isn't stored on this device. Delete and re-import the T&EO to add substep rating boxes.",
    );
  const name = stored.name || task.source || id + ".pdf";
  const file = new File([stored.blob], name, {
    type: stored.blob.type || "application/pdf",
  });
  const parsed = trace23Parse(await trace23Pages(file), name);
  if (!parsed.boxScan)
    throw Error("No GO / NO-GO boxes were found in the stored source file.");
  const byNumber = new Map(parsed.steps.map((s) => [s.number, s]));
  task.steps.forEach((st) => {
    st.checks = byNumber.get(st.number)?.checks || [];
  });
  task.boxScan = true;
  if (!trace23Save()) throw Error("Could not save the updated T&EO.");
  return task.steps.reduce((n, s) => n + s.checks.length, 0);
}
function trace23NeedsBoxScan(task) {
  return !!task && !trace23BuiltInIds.has(task.id) && !task.boxScan;
}
async function trace23Remove(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task || trace23BuiltInIds.has(id)) return;
  if (
    !confirm(
      "Remove " +
        task.code +
        " from the library? Existing evaluations are retained, but this task will no longer be available for new assignments.",
    )
  )
    return;
  const idx = tasks.indexOf(task);
  tasks.splice(idx, 1);
  if (!trace23Save()) {
    tasks.splice(idx, 0, task);
    return;
  }
  try {
    await trace23DeleteFile(id);
  } catch (e) {}
  renderStandards();
}
const trace23OriginalRenderStandards = renderStandards;
renderStandards = function () {
  trace23OriginalRenderStandards();
  const root = document.getElementById("content");
  const wrapper = document.createElement("section");
  wrapper.className = "panel";
  wrapper.innerHTML = `<div class="section-head"><div><h2>Import T&EO</h2><p class="section-sub">Drag and drop a T&EO PDF or browse your computer. Parsing begins at the page headed “Performance Steps and Measures.”</p></div></div><div class="trace23-drop" id="trace23Drop" tabindex="0" role="button" aria-label="Drop a T&EO PDF or choose a file"><strong>↓ Drop T&EO Here</strong><small>PDF or text (.txt) · Or click to browse</small></div><input type="file" id="trace23File" accept=".pdf,.txt,application/pdf,text/plain" style="display:none"><div id="trace23Status" class="trace23-status">PDF reader loads on demand; an internet connection is needed for PDF files. Text files work offline.</div><div class="trace23-preview" id="trace23Preview" style="display:none"></div><h3>Imported T&EOs (${tasks.filter((t) => !trace23BuiltInIds.has(t.id)).length})</h3><div>${
    tasks
      .filter((t) => !trace23BuiltInIds.has(t.id))
      .map(
        (t) =>
          `<div class="trace23-imported"><span><strong>${esc(t.code)}</strong> — ${esc(t.title)} <small>· ${t.steps.length} steps</small></span><button class="secondary" data-t23-download="${esc(t.id)}">Download source</button><button class="danger" data-t23-remove="${esc(t.id)}">Remove</button></div>`,
      )
      .join("") || '<p class="hint">No imported T&EOs yet.</p>'
  }</div>`;
  root.insertBefore(wrapper, root.firstChild);
  const drop = document.getElementById("trace23Drop"),
    input = document.getElementById("trace23File");
  drop.onclick = () => input.click();
  drop.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  };
  input.onchange = () => trace23HandleFile(input.files[0]);
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("dragging");
  };
  drop.ondragleave = () => drop.classList.remove("dragging");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("dragging");
    trace23HandleFile(e.dataTransfer.files[0]);
  };
  root
    .querySelectorAll("[data-t23-download]")
    .forEach((b) => (b.onclick = () => trace23Download(b.dataset.t23Download)));
  root
    .querySelectorAll("[data-t23-remove]")
    .forEach((b) => (b.onclick = () => trace23Remove(b.dataset.t23Remove)));
};
// Library-only warehouse: observation controls belong exclusively on Evaluations.
renderStandards = function () {
  const root = document.getElementById("content");
  const imported = tasks.filter((t) => !trace23BuiltInIds.has(t.id));
  const builtins = tasks.filter((t) => trace23BuiltInIds.has(t.id));
  root.innerHTML = `<div class="panel"><div class="section-head"><div><h2>T&EO Library</h2><p class="section-sub">Reference warehouse · Upload, download, and remove T&EOs. Assign tasks to units in Units & Events; record assessments in Evaluations.</p></div><span class="pill">${tasks.length} T&EOs</span></div>
 <div class="trace23-drop" id="trace23Drop" tabindex="0" role="button" aria-label="Drop a T&EO PDF or choose a file"><strong>↓ Drop T&EO Here</strong><small>Drop PDF / TXT or click to browse your computer</small></div>
 <input type="file" id="trace23File" accept=".pdf,.txt,application/pdf,text/plain" style="display:none">
 <div id="trace23Status" class="trace23-status">PDF imports require internet to load the reader. Extraction runs from “Performance Steps and Measures” up to “Task Performance Summary Block.”</div>
 <div class="trace23-preview" id="trace23Preview" style="display:none"></div>
 <div class="section-head" style="margin-top:24px"><h2>Uploaded T&EOs (${imported.length})</h2></div>
 <div>${imported.map((t) => `<div class="trace23-imported"><span><strong>${esc(t.code)}</strong> — ${esc(t.title)} <small>· ${t.steps.length} performance steps · ${esc(t.source || "Uploaded file")}</small></span><button class="secondary" data-t23-download="${esc(t.id)}">Download</button><button class="danger" data-t23-remove="${esc(t.id)}">Delete</button></div>`).join("") || '<p class="hint">No uploaded T&EOs yet. Use the drop box above to add one.</p>'}</div>
 <div class="section-head" style="margin-top:24px"><h2>Included References (${builtins.length})</h2></div>
 <div>${builtins.map((t) => `<div class="trace23-imported"><span><strong>${esc(t.code)}</strong> — ${esc(t.title)} <small>· ${t.steps.length} performance steps</small></span><span class="pill">Built-in reference</span></div>`).join("")}</div>
 <p class="hint">Included references have no uploaded source file to download. Uploaded documents are stored in this browser. Deleting an uploaded T&EO removes it from the active library but retains historical evaluation records.</p></div>`;
  const drop = document.getElementById("trace23Drop"),
    input = document.getElementById("trace23File");
  drop.onclick = () => input.click();
  drop.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  };
  input.onchange = () => trace23HandleFile(input.files[0]);
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("dragging");
  };
  drop.ondragleave = () => drop.classList.remove("dragging");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("dragging");
    trace23HandleFile(e.dataTransfer.files[0]);
  };
  root
    .querySelectorAll("[data-t23-download]")
    .forEach((b) => (b.onclick = () => trace23Download(b.dataset.t23Download)));
  root
    .querySelectorAll("[data-t23-remove]")
    .forEach((b) => (b.onclick = () => trace23Remove(b.dataset.t23Remove)));
};
const trace23OriginalRender = render;
render = function () {
  trace23OriginalRender();
};

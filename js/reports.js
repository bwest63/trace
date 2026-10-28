/* TRACE formatted reports: EXSUM (Word) and FAAR (PowerPoint).
 *
 * Both reports start from the unit's own templates in templates/. Those files
 * hold fill-in markers:
 *   {{KEY}}              replaced with text (event name, date, ...)
 *   {{SEQ:list:role}}    a paragraph pattern. The first pattern paragraph of a
 *                        list is replaced by the generated paragraphs, each
 *                        drawn from the pattern for its role; the rest are removed.
 *   {{.field}}           a field of the generated paragraph's item
 * The FAAR's hidden slide containing {{PAGE_TITLE}} is the pattern for the
 * sustain/improve discussion slides; it is repeated once per page.
 *
 * Content comes from the OC/T evaluation records for the selected unit and
 * training event: ODR findings, AAR development inputs, and GO / NO-GO step
 * notes. Event-level details that evaluations do not hold (CTOs, key
 * leaders, deliverables, signature block) are entered on the AAR page.
 */
(function () {
  const JSZIP_SRC = "js/vendor/jszip-3.10.1.min.js";
  const EXSUM_TEMPLATE = "templates/exsum-template.docx";
  const FAAR_TEMPLATE = "templates/faar-template.pptx";
  const DETAILS_KEY = "trace_report_details_v1";

  const DEFAULTS = {
    observingUnit: "2-410th BSB",
    officeSymbol: "AFKA-DVE-SH",
    memoDate: "",
    keyLeaders: "",
    overview: "",
    mission: "",
    ctos: "",
    maarDeliverables: "",
    faarDeliverables: "",
    exsumRefs: [
      "FM 4-0: Sustainment Operations",
      "AR 350-1: Army Training and Leader Development",
      "ATP 4-93.1: Combat Sustainment Support Battalion",
      "FM 6-0: Commander and Staff Organization and Operations",
    ].join("\n"),
    faarRefs: [
      "ATP 7-0.01",
      "ADP 5-0",
      "ATP 4-01.45",
      "ATP 4-11",
      "ADP 6-0",
      "ATP 4-31",
      "ATP 4-33",
      "ATP 4-93.1",
      "PAM 750-8",
      "FM 4-0",
      "FM 5-0",
      "FM 6-0",
      "UNIT SOP",
      "UNIT TACSOP",
    ].join("\n"),
    poc: "",
    sigName: "",
    sigRank: "CPT, LG",
    sigTitle: "Senior Logistics OC/T",
  };

  /* ---------------------------------------------------------------- text */

  const clean = (s) =>
    String(s ?? "")
      .replace(/\s+/g, " ")
      .trim();
  // A finished sentence: capital first letter, ends in punctuation.
  const sentence = (s) => {
    let t = clean(s);
    if (!t) return "";
    t = t[0].toUpperCase() + t.slice(1);
    return /[.!?)"'”]$/.test(t) ? t : t + ".";
  };
  const joinSentences = (...parts) =>
    parts.map(sentence).filter(Boolean).join(" ");
  const lines = (s) =>
    String(s ?? "")
      .split(/\r?\n/)
      .map(clean)
      .filter(Boolean);
  const keyOf = (s) =>
    clean(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const shortStep = (t, n = 70) => {
    const s = clean(t);
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s;
  };

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  function parseDay(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  }
  const memoDate = (v) => {
    const d = parseDay(v);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const briefDate = (v) => {
    const d = parseDay(v);
    return `${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()} ${String(d.getFullYear()).slice(2)}`;
  };

  /* ------------------------------------------------------------- details */

  const isAdmin = () => !window.TraceSync?.shared || window.TraceSync.isAdmin;
  const findEvent = (id) =>
    trace18.events.find((e) => String(e.id) === String(id));
  function localDetails() {
    try {
      const v = JSON.parse(localStorage.getItem(DETAILS_KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  function getDetails(eventId, unitId) {
    const local = localDetails()[eventId + "|" + unitId];
    const shared = findEvent(eventId)?.reportDetails?.[unitId];
    return { ...DEFAULTS, ...(shared || {}), ...(local || {}) };
  }
  // Admins save to the event, which syncs to every OC/T. Other OC/Ts can't
  // change events, so their edits stay on this device.
  function saveDetails(eventId, unitId, values) {
    const ev = findEvent(eventId);
    if (isAdmin() && ev) {
      ev.reportDetails = { ...(ev.reportDetails || {}), [unitId]: values };
      trace18Save();
      const all = localDetails();
      delete all[eventId + "|" + unitId];
      try {
        localStorage.setItem(DETAILS_KEY, JSON.stringify(all));
      } catch {}
      return "shared";
    }
    const all = localDetails();
    all[eventId + "|" + unitId] = values;
    try {
      localStorage.setItem(DETAILS_KEY, JSON.stringify(all));
    } catch {
      alert("Could not save report details in this browser.");
    }
    return "local";
  }

  /* ---------------------------------------------------------- compiling */

  // Collects paragraphs, merging duplicates entered by more than one OC/T.
  function bucket() {
    const items = [];
    const byKey = new Map();
    return {
      items,
      add(text, recs = []) {
        const t = sentence(text);
        const r = recs.map(sentence).filter(Boolean);
        if (!t && !r.length) return null;
        const k = keyOf(t);
        let item = k ? byKey.get(k) : null;
        if (!item) {
          item = { text: t, recs: [] };
          items.push(item);
          if (k) byKey.set(k, item);
        }
        for (const x of r)
          if (!item.recs.some((y) => keyOf(y) === keyOf(x))) item.recs.push(x);
        return item;
      },
    };
  }

  function compileTask(task, recs) {
    const sustains = bucket(),
      improves = bucket();
    const steps = task?.steps || [];
    const stepLabel = (i) =>
      `Step ${steps[i]?.number || i + 1} (${shortStep(steps[i]?.text || task?.measures?.[i] || "")})`;
    for (const r of recs) {
      const a = r.aarInputs || {};
      const m = r.measures || [];
      const covered = new Set();
      let madeSustain = false,
        lastImprove = null;
      // ODR findings: observation + discussion, with recommendation and corrective action.
      for (const f of r.findings || []) {
        const i = Number(f.step);
        const text = joinSentences(f.observation, f.discussion);
        const rs = [f.recommendation, f.action].filter((x) => clean(x));
        if (!text && !rs.length) continue;
        covered.add(i);
        if (m[i]?.rating === "GO" && text) {
          sustains.add(text, rs);
          madeSustain = true;
        } else
          lastImprove =
            improves.add(
              text ||
                `OC/Ts identified a shortfall during ${stepLabel(i).replace(/^Step/, "step")}`,
              rs,
            ) || lastImprove;
      }
      // AAR development inputs.
      if (clean(a.sustain)) {
        sustains.add(a.sustain);
        madeSustain = true;
      }
      const narrative = joinSentences(a.actual, a.cause);
      let corrective = clean(a.corrective);
      if (narrative) {
        lastImprove = improves.add(narrative, corrective ? [corrective] : []);
        corrective = "";
      }
      // NO-GO step notes not already written up as a finding.
      const nogo = m
        .map((x, i) =>
          x?.rating === "NO-GO" && !covered.has(i)
            ? `${stepLabel(i)}: ${clean(x.note) || "assessed NO-GO"}`
            : null,
        )
        .filter(Boolean);
      if (nogo.length) {
        const n = nogo.length;
        lastImprove = improves.add(
          `OC/Ts assessed ${n} performance measure${n === 1 ? "" : "s"} as NO-GO. ` +
            nogo.map(sentence).join(" "),
          corrective ? [corrective] : [],
        );
        corrective = "";
      }
      if (corrective) {
        if (lastImprove) improves.add(lastImprove.text, [corrective]);
        else
          lastImprove = improves.add(
            clean(r.observations) ||
              "OC/Ts identified the following corrective action for this task",
            [corrective],
          );
      }
      // GO step notes become a sustain when the OC/T wrote no sustain of their own.
      if (!madeSustain) {
        const go = m
          .map((x, i) =>
            x?.rating === "GO" && clean(x.note)
              ? `${stepLabel(i)}: ${clean(x.note)}`
              : null,
          )
          .filter(Boolean);
        if (go.length) {
          const total = m.filter(
            (x) => x?.rating === "GO" || x?.rating === "NO-GO",
          ).length;
          const met = m.filter((x) => x?.rating === "GO").length;
          sustains.add(
            `The unit met the standard on ${met} of ${total} observed performance measure${total === 1 ? "" : "s"}. ` +
              go.map(sentence).join(" "),
          );
          madeSustain = true;
        }
      }
      // Overall observations, only when nothing more specific was recorded.
      if (!madeSustain && !lastImprove && clean(r.observations)) {
        const anyNoGo = m.some((x) => x?.rating === "NO-GO");
        (anyNoGo || ["P", "U"].includes(r.rating) ? improves : sustains).add(
          r.observations,
        );
      }
    }
    return { sustains: sustains.items, improves: improves.items };
  }

  /* Edits made on the AAR page, saved with the report details:
   *   edits.items[key] = { text, recs, kind: "S"|"I", hidden, order }
   *   edits.added      = [{ id, teoId, text, recs, kind, hidden, order }]
   * An item's key comes from its compiled text, so an edit stays attached
   * until the OC/T's source wording changes. */
  const emptyEdits = () => ({ items: {}, added: [] });
  function itemKey(teoId, kind, it) {
    return `${teoId}|${kind}|${keyOf(it.text) || "r " + keyOf(it.recs[0] || "")}`;
  }
  function applyEdits(teoId, compiled, edits) {
    const e = edits || emptyEdits();
    const base = [
      ...compiled.sustains.map((it, i) => ({ ...it, kind: "S", idx: i })),
      ...compiled.improves.map((it, i) => ({ ...it, kind: "I", idx: 1000 + i })),
    ].map((it) => {
      const key = itemKey(teoId, it.kind, it);
      const ov = e.items?.[key] || {};
      return {
        key,
        source: { text: it.text, recs: it.recs, kind: it.kind },
        edited: Object.keys(ov).some((k) => k !== "order"),
        text: ov.text ?? it.text,
        recs: ov.recs ?? it.recs,
        kind: ov.kind || it.kind,
        hidden: !!ov.hidden,
        order: ov.order ?? it.idx,
      };
    });
    const added = (e.added || [])
      .filter((a) => a.teoId === teoId)
      .map((a) => ({ ...a, key: "add|" + a.id, added: true, recs: a.recs || [], order: a.order ?? 5000 }));
    const all = [...base, ...added].sort(
      (a, b) => (a.kind === b.kind ? a.order - b.order : a.kind === "S" ? -1 : 1),
    );
    const visible = (k) =>
      all
        .filter((it) => it.kind === k && !it.hidden && (clean(it.text) || it.recs.some(clean)))
        .map((it) => ({ text: sentence(it.text), recs: it.recs.map(sentence).filter(Boolean) }));
    return { all, sustains: visible("S"), improves: visible("I") };
  }

  function compileReport(eventId, unitId) {
    const ev = findEvent(eventId);
    const unit = trace18.units.find((u) => u.id === unitId);
    const details = getDetails(eventId, unitId);
    const recs = allRecords().filter(
      (r) => String(r.exerciseId) === String(eventId) && r.unitId === unitId,
    );
    const assigned = ev ? traceTaskAssignments(ev, unitId) : [];
    const order = [...new Set([...assigned, ...recs.map((r) => r.taskId)])];
    const teos = order.map((id) => {
      const t = tasks.find((x) => x.id === id);
      const rs = recs.filter((r) => r.taskId === id);
      return {
        id,
        code: t?.code || id,
        title: t?.title || "",
        assigned: assigned.includes(id),
        evaluations: rs.length,
        evaluators: [...new Set(rs.map((r) => r.evaluator).filter(Boolean))],
        ...applyEdits(id, compileTask(t, rs), details.edits),
      };
    });
    return {
      event: ev,
      unit,
      details,
      teos,
      observed: teos.filter((t) => t.evaluations),
      recordCount: recs.length,
    };
  }

  /* ------------------------------------------------------------ templates */

  const xmlText = (s) =>
    String(s ?? "")
      .replace(/[^\x09\x0A\x0D\x20-퟿-�\u{10000}-\u{10FFFF}]/gu, "")
      .replace(/\s*\n\s*/g, " ")
      .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const PARA = {
    w: /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g,
    a: /<a:p(?=[\s>])[^>]*>[\s\S]*?<\/a:p>/g,
  };
  const SEQ = /\{\{SEQ:(\w+):(\w+)\}\}/;
  function fillXml(xml, data, lists, kind) {
    const re = PARA[kind];
    const patterns = {};
    for (const m of xml.matchAll(re)) {
      const s = m[0].match(SEQ);
      if (s) (patterns[s[1]] ||= {})[s[2]] = m[0].replace(s[0], "");
    }
    const placed = new Set();
    xml = xml.replace(re, (p) => {
      const s = p.match(SEQ);
      if (!s) return p;
      if (placed.has(s[1])) return "";
      placed.add(s[1]);
      return (lists[s[1]] || [])
        .map((item) =>
          (patterns[s[1]][item.role] || "").replace(
            /\{\{\.(\w+)\}\}/g,
            (_, k) => xmlText(item[k]),
          ),
        )
        .join("");
    });
    return xml.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => xmlText(data[k]));
  }

  let jszipLoading = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve();
    return (jszipLoading ||= new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = JSZIP_SRC;
      el.onload = resolve;
      el.onerror = () => {
        jszipLoading = null;
        reject(Error("Could not load the report library. Check your connection."));
      };
      document.body.appendChild(el);
    }));
  }
  async function openTemplate(url) {
    await loadJSZip();
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw Error(`Could not load the report template (${url}).`);
    return JSZip.loadAsync(await res.arrayBuffer());
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const fileSafe = (s) => clean(s).replace(/[^a-z0-9_-]+/gi, "_").replace(/^_|_$/g, "");

  /* --------------------------------------------------------------- EXSUM */

  function exsumContent(rep) {
    const d = rep.details,
      ev = rep.event || {};
    const ctos = lines(d.ctos);
    const where = clean(ev.location) ? ` at ${clean(ev.location)}` : "";
    const when = clean(ev.dates) ? ` from ${clean(ev.dates)}` : "";
    const overview = [
      `${clean(d.observingUnit) || "The observing unit"} provided OC/T coverage during ${clean(ev.name)}${where}${when}.`,
      sentence(d.overview),
      ctos.length
        ? "The commander's training objectives were: " +
          ctos.map((c) => clean(c).replace(/[.;]$/, "")).join("; ") +
          "."
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const obs = [];
    for (const t of rep.observed) {
      obs.push({ role: "teo", text: `${t.code} ${t.title}`.trim() });
      if (!t.sustains.length && !t.improves.length)
        obs.push({
          role: "para",
          label: "",
          text: "No sustain or improve observations were recorded for this T&EO.",
        });
      for (const [label, list] of [
        ["Sustain: ", t.sustains],
        ["Improve: ", t.improves],
      ])
        for (const it of list) {
          obs.push({ role: "para", label, text: it.text });
          for (const r of it.recs) obs.push({ role: "rec", text: r });
        }
    }
    return {
      data: {
        OFFICE_SYMBOL: clean(d.officeSymbol),
        MEMO_DATE: memoDate(d.memoDate),
        UNIT: rep.unit?.name || "",
        EVENT: clean(ev.name),
        DATES: clean(ev.dates) || "Dates TBD",
        OVERVIEW: overview,
        KEY_LEADERS: lines(d.keyLeaders).join(", ") || "Not recorded.",
        TEOS_OBSERVED:
          rep.observed.map((t) => `${t.code} ${t.title}`.trim()).join(", ") ||
          "None recorded.",
        POC: clean(d.poc) || "__________.",
        SIG_NAME: clean(d.sigName),
        SIG_RANK: clean(d.sigRank),
        SIG_TITLE: clean(d.sigTitle),
      },
      lists: {
        obs,
        refs: lines(d.exsumRefs).map((text) => ({ role: "ref", text })),
      },
    };
  }

  async function buildExsum(rep) {
    const zip = await openTemplate(EXSUM_TEMPLATE);
    const { data, lists } = exsumContent(rep);
    const parts = Object.keys(zip.files).filter((n) =>
      /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
    );
    for (const n of parts)
      zip.file(n, fillXml(await zip.file(n).async("string"), data, lists, "w"));
    return zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  /* ---------------------------------------------------------------- FAAR */

  // Rough height (points) of each paragraph on the discussion slide's text box,
  // used to split long TE&Os across slides instead of overflowing.
  // [characters per line, line height, space before]
  const PAGE_BUDGET = 395;
  const cost = (it) => {
    const per = { teo: [58, 24, 6], head: [64, 22, 10], para: [92, 17, 6], rec: [100, 14.5, 3] }[it.role];
    const chars = clean(it.text).length + (it.role === "rec" ? 16 : 0);
    return Math.max(1, Math.ceil(chars / per[0])) * per[1] + per[2];
  };
  function discussionPages(rep) {
    const pages = [];
    for (const t of rep.observed) {
      if (!t.sustains.length && !t.improves.length) continue;
      const blocks = [];
      for (const [head, list] of [
        ["SUSTAIN", t.sustains],
        ["IMPROVE", t.improves],
      ])
        list.forEach((it, i) =>
          blocks.push({
            head,
            first: i === 0,
            items: [{ role: "para", text: it.text }, ...it.recs.map((text) => ({ role: "rec", text }))],
          }),
        );
      const teoLine = { role: "teo", text: `${t.code} ${t.title}`.trim() };
      let page = null,
        used = 0,
        head = "";
      const start = (cont) => {
        page = { title: "AAR Discussion" + (cont ? " (cont.)" : ""), items: [teoLine] };
        pages.push(page);
        used = cost(teoLine);
        head = "";
      };
      start(false);
      for (const b of blocks) {
        const headItem = { role: "head", text: b.head };
        const need = b.items.reduce((n, it) => n + cost(it), 0) + (head !== b.head ? cost(headItem) : 0);
        if (used + need > PAGE_BUDGET && page.items.length > 1) start(true);
        if (head !== b.head) {
          const h = { ...headItem, text: b.head + (b.first ? "" : " (cont.)") };
          page.items.push(h);
          used += cost(h);
          head = b.head;
        }
        page.items.push(...b.items);
        used += b.items.reduce((n, it) => n + cost(it), 0);
      }
    }
    return pages;
  }

  function faarContent(rep) {
    const d = rep.details,
      ev = rep.event || {};
    const deliverable = (line) => {
      const i = line.indexOf(":");
      return i > 0
        ? { role: "item", label: line.slice(0, i + 1) + " ", text: line.slice(i + 1).trim() }
        : { role: "item", label: line, text: "" };
    };
    const mets = (rep.teos.some((t) => t.assigned) ? rep.teos.filter((t) => t.assigned) : rep.observed).map(
      (t) => ({ role: "item", code: t.code, title: t.title }),
    );
    return {
      data: {
        UNIT: rep.unit?.name || "",
        EVENT: clean(ev.name),
        BRIEF_DATE: briefDate(d.memoDate),
        MISSION: clean(d.mission) || "Unit mission",
      },
      lists: {
        cto: lines(d.ctos).map((text) => ({ role: "item", text })),
        met: mets,
        maar: lines(d.maarDeliverables).map(deliverable),
        faar: lines(d.faarDeliverables).map((text) => ({ role: "item", text })),
        ref: lines(d.faarRefs).map((text) => ({ role: "item", text })),
      },
      pages: discussionPages(rep),
    };
  }

  async function buildFaar(rep) {
    const zip = await openTemplate(FAAR_TEMPLATE);
    const { data, lists, pages } = faarContent(rep);
    const read = (n) => zip.file(n).async("string");
    const slidePaths = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    let patternPath = "",
      patternXml = "";
    for (const n of slidePaths) {
      const xml = await read(n);
      if (xml.includes("{{PAGE_TITLE}}")) {
        patternPath = n;
        patternXml = xml;
      } else zip.file(n, fillXml(xml, data, lists, "a"));
    }
    if (!patternPath) throw Error("The FAAR template is missing its discussion slide.");
    const relsOf = (p) => p.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const patternRels = await read(relsOf(patternPath));
    const patternFile = patternPath.split("/").pop();

    let presRels = await read("ppt/_rels/presentation.xml.rels");
    let pres = await read("ppt/presentation.xml");
    let types = await read("[Content_Types].xml");
    const relEl = presRels.match(new RegExp(`<Relationship [^>]*Target="slides/${patternFile}"[^>]*/>`))[0];
    const patternRid = relEl.match(/Id="([^"]+)"/)[1];

    let slideNum = Math.max(...slidePaths.map((n) => +n.match(/slide(\d+)\.xml$/)[1]));
    let rid = Math.max(...[...presRels.matchAll(/Id="rId(\d+)"/g)].map((m) => +m[1]));
    let sldId = Math.max(...[...pres.matchAll(/<p:sldId id="(\d+)"/g)].map((m) => +m[1]));
    const ids = [],
      rels = [],
      overrides = [];
    for (const page of pages) {
      const n = ++slideNum,
        r = "rId" + ++rid;
      const xml = fillXml(
        patternXml.replace(/(<p:sld\b[^>]*?) show="0"/, "$1"),
        { ...data, PAGE_TITLE: page.title },
        { disc: page.items },
        "a",
      );
      zip.file(`ppt/slides/slide${n}.xml`, xml);
      zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, patternRels);
      overrides.push(
        `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
      );
      rels.push(
        `<Relationship Id="${r}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`,
      );
      ids.push(`<p:sldId id="${++sldId}" r:id="${r}"/>`);
    }
    // Swap the hidden pattern slide for the generated ones, in the same position.
    pres = pres.replace(new RegExp(`<p:sldId [^>]*r:id="${patternRid}"[^>]*/>`), ids.join(""));
    presRels = presRels.replace(relEl, rels.join(""));
    types = types
      .replace(new RegExp(`<Override PartName="/ppt/slides/${patternFile}"[^>]*/>`), "")
      .replace("</Types>", overrides.join("") + "</Types>");
    zip.remove(patternPath);
    zip.remove(relsOf(patternPath));
    zip.file("ppt/presentation.xml", pres);
    zip.file("ppt/_rels/presentation.xml.rels", presRels);
    zip.file("[Content_Types].xml", types);
    return zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  }

  /* ------------------------------------------------------------------ UI */

  const FIELDS = [
    ["observingUnit", "Observing unit (OC/T unit)", "input"],
    ["officeSymbol", "Office symbol", "input"],
    ["memoDate", "Memo / brief date", "date"],
    ["keyLeaders", "Unit key leaders present (one per line, e.g. LTC Smith, BN CDR)", "textarea"],
    ["overview", "Engagement overview: how the event challenged the unit", "textarea"],
    ["mission", "Unit mission (FAAR)", "textarea"],
    ["ctos", "Commander's training objectives (one per line)", "textarea"],
    ["maarDeliverables", "MAAR deliverables (one per line, e.g. Critical Path: SPO)", "textarea"],
    ["faarDeliverables", "FAAR deliverables (one per line)", "textarea"],
    ["exsumRefs", "EXSUM references (one per line)", "textarea"],
    ["faarRefs", "FAAR references (one per line)", "textarea"],
    ["poc", "EXSUM point of contact (leave blank to fill in later)", "input"],
    ["sigName", "Signature block name (leave blank to fill in later)", "input"],
    ["sigRank", "Signature block rank, branch", "input"],
    ["sigTitle", "Signature block title", "input"],
  ];
  const h = (s) => esc(String(s ?? ""));
  let reportUnit = "";

  function itemHTML(t, it, i, list) {
    const recs = it.recs.join("\n");
    return `<div class="trace-rpt-item ${it.hidden ? "is-hidden" : ""}" data-key="${h(it.key)}" data-teo="${h(t.id)}">
<div class="trace-rpt-itembar">
<div class="trace-rpt-kind" role="group" aria-label="Sustain or improve"><button type="button" data-act="kind" data-kind="S" class="${it.kind === "S" ? "on" : ""}">Sustain</button><button type="button" data-act="kind" data-kind="I" class="${it.kind === "I" ? "on" : ""}">Improve</button></div>
<label class="trace-rpt-include"><input type="checkbox" data-act="include" ${it.hidden ? "" : "checked"}> Include in reports</label>
<span class="trace-rpt-tag">${it.added ? "Added" : it.edited ? "Edited" : ""}</span>
<span class="trace-rpt-tools"><button type="button" class="secondary" data-act="up" ${i === 0 ? "disabled" : ""} title="Move up" aria-label="Move up">↑</button><button type="button" class="secondary" data-act="down" ${i === list.length - 1 ? "disabled" : ""} title="Move down" aria-label="Move down">↓</button>${
      it.added
        ? '<button type="button" class="secondary" data-act="delete">Delete</button>'
        : it.edited
          ? '<button type="button" class="secondary" data-act="reset" title="Go back to the wording from the evaluations">Reset</button>'
          : ""
    }</span></div>
<label>Paragraph<textarea rows="${Math.min(8, Math.max(2, Math.ceil(it.text.length / 95)))}" data-field="text">${h(it.text)}</textarea></label>
<label>Recommendations (one per line)<textarea rows="${Math.max(1, it.recs.length)}" data-field="recs">${h(recs)}</textarea></label></div>`;
  }

  function editorHTML(rep) {
    if (!rep.observed.length)
      return '<p class="hint">No saved evaluations for this unit at this event yet. The reports will have no observations until OC/Ts save evaluations.</p>';
    return rep.observed
      .map((t) => {
        const group = (kind, label) => {
          const list = t.all.filter((it) => it.kind === kind);
          return `<div class="trace-rpt-group"><div class="trace-rpt-grouphead"><b>${label}</b><button type="button" class="secondary" data-act="add" data-teo="${h(t.id)}" data-kind="${kind}">＋ Add ${label.toLowerCase()} paragraph</button></div>${
            list.map((it, i) => itemHTML(t, it, i, list)).join("") ||
            `<p class="hint">No ${label.toLowerCase()} paragraphs.</p>`
          }</div>`;
        };
        return `<div class="trace-rpt-teo"><div class="trace-rpt-teohead"><strong>${h(t.code)} ${h(t.title)}</strong><small>${t.evaluations} evaluation${t.evaluations === 1 ? "" : "s"}${t.evaluators.length ? " · " + h(t.evaluators.join(", ")) : ""}</small></div>${group("S", "Sustain")}${group("I", "Improve")}</div>`;
      })
      .join("");
  }

  function mountReports() {
    const sel = document.getElementById("trace32AAREvent");
    const shell = document.querySelector("#content .dash-shell");
    if (!sel || !shell || document.getElementById("traceReports")) return;
    const panel = document.createElement("div");
    panel.className = "trace-rpt";
    panel.id = "traceReports";
    // Directly under the training event picker, which these reports follow.
    sel.closest("label").insertAdjacentElement("afterend", panel);

    let lastStatus = "";
    // Redraw after a change without losing the reader's place.
    const redraw = () => {
      const scrollers = [document.scrollingElement, ...document.querySelectorAll("main, #content")].filter(Boolean);
      const at = scrollers.map((el) => el.scrollTop);
      const open = panel.querySelector(".trace-rpt-details")?.open;
      draw();
      if (open) panel.querySelector(".trace-rpt-details").open = true;
      scrollers.forEach((el, i) => (el.scrollTop = at[i]));
    };
    const draw = () => {
      const ev = findEvent(sel.value);
      const unitIds = (ev?.unitIds || []).filter((id) => trace18.units.some((u) => u.id === id));
      if (!unitIds.includes(reportUnit)) reportUnit = unitIds[0] || "";
      if (!ev || !reportUnit) {
        panel.innerHTML =
          '<div class="section-head"><h2>EXSUM &amp; FAAR</h2></div><p class="hint">Assign a unit to this training event under Units &amp; Events to generate reports.</p>';
        return;
      }
      const rep = compileReport(ev.id, reportUnit);
      const d = rep.details;
      const where = isAdmin()
        ? "Saved to the training event and shared with every OC/T."
        : "Only admins can save shared report details, so yours are kept on this device.";
      panel.innerHTML = `<div class="section-head"><h2>EXSUM &amp; FAAR</h2><span>Formatted reports compiled from OC/T evaluations</span></div>
<div class="form-grid"><label>Observed unit<select id="traceRptUnit">${unitIds
        .map((id) => `<option value="${h(id)}" ${id === reportUnit ? "selected" : ""}>${h(trace18UnitName(id))}</option>`)
        .join("")}</select></label></div>
<div class="trace-rpt-actions"><button class="primary" id="traceRptExsum">Generate EXSUM (Word)</button><button class="primary" id="traceRptFaar">Generate FAAR (PowerPoint)</button><span id="traceRptStatus" class="hint" role="status"></span></div>
<details class="trace-rpt-details"><summary>Report details: CTOs, key leaders, deliverables, signature block</summary><p class="hint">${where}</p><div class="trace-rpt-fields">${FIELDS.map(
        ([k, label, type]) =>
          `<label class="${type === "textarea" ? "wide" : ""}">${h(label)}${
            type === "textarea"
              ? `<textarea rows="3" data-rpt="${k}">${h(d[k])}</textarea>`
              : `<input type="${type === "date" ? "date" : "text"}" data-rpt="${k}" value="${h(type === "date" ? d[k] || new Date().toLocaleDateString("en-CA") : d[k])}">`
          }</label>`,
      ).join("")}</div><button class="secondary" id="traceRptSave">Save report details</button></details>
<h3 class="trace-rpt-h3">Sustains &amp; improves <small>${rep.recordCount} evaluation${rep.recordCount === 1 ? "" : "s"}</small></h3>
<p class="hint">Compiled from each OC/T's ODR findings, AAR development inputs, and GO / NO-GO step notes, with duplicates merged. Edit the wording, switch Sustain / Improve, reorder, leave items out, or add your own. Changes save automatically and are used in both reports; the evaluations themselves are not changed. ${isAdmin() ? "" : "Your edits are kept on this device."}</p>
<div id="traceRptPreview">${editorHTML(rep)}</div>`;

      const status = (m) => (document.getElementById("traceRptStatus").textContent = lastStatus = m);
      status(lastStatus);
      const values = () => {
        const v = {};
        panel.querySelectorAll("[data-rpt]").forEach((el) => (v[el.dataset.rpt] = el.value));
        return v;
      };
      document.getElementById("traceRptUnit").onchange = (e) => {
        reportUnit = e.target.value;
        lastStatus = "";
        draw();
      };
      document.getElementById("traceRptSave").onclick = () => {
        const where = saveDetails(ev.id, reportUnit, { ...values(), edits: getDetails(ev.id, reportUnit).edits });
        redraw();
        status(where === "shared" ? "Report details saved." : "Report details saved on this device.");
      };

      // ---- paragraph editor
      const persist = (mutate) => {
        const d = getDetails(ev.id, reportUnit);
        const e = JSON.parse(JSON.stringify(d.edits || emptyEdits()));
        e.items ||= {};
        e.added ||= [];
        mutate(e);
        const where = saveDetails(ev.id, reportUnit, { ...d, ...values(), edits: e });
        status(where === "shared" ? "Edits saved." : "Edits saved on this device.");
      };
      const findItem = (el) => {
        const card = el.closest(".trace-rpt-item");
        const t = rep.observed.find((x) => x.id === card.dataset.teo);
        return { t, it: t.all.find((x) => x.key === card.dataset.key) };
      };
      // Apply one change to an item, whether compiled (an override) or added by hand.
      const change = (e, it, fields) => {
        if (it.added) {
          const a = e.added.find((x) => "add|" + x.id === it.key);
          if (a) Object.assign(a, fields);
          return;
        }
        const ov = { ...(e.items[it.key] || {}), ...fields };
        for (const k of ["text", "kind"])
          if (ov[k] !== undefined && ov[k] === it.source[k]) delete ov[k];
        if (ov.recs && ov.recs.join("\n") === it.source.recs.join("\n")) delete ov.recs;
        if (ov.hidden === false) delete ov.hidden;
        if (Object.keys(ov).length) e.items[it.key] = ov;
        else delete e.items[it.key];
      };
      const editor = document.getElementById("traceRptPreview");
      editor.addEventListener("change", (ev2) => {
        const el = ev2.target;
        if (!el.dataset.field && el.dataset.act !== "include") return;
        const { it } = findItem(el);
        if (el.dataset.act === "include") {
          persist((e) => change(e, it, { hidden: !el.checked }));
          redraw();
        } else if (el.dataset.field === "text") persist((e) => change(e, it, { text: el.value.trim() }));
        else persist((e) => change(e, it, { recs: lines(el.value) }));
      });
      editor.addEventListener("click", (ev2) => {
        const b = ev2.target.closest("button[data-act]");
        if (!b || b.disabled) return;
        const act = b.dataset.act;
        if (act === "add") {
          const t = rep.observed.find((x) => x.id === b.dataset.teo);
          const order = Math.max(0, ...t.all.map((x) => x.order)) + 1;
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          persist((e) => e.added.push({ id, teoId: t.id, kind: b.dataset.kind, text: "", recs: [], order }));
          redraw();
          document.querySelector(`.trace-rpt-item[data-key="add|${id}"] textarea`)?.focus();
          return;
        }
        const { t, it } = findItem(b);
        if (act === "kind") {
          if (it.kind === b.dataset.kind) return;
          const order = Math.max(0, ...t.all.map((x) => x.order)) + 1;
          persist((e) => change(e, it, { kind: b.dataset.kind, order }));
        } else if (act === "up" || act === "down") {
          const list = t.all.filter((x) => x.kind === it.kind);
          const i = list.indexOf(it),
            j = act === "up" ? i - 1 : i + 1;
          [list[i], list[j]] = [list[j], list[i]];
          persist((e) => list.forEach((x, n) => change(e, x, { order: n })));
        } else if (act === "reset") persist((e) => delete e.items[it.key]);
        else if (act === "delete") persist((e) => (e.added = e.added.filter((x) => "add|" + x.id !== it.key)));
        redraw();
      });
      const generate = async (kind, button) => {
        button.disabled = true;
        status(`Building ${kind}…`);
        try {
          const now = compileReport(ev.id, reportUnit);
          now.details = { ...DEFAULTS, ...values(), edits: now.details.edits };
          const blob = kind === "EXSUM" ? await buildExsum(now) : await buildFaar(now);
          const base = `${fileSafe(now.unit?.name)}_${fileSafe(ev.name)}`;
          download(blob, kind === "EXSUM" ? `EXSUM_${base}.docx` : `FAAR_${base}.pptx`);
          status(`${kind} downloaded.`);
        } catch (e) {
          console.error(e);
          status(`${kind} failed: ${e.message}`);
        } finally {
          button.disabled = false;
        }
      };
      document.getElementById("traceRptExsum").onclick = (e) => generate("EXSUM", e.target);
      document.getElementById("traceRptFaar").onclick = (e) => generate("FAAR", e.target);
    };
    sel.addEventListener("change", () => {
      lastStatus = "";
      draw();
    });
    draw();
  }

  const css = document.createElement("style");
  css.textContent = `
.trace-rpt{margin:14px 0 18px;padding:14px 16px;border:1px solid #c7a458;border-radius:10px}
.trace-rpt-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}
.trace-rpt-details{margin:10px 0 16px;border:1px solid #40515b;border-radius:10px;padding:10px 14px}
.trace-rpt-details summary{cursor:pointer;font-weight:600}
.trace-rpt-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px 14px;margin:10px 0}
.trace-rpt-fields label{display:flex;flex-direction:column;gap:4px;font-size:13px}
.trace-rpt-fields label.wide{grid-column:1/-1}
.trace-rpt-fields textarea,.trace-rpt-fields input{width:100%;box-sizing:border-box}
.trace-rpt-h3{margin:14px 0 4px}.trace-rpt-h3 small{font-weight:400;color:#a9bdc8;margin-left:6px}
.trace-rpt-teo{border:1px solid #40515b;border-radius:10px;padding:12px 14px;margin:10px 0;background:#18242b}
.trace-rpt-teohead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.trace-rpt-teohead small{color:#a9bdc8}
.trace-rpt-group{margin:10px 0 4px}
.trace-rpt-grouphead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
.trace-rpt-grouphead button{font-size:12px;padding:5px 10px}
.trace-rpt-item{border:1px solid #33444e;border-radius:8px;padding:10px 12px;margin:8px 0;background:#121c22}
.trace-rpt-item.is-hidden{opacity:.5}
.trace-rpt-item label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#a9bdc8;margin-top:6px}
.trace-rpt-item textarea{width:100%;box-sizing:border-box;font-size:14px;font-weight:400;line-height:1.4;resize:vertical}
.trace-rpt-itembar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.trace-rpt-kind{display:inline-flex;border:1px solid #56656e;border-radius:6px;overflow:hidden}
.trace-rpt-kind button{background:transparent;color:#c9d5db;border:0;padding:4px 10px;font-size:12px;cursor:pointer}
.trace-rpt-kind button.on{background:#c7a458;color:#10161a;font-weight:700}
.trace-rpt-item label.trace-rpt-include{display:inline-flex;flex-direction:row;align-items:center;gap:6px;margin:0;width:auto;white-space:nowrap;font-size:12px;font-weight:500;color:#d8e1e7}
.trace-rpt-item label.trace-rpt-include input{width:auto;margin:0}
.trace-rpt-tag{font-size:11px;color:#c7a458;font-weight:600}
.trace-rpt-tools{margin-left:auto;display:flex;gap:6px}
.trace-rpt-tools button{padding:3px 9px;font-size:12px}
`;
  document.head.appendChild(css);

  const previousAAR = renderAAR;
  renderAAR = function () {
    previousAAR();
    mountReports();
  };
  if (state.tab === "aar") renderAAR();

  window.TraceReports = { compileReport, buildExsum, buildFaar, fillXml, exsumContent, faarContent };
})();

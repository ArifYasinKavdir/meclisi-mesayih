/* Meclis-i Meşâyih Atlası — ana uygulama */
"use strict";

(async function () {
  // ————— veri —————
  const [docs, persons, insts, places, network, meta] = await Promise.all(
    ["docs", "persons", "insts", "places", "network", "meta"].map(n =>
      fetch("data/" + n + ".json").then(r => {
        if (!r.ok) throw new Error(n + ".json yüklenemedi");
        return r.json();
      })));

  const TYPE_TR = {
    PERSON: "Kişi", INSTITUTION: "Kurum", LOCATION: "Yer", DATE: "Tarih",
    TARIKAT: "Tarikat", ROLE: "Görev", STATUS_EVENT: "Hâdise",
    DOCUMENT: "Belge", ADMIN_ORG: "İdare",
  };
  const REL_TR = {
    LOCATED_IN: "yerinde", HOLDS_ROLE: "görevinde", AFFILIATED_WITH: "mensubu",
    ADDRESSED_TO: "muhatabı", STATUS_CHANGE: "hâdisesi", SUBMITTED_DOCUMENT: "sundu",
    CHILD_OF: "evlâdı", ISSUED_BY: "düzenledi", APPOINTED_TO: "tayin edildi",
    REPLACED_BY: "yerine geçti", SIBLING_OF: "kardeşi", KIN_OF: "akrabası",
    REMOVED_FROM: "azledildi", TARIKAT_TAG: "tarikatı",
  };
  const CONF_TR = { kesin: "kesin", yuksek: "yüksek", cikarim: "çıkarım", dusuk: "düşük" };

  const docsById = new Map(docs.map(d => [d.id, d]));
  const tl = s => (s || "").toLocaleLowerCase("tr");
  // arama katlaması: şapka/diyakritik ve apostrofları düşür (bektaş = bektâş)
  const fold = s => tl(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʻʼʾʿ'´`′]/g, "").replace(/[-‐-―]/g, " ");
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const docLabel = id => id.replace("_section", " §");

  // arama dizini
  for (const d of docs) {
    const parts = [d.id, d.sum];
    for (const e of d.ents) { parts.push(e.x); if (e.c) parts.push(e.c); }
    d._q = fold(parts.join(" "));
    d._tars = [...new Set(d.ents.filter(e => e.t === "TARIKAT" && e.c).map(e => e.c))];
  }

  // profil komşulukları
  const adj = new Map();
  for (const l of network.links) {
    if (!adj.has(l.s)) adj.set(l.s, []);
    if (!adj.has(l.t)) adj.set(l.t, []);
    adj.get(l.s).push(l); adj.get(l.t).push(l);
  }
  const nodeLabel = id =>
    id.startsWith("t:") ? id.slice(2) :
    id.startsWith("i") ? (insts[id] ? insts[id].d : id) :
    (persons[id] ? persons[id].d : id);

  // yıl aralığı (çözülmüş tüm tarihler üzerinden)
  document.getElementById("meta-span").textContent = meta.span.join("–");

  // ————— görünüm yönetimi —————
  const views = ["belgeler", "ag", "harita", "hakkinda"];
  let netInited = false, mapInited = false;

  function show(view) {
    for (const v of views)
      document.getElementById("view-" + v).hidden = v !== view;
    document.querySelectorAll("#tabs a").forEach(a =>
      a.classList.toggle("active", a.dataset.view === view));
    if (view === "ag" && !netInited) {
      netInited = true;
      AtlasNet.init(network, { openNode });
      const sel = document.getElementById("net-tarikat");
      sel.innerHTML = '<option value="">Tarikat: tümü</option>' +
        meta.tarikats.map(t => `<option>${esc(t)}</option>`).join("");
      sel.addEventListener("change", () => AtlasNet.setTarikat(sel.value));
      document.querySelectorAll('input[name="netmode"]').forEach(r =>
        r.addEventListener("change", () => AtlasNet.setMode(r.value)));
      initNetSearch();
    } else if (view === "ag") AtlasNet.redraw();
    if (view === "harita" && !mapInited) {
      mapInited = true;
      AtlasMap.init(places, insts, { openInst, openDoc: gotoDoc });
      const sel = document.getElementById("map-tarikat");
      sel.innerHTML = '<option value="">Tarikat: tümü</option>' +
        meta.tarikats.map(t => `<option>${esc(t)}</option>`).join("");
      sel.addEventListener("change", () => AtlasMap.setTarikat(sel.value));
      document.getElementById("map-inferred").addEventListener("change", e =>
        AtlasMap.setInferred(e.target.checked));
    } else if (view === "harita") AtlasMap.invalidate();
  }

  function route() {
    const parts = (location.hash || "#/belgeler").slice(2).split("/");
    const v = parts[0] || "belgeler";
    if (v === "belge" && parts[1]) {
      show("belgeler");
      renderDoc(decodeURIComponent(parts[1]));
    } else if (views.includes(v)) show(v);
    else show("belgeler");
  }
  window.addEventListener("hashchange", route);

  const gotoDoc = id => { location.hash = "#/belge/" + encodeURIComponent(id); };

  // ————— belge listesi + filtreler —————
  const listEl = document.getElementById("doc-list");
  const searchEl = document.getElementById("doc-search");
  const decadeEl = document.getElementById("doc-decade");
  const tarikatEl = document.getElementById("doc-tarikat");
  let filtered = docs, currentDocId = null;

  decadeEl.innerHTML = '<option value="">Dönem: tümü</option>' +
    Object.keys(meta.decades).map(d => `<option value="${d}">${d}–${+d + 9}</option>`).join("");
  tarikatEl.innerHTML = '<option value="">Tarikat: tümü</option>' +
    meta.tarikats.map(t => `<option>${esc(t)}</option>`).join("");

  function applyFilters() {
    const q = fold(searchEl.value.trim());
    const dec = decadeEl.value ? +decadeEl.value : null;
    const tar = tarikatEl.value;
    filtered = docs.filter(d =>
      (!q || d._q.includes(q)) &&
      (dec === null || (d.year && d.year >= dec && d.year < dec + 10)) &&
      (!tar || d._tars.includes(tar)));
    renderList();
  }
  searchEl.addEventListener("input", applyFilters);
  decadeEl.addEventListener("change", applyFilters);
  tarikatEl.addEventListener("change", applyFilters);

  function renderList() {
    document.getElementById("doc-count").textContent =
      filtered.length === docs.length ? `${docs.length} kayıt`
        : `${filtered.length} / ${docs.length} kayıt`;
    listEl.innerHTML = filtered.map(d => `
      <li data-id="${esc(d.id)}" ${d.id === currentDocId ? 'class="active"' : ""}>
        <div class="doc-id"><span>${esc(docLabel(d.id))}</span>
          <span class="yr">${d.year || ""}</span></div>
        <div class="doc-sum">${esc(d.sum)}</div>
      </li>`).join("");
  }
  listEl.addEventListener("click", e => {
    const li = e.target.closest("li[data-id]");
    if (li) gotoDoc(li.dataset.id);
  });

  // ————— belge görünümü —————
  function highlight(body, ents) {
    const taken = [];
    const spans = [];
    const order = ents.map((e, i) => ({ e, i }))
      .sort((a, b) => b.e.x.length - a.e.x.length);
    for (const { e, i } of order) {
      if (!e.x || e.x.length < 2) continue;
      let from = 0, pos;
      while ((pos = body.indexOf(e.x, from)) !== -1) {
        const end = pos + e.x.length;
        if (!taken.some(([a, b]) => pos < b && end > a)) {
          taken.push([pos, end]);
          spans.push({ s: pos, e: end, ent: e, idx: i });
        }
        from = pos + 1;
      }
    }
    spans.sort((a, b) => a.s - b.s);
    let html = "", cur = 0;
    for (const sp of spans) {
      html += esc(body.slice(cur, sp.s));
      const t = sp.ent.t;
      const title = TYPE_TR[t] + (sp.ent.c ? " · " + sp.ent.c : "");
      html += `<mark data-t="${t}" data-i="${sp.idx}" title="${esc(title)}"
        style="--hl-bg:var(--bg-${t});--hl-c:var(--c-${t})">${esc(body.slice(sp.s, sp.e))}</mark>`;
      cur = sp.e;
    }
    return html + esc(body.slice(cur));
  }

  function entKey(e) {
    return e.ci || (e.c ? e.t + ":" + e.c : e.t + ":" + tl(e.x));
  }

  function sideBlocks(d) {
    const groups = new Map();   // type -> Map(key -> {label, n, ent})
    for (const e of d.ents) {
      if (!groups.has(e.t)) groups.set(e.t, new Map());
      const g = groups.get(e.t);
      const k = entKey(e);
      const label = e.ci && e.t === "PERSON" ? (persons[e.ci] ? persons[e.ci].d : e.x)
        : e.ci && e.t === "INSTITUTION" ? (insts[e.ci] ? insts[e.ci].d : e.x)
        : e.c || e.x;
      if (!g.has(k)) g.set(k, { label, n: 0, ent: e });
      g.get(k).n++;
    }
    const block = (t, title, extra) => {
      const g = groups.get(t);
      if (!g || !g.size) return "";
      const tags = [...g.values()].map(v => {
        const clickable = (t === "PERSON" && v.ent.ci) ||
          (t === "INSTITUTION" && v.ent.ci) || (t === "LOCATION" && v.ent.c) ||
          (t === "TARIKAT" && v.ent.c);
        const makam = t === "PERSON" && v.ent.ci && persons[v.ent.ci]?.makam;
        return `<span class="tag${clickable ? " linked" : ""}"
          style="--tag-c:var(--c-${t})"
          ${clickable ? `data-k="${t}" data-v="${esc(v.ent.ci || v.ent.c)}"` : ""}
          >${esc(v.label)}${makam ? " ◆" : ""}${v.n > 1 ? ` <span class="cnt">×${v.n}</span>` : ""}</span>`;
      }).join("");
      return `<div class="side-block"><h3><span class="swatch"
        style="background:var(--c-${t})"></span>${title}${extra || ""}</h3>
        <div class="tag-row">${tags}</div></div>`;
    };

    const dateHtml = d.date ? `<div class="side-block"><h3><span class="swatch"
      style="background:var(--c-DATE)"></span>Tarih</h3>
      <span class="date-chip"><span class="iso">${esc(d.date.iso)}</span>
      <span>${esc(d.date.raw)}</span></span>
      ${d.date.conf !== "kesin" ? `<span class="profile-flag">${CONF_TR[d.date.conf] || ""}</span>` : ""}
      </div>` : "";

    const rels = d.rels.length ? `<div class="side-block"><h3>İlişkiler
      <span class="cnt">(${d.rels.length})</span></h3><ul class="rel-list">` +
      d.rels.map(r => {
        const seg = (txt, id) => id && (id[0] === "p" || id[0] === "i" || id[0] === "m")
          ? `<span class="re clickable" data-node="${esc(id)}">${esc(txt)}</span>`
          : `<span class="re">${esc(txt)}</span>`;
        return `<li>${seg(r.s, r.si)} <span class="rl">— ${REL_TR[r.r] || r.r} —</span>
          ${seg(r.t, r.ti)}</li>`;
      }).join("") + "</ul></div>" : "";

    const toggles = `<div class="side-block"><h3>Vurgular</h3>
      <div class="type-toggles">` + Object.keys(TYPE_TR).map(t =>
        `<button data-tg="${t}" style="--tg-bg:var(--bg-${t});--tg-c:var(--c-${t})">
        ${TYPE_TR[t]}</button>`).join("") + "</div></div>";

    return toggles + dateHtml +
      block("PERSON", "Kişiler") + block("INSTITUTION", "Kurumlar") +
      block("LOCATION", "Yerler") + block("TARIKAT", "Tarikatlar") +
      block("ROLE", "Görevler") + block("STATUS_EVENT", "Hâdiseler") + rels;
  }

  function renderDoc(id) {
    const d = docsById.get(id);
    if (!d) return;
    currentDocId = id;
    const idx = filtered.indexOf(d);
    document.getElementById("doc-body-inner").innerHTML = `
      <div class="doc-header">
        <div class="crumbs">
          <h2>Defter 1762 · ${esc(docLabel(d.id))}</h2>
          ${d.date ? `<span class="date-chip"><span class="iso">${esc(d.date.iso)}</span>
            <span>${esc(d.date.raw)}</span></span>` : ""}
          <div class="doc-nav">
            <button id="doc-prev" ${idx <= 0 ? "disabled" : ""}>‹ önceki</button>
            <button id="doc-next" ${idx < 0 || idx >= filtered.length - 1 ? "disabled" : ""}>sonraki ›</button>
          </div>
        </div>
        <p class="doc-summary">${esc(d.sum)}</p>
      </div>
      <div class="doc-text">${highlight(d.body, d.ents)}</div>`;
    document.getElementById("doc-side-pane").innerHTML = sideBlocks(d);

    document.getElementById("doc-prev")?.addEventListener("click",
      () => idx > 0 && gotoDoc(filtered[idx - 1].id));
    document.getElementById("doc-next")?.addEventListener("click",
      () => idx < filtered.length - 1 && gotoDoc(filtered[idx + 1].id));

    const textEl = document.querySelector(".doc-text");
    textEl.addEventListener("click", e => {
      const m = e.target.closest("mark");
      if (!m) return;
      const ent = d.ents[+m.dataset.i];
      entityAction(ent);
    });
    document.getElementById("doc-side-pane").addEventListener("click", e => {
      const tag = e.target.closest(".tag.linked");
      if (tag) return tagAction(tag.dataset.k, tag.dataset.v);
      const re = e.target.closest(".re.clickable");
      if (re) return openNode(re.dataset.node);
      const tg = e.target.closest("[data-tg]");
      if (tg) {
        tg.classList.toggle("off");
        textEl.classList.toggle("hide-" + tg.dataset.tg);
      }
    });

    // listede işaretle + görünür kıl
    renderList();
    document.querySelector(`#doc-list li[data-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
    document.getElementById("doc-body-pane").scrollTop = 0;
  }

  function entityAction(ent) {
    if (ent.ci && (ent.ci[0] === "p" || ent.ci[0] === "m")) return openPerson(ent.ci);
    if (ent.ci && ent.ci[0] === "i") return openInst(ent.ci);
    if (ent.t === "LOCATION" && ent.c) return gotoPlace(ent.c);
    if (ent.t === "TARIKAT" && ent.c) return gotoTarikat(ent.c);
  }
  function tagAction(kind, val) {
    if (kind === "PERSON") return openPerson(val);
    if (kind === "INSTITUTION") return openInst(val);
    if (kind === "LOCATION") return gotoPlace(val);
    if (kind === "TARIKAT") return gotoTarikat(val);
  }
  function gotoPlace(name) {
    location.hash = "#/harita";
    const go = () => AtlasMap.focusPlace(name);
    if (mapInited) setTimeout(go, 80); else setTimeout(go, 400);
  }
  function gotoTarikat(name) {
    location.hash = "#/ag";
    setTimeout(() => {
      const sel = document.getElementById("net-tarikat");
      if (sel) sel.value = name;
      AtlasNet.setTarikat(name);
    }, netInited ? 60 : 300);
  }

  // ————— profil çekmecesi —————
  const drawer = document.getElementById("drawer");
  const scrim = document.getElementById("drawer-scrim");
  const drawerBody = document.getElementById("drawer-body");
  function openDrawer(html) {
    drawerBody.innerHTML = html;
    drawer.hidden = false; scrim.hidden = false;
  }
  function closeDrawer() { drawer.hidden = true; scrim.hidden = true; }
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  window.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

  // profil sahibinin gözünden bağ etiketi: [kaynaksa, hedefse]
  const REL_PROFILE = {
    CHILD_OF: ["ebeveyni", "evlâdı"], REPLACED_BY: ["yerine geçen", "yerini aldığı"],
    SIBLING_OF: ["kardeşi", "kardeşi"], KIN_OF: ["akrabası", "akrabası"],
    AFFILIATED_WITH: ["mensubiyeti", "mensubu"], APPOINTED_TO: ["tayin edildiği", "tayin edilen"],
    REMOVED_FROM: ["azledildiği", "azledilen"], TARIKAT_TAG: ["tarikatı", "bağlı kurum"],
  };
  function relRows(id) {
    const ls = adj.get(id) || [];
    if (!ls.length) return "";
    const rows = ls
      .sort((a, b) => b.w - a.w)
      .map(l => {
        const other = l.s === id ? l.t : l.s;
        const dir = l.s === id;
        const pair = REL_PROFILE[l.r];
        const lab = pair ? pair[dir ? 0 : 1] : (REL_TR[l.r] || l.r);
        return `<li><span class="re clickable" data-node="${esc(other)}">
          ${esc(nodeLabel(other))}</span>
          <span class="rl">— ${lab} · ${l.w} belge${l.inf ? " · çıkarım" : ""}</span></li>`;
      }).join("");
    return `<div class="side-block"><h3>Bağlar</h3><ul class="rel-list">${rows}</ul></div>`;
  }

  const tagRow = (title, items, cls) => !items || !items.length ? "" :
    `<div class="side-block"><h3>${title}</h3><div class="tag-row">` +
    items.map(x => `<span class="tag" ${cls ? `style="--tag-c:var(--c-${cls})"` : ""}>${esc(x)}</span>`).join("") +
    "</div></div>";

  const docChips = ids => !ids.length ? "" :
    `<div class="side-block"><h3>Belgeler <span class="cnt">(${ids.length})</span></h3>` +
    ids.map(i => `<span class="doc-chip" data-doc="${esc(i)}">${esc(docLabel(i))}</span>`).join("") +
    "</div>";

  function openPerson(pid) {
    const p = persons[pid];
    if (!p) return;
    openDrawer(`
      <div class="profile-kind">${p.makam ? "Makam" : "Kişi"}</div>
      <div class="profile-name">${esc(p.d)}</div>
      <div class="profile-meta">${p.n} anılış · ${p.ns} belge
        ${p.status.length ? `<span class="profile-flag">${esc(p.status.join(", "))}</span>` : ""}</div>
      <button class="doc-chip" data-net="${esc(pid)}">⌘ ağda göster</button>
      ${tagRow("Görevler", p.roles, "ROLE")}
      ${tagRow("Tarikat", p.tars, "TARIKAT")}
      ${tagRow("Kurumlar", p.insts, "INSTITUTION")}
      ${tagRow("Yerler", p.places, "LOCATION")}
      ${tagRow("Baba", p.fathers, "PERSON")}
      ${relRows(pid)}
      ${docChips(p.docs)}`);
  }

  function openInst(iid) {
    const x = insts[iid];
    if (!x) return;
    const flag = (src) => src === "belge-baglami" ? `<span class="profile-flag">bağlamdan</span>` : "";
    openDrawer(`
      <div class="profile-kind">Kurum · ${esc(x.tip)}</div>
      <div class="profile-name">${esc(x.d)}</div>
      <div class="profile-meta">
        ${x.place ? esc(x.place) + flag(x.psrc) + " · " : ""}
        ${x.tar ? esc(x.tar) + flag(x.tsrc) + " · " : ""}
        ${x.n} anılış</div>
      <button class="doc-chip" data-net="${esc(iid)}">⌘ ağda göster</button>
      ${x.lat ? `<button class="doc-chip" data-place="${esc(x.place)}">◉ haritada göster</button>` : ""}
      ${relRows(iid)}
      ${docChips(x.docs)}`);
  }

  function openNode(id) {
    if (id.startsWith("t:")) return gotoTarikat(id.slice(2));
    if (id[0] === "i") return openInst(id);
    return openPerson(id);
  }

  drawerBody.addEventListener("click", e => {
    const doc = e.target.closest("[data-doc]");
    if (doc) { closeDrawer(); return gotoDoc(doc.dataset.doc); }
    const nd = e.target.closest("[data-net]");
    if (nd) {
      closeDrawer(); location.hash = "#/ag";
      setTimeout(() => AtlasNet.focus(nd.dataset.net), netInited ? 60 : 300);
      return;
    }
    const pl = e.target.closest("[data-place]");
    if (pl) { closeDrawer(); return gotoPlace(pl.dataset.place); }
    const re = e.target.closest(".re.clickable");
    if (re) return openNode(re.dataset.node);
  });

  // ————— ağ araması —————
  function initNetSearch() {
    const inp = document.getElementById("net-search");
    const res = document.getElementById("net-search-results");
    inp.addEventListener("input", () => {
      const q = fold(inp.value.trim());
      if (q.length < 2) { res.classList.remove("open"); return; }
      const hits = AtlasNet.nodes
        .filter(n => fold(n.l).includes(q))
        .sort((a, b) => (b.ns || 0) - (a.ns || 0)).slice(0, 12);
      res.innerHTML = hits.map(n =>
        `<button data-id="${esc(n.id)}">${esc(n.l)}
         <span class="k">${n.k === "p" ? "kişi" : n.k === "i" ? "kurum" : "tarikat"}
         ${n.place ? "· " + esc(n.place) : ""}
         ${n.ns ? "· " + n.ns + " belge" : ""}</span></button>`).join("") ||
        '<button disabled>sonuç yok</button>';
      res.classList.add("open");
    });
    res.addEventListener("click", e => {
      const b = e.target.closest("button[data-id]");
      if (!b) return;
      res.classList.remove("open"); inp.value = "";
      AtlasNet.focus(b.dataset.id);
      openNode(b.dataset.id);
    });
  }

  // ————— yöntem sayfası —————
  document.getElementById("about").innerHTML = `
    <h2>Yöntem ve Veri</h2>
    <p>Bu atlas, <strong>Meclis-i Meşâyih Defteri 1762</strong>'nin 594 kaydından
    dil modeli destekli varlık tanıma (NER) ile çıkarılan kişi, kurum, yer ve olay
    ağını görselleştirir. Amaç, tekke-merkezli Osmanlı dinî bürokrasisinin sosyal
    coğrafyasını belge düzeyinde izlenebilir kılmaktır.</p>
    <table>
      <tr><th>Katman</th><th>Ham</th><th>Kanonik</th></tr>
      <tr><td>Kişiler</td><td>1.715 anılış</td><td>${meta.n_persons} kişi + ${meta.n_offices} makam</td></tr>
      <tr><td>Kurumlar</td><td>601 anılış</td><td>${meta.n_insts}</td></tr>
      <tr><td>Yerler</td><td>932 anılış</td><td>${meta.n_places} koordinatlı yer</td></tr>
      <tr><td>Tarihler</td><td>240 anılış</td><td>239 ISO milâdî</td></tr>
      <tr><td>Varlık / ilişki</td><td colspan="2">${meta.n_ents.toLocaleString("tr")} / ${meta.n_rels.toLocaleString("tr")}</td></tr>
    </table>
    <h3>Muhafazakâr kimlik çözümü</h3>
    <p>İki anılış ancak <em>kanıtla</em> aynı kişide birleştirilir: ortak kurum, ortak
    baba adı, aynı görev + aynı yer (İstanbul hariç) veya aynı tarikat + yer. Tek
    parçalı adlar ("Mehmed") hiçbir koşulda otomatik birleştirilmez; kanıtsız kalan
    çok belgeli bloklar tek tek okunarak karara bağlanmış, tüm kararlar yeniden
    üretilebilir biçimde kayıt altına alınmıştır. Bu tercih kişi sayısını olduğundan
    <em>yüksek</em> gösterir — yanlış birleştirme, yanlış ayırmadan daha maliyetli
    kabul edilmiştir.</p>
    <h3>Güven bayrakları</h3>
    <p>Her katmanda dört kademeli güven etiketi taşınır: <em>kesin / yüksek /
    çıkarım (belge bağlamından) / düşük</em>. Haritada bağlamdan çıkarılan konumlar
    soluk ve kesik çizgiyle, ağda çıkarımsal tarikat bağları kesik çizgiyle gösterilir.
    "Fetvâ-penâhî" gibi hürmet hitapları kişi değil <strong>makam düğümü</strong> (◆)
    olarak ayrı tutulur.</p>
    <h3>Tarihler</h3>
    <p>Hicrî tarihler tablosal (hesabî) takvimle, rûmî tarihler Jülyen +12/13 gün
    kuralıyla milâdîye çevrilmiştir; gurre/selh ve yazıyla yıllar çözülür. Yalnız yıl
    taşıyan ifadelerde hicrî varsayımı ±1-2 yıl kayma yaratabilir (işaretlidir).</p>
    <h3>Bilinen sınırlar</h3>
    <ul>
      <li>NER katmanının ölçülü hata payı (varlıklarda esnek F1 ≈ 0,90; ilişkilerde ≈ 0,76)
      bu katmana miras kalır.</li>
      <li>Farklı isim çekirdekleri ("Mehmed Sırrı" / "Mehmed Sırrî Dede") ilk sürümde
      birleştirilmez; muhtemel eşleşmeler ileride öneri olarak sunulacaktır.</li>
      <li>Belge bağlamından çıkarılan konum ve tarikat etiketleri kesin değildir,
      bayraklıdır.</li>
    </ul>
    <div class="kolofon">
      <p>Varlık tanıma: gpt-5.6-luna + şema v3.1 (594/594 kayıt) · Kimlik çözümü,
      tarih ve toponim normalizasyonu, hakemlik: Claude · Faz 0, Ağustos 2026.</p>
      <p>Harita altlığı: © OpenStreetMap katkıcıları, © CARTO.</p>
    </div>`;

  // ————— başlat —————
  document.getElementById("loading").hidden = true;
  document.getElementById("main").hidden = false;
  applyFilters();
  route();
  if (!currentDocId && location.hash.indexOf("belge/") === -1 &&
      (location.hash === "" || location.hash === "#/belgeler")) {
    renderDoc(docs[0].id);
  }
})().catch(err => {
  document.getElementById("loading").innerHTML =
    `<p style="color:#9c2f22">Veri yüklenemedi: ${err.message}</p>
     <p style="color:#877e6e;font-size:.8rem">Sayfayı bir web sunucusu üzerinden açın
     (ör. <code>python -m http.server</code>).</p>`;
});

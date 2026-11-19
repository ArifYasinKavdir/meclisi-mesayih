/* Harita — Leaflet, 342 yer, güven bayraklı işaretler */
"use strict";

const AtlasMap = (() => {
  let map, layer, hooks, places = [], insts = {};
  let tarFilter = "", showInferred = true;
  const markers = new Map();   // name -> Leaflet marker

  function init(placeData, instData, h) {
    places = placeData; insts = instData; hooks = h;
    map = L.map("map", { zoomControl: true, attributionControl: true })
      .setView([40.5, 30.5], 5);
    // OSM standart karoları: API anahtarı gerektirmez. Renkler CSS'te
    // (.basemap-tiles) soluklaştırılır ki işaretler öne çıksın.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
      maxZoom: 12, className: "basemap-tiles",
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    render();
  }

  function strong(p) { return p.conf === "kesin" || p.conf === "yuksek"; }

  function visible(p) {
    if (!showInferred && !strong(p)) return false;
    if (tarFilter) {
      return p.insts.some(iid => insts[iid] && insts[iid].tar === tarFilter);
    }
    return true;
  }

  function render() {
    layer.clearLayers();
    markers.clear();
    let shown = 0, mentions = 0;
    for (const p of places) {
      if (!visible(p)) continue;
      shown++; mentions += p.n;
      const r = 4 + Math.sqrt(p.n) * 2.1;
      const m = L.circleMarker([p.lat, p.lon], {
        radius: r,
        color: "#9c2f22",
        weight: strong(p) ? 1.5 : 1,
        dashArray: strong(p) ? null : "3 3",
        fillColor: "#9c2f22",
        fillOpacity: strong(p) ? 0.5 : 0.18,
        opacity: strong(p) ? 0.9 : 0.55,
      });
      m.bindTooltip(p.name, { direction: "top", offset: [0, -r] });
      m.on("click", () => openPopup(p, m));
      m.addTo(layer);
      markers.set(p.name, m);
    }
    const el = document.getElementById("map-stats");
    if (el) el.textContent = `${shown} yer · ${mentions} anılış` +
      (tarFilter ? ` · ${tarFilter}` : "");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openPopup(p, m) {
    const CONF = { kesin: "kesin", yuksek: "yüksek", cikarim: "belge bağlamından çıkarım", dusuk: "düşük güven" };
    const instHtml = p.insts.slice(0, 8).map(iid => {
      const x = insts[iid];
      return `<a href="javascript:void 0" data-inst="${iid}">${esc(x.d)}</a>`;
    }).join("");
    const docHtml = p.docs.slice(0, 10).map(d =>
      `<span class="doc-chip" data-doc="${esc(d)}">${esc(d.replace("_section", " §"))}</span>`).join("") +
      (p.docs.length > 10 ? `<span class="popup-modern">… toplam ${p.docs.length} belge</span>` : "");
    const html = `
      <div class="popup-title">${esc(p.name)}</div>
      ${p.modern && p.modern !== p.name ? `<div class="popup-modern">bugün: ${esc(p.modern)}</div>` : ""}
      <div class="popup-conf">konum: ${CONF[p.conf] || p.conf} · ${p.n} anılış</div>
      ${instHtml ? `<div class="popup-list"><strong>Kurumlar</strong>${instHtml}</div>` : ""}
      ${docHtml ? `<div class="popup-list"><strong>Belgeler</strong><br>${docHtml}</div>` : ""}`;
    const pop = L.popup({ maxWidth: 300 }).setLatLng(m.getLatLng()).setContent(html);
    pop.openOn(map);
    setTimeout(() => {
      document.querySelectorAll(".leaflet-popup [data-inst]").forEach(a =>
        a.addEventListener("click", () => hooks.openInst(a.dataset.inst)));
      document.querySelectorAll(".leaflet-popup [data-doc]").forEach(a =>
        a.addEventListener("click", () => hooks.openDoc(a.dataset.doc)));
    }, 0);
  }

  function focusPlace(name) {
    const m = markers.get(name);
    const p = places.find(x => x.name === name);
    if (!p) return;
    map.setView([p.lat, p.lon], Math.max(map.getZoom(), 8));
    if (m) openPopup(p, m);
  }

  function setTarikat(t) { tarFilter = t; render(); }
  function setInferred(v) { showInferred = v; render(); }
  function invalidate() { if (map) setTimeout(() => map.invalidateSize(), 60); }

  return { init, focusPlace, setTarikat, setInferred, invalidate,
           get ready() { return !!map; } };
})();

/* Prozopografik ağ — canvas kuvvet-yönelimli yerleşim (bağımlılıksız) */
"use strict";

const AtlasNet = (() => {
  const COL = {
    p: "#2f6b9a", i: "#7a4fa0", t: "#a34d75",
    edgeFam: "#b9553f", edgeAff: "#9aa7b5", edgeTar: "#c58ca9",
    label: "#26221c", halo: "#f8f5ef",
  };
  const FAMILY = new Set(["CHILD_OF", "SIBLING_OF", "KIN_OF", "REPLACED_BY"]);

  let canvas, ctx, tipEl, hooks;
  let allNodes = [], allLinks = [];
  let nodes = [], links = [];          // aktif altküme
  let byId = new Map(), adj = new Map();
  let tf = { x: 0, y: 0, k: 1 };
  let alpha = 0, running = false, raf = 0;
  let dragNode = null, panFrom = null, hoverNode = null, selected = null;
  let mode = "core", tarFilter = "", focusId = null;
  let dpr = 1, W = 0, H = 0;

  function init(net, h) {
    hooks = h;
    canvas = document.getElementById("net-canvas");
    ctx = canvas.getContext("2d");
    tipEl = document.createElement("div");
    tipEl.id = "net-tip";
    canvas.parentElement.appendChild(tipEl);

    allNodes = net.nodes.map(n => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
    allLinks = net.links;
    allNodes.forEach(n => byId.set(n.id, n));
    allLinks.forEach(l => {
      if (!adj.has(l.s)) adj.set(l.s, []);
      if (!adj.has(l.t)) adj.set(l.t, []);
      adj.get(l.s).push(l);
      adj.get(l.t).push(l);
    });

    new ResizeObserver(resize).observe(canvas.parentElement);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    resize();
    rebuild();
  }

  function degreeIn(set, id) {
    return (adj.get(id) || []).filter(l => set.has(l.s) && set.has(l.t)).length;
  }

  function subset() {
    let ids = new Set();
    if (focusId && byId.has(focusId)) {
      // ego ağı: 2 derinlik
      ids.add(focusId);
      let ring = [focusId];
      for (let d = 0; d < 2; d++) {
        const next = [];
        for (const id of ring)
          for (const l of adj.get(id) || []) {
            for (const o of [l.s, l.t]) if (!ids.has(o)) { ids.add(o); next.push(o); }
          }
        ring = next;
      }
    } else if (tarFilter) {
      const tid = "t:" + tarFilter;
      ids.add(tid);
      for (const l of adj.get(tid) || []) { ids.add(l.s); ids.add(l.t); }
      // komşuların aile bağlarını da al
      for (const id of [...ids])
        for (const l of adj.get(id) || [])
          if (FAMILY.has(l.r)) { ids.add(l.s); ids.add(l.t); }
    } else if (mode === "all") {
      allNodes.forEach(n => ids.add(n.id));
    } else {
      // çekirdek: çok belgeli kişiler + kurumlar + tarikatlar
      for (const n of allNodes)
        if (n.k !== "p" || (n.ns || 1) >= 2) ids.add(n.id);
      // izole kalanları at
      for (const id of [...ids]) if (!degreeIn(ids, id)) ids.delete(id);
    }
    return ids;
  }

  function rebuild() {
    const ids = subset();
    nodes = allNodes.filter(n => ids.has(n.id));
    links = allLinks.filter(l => ids.has(l.s) && ids.has(l.t));
    const R = Math.sqrt(nodes.length) * 26;
    nodes.forEach((n, i) => {
      if (!n.placed) {
        const a = i * 2.3999632; // altın açı
        const r = R * Math.sqrt(i / Math.max(1, nodes.length));
        n.x = Math.cos(a) * r; n.y = Math.sin(a) * r;
        n.placed = true;
      }
      n.r = 3 + Math.sqrt(n.ns || 1) * 2.2;
      if (n.k === "t") n.r = 7 + Math.sqrt(n.ns || 4);
    });
    tf = { x: W / 2, y: H / 2, k: Math.max(.25, Math.min(1, 340 / (R + 60))) };
    if (focusId && byId.has(focusId)) selected = byId.get(focusId);
    const stats = document.getElementById("net-stats");
    if (stats) stats.textContent =
      `${nodes.length} düğüm · ${links.length} bağ` +
      (mode === "core" && !focusId && !tarFilter ? " (tek belgelik kişiler gizli)" : "");
    heat(1);
  }

  function heat(a) { alpha = a; if (!running) { running = true; loop(); } }

  function loop() {
    step();
    draw();
    alpha *= 0.985;
    if (alpha > 0.004 || dragNode) raf = requestAnimationFrame(loop);
    else running = false;
  }

  function step() {
    const cell = 70, grid = new Map();
    for (const n of nodes) {
      const key = ((n.x / cell) | 0) + ":" + ((n.y / cell) | 0);
      (grid.get(key) || grid.set(key, []).get(key)).push(n);
    }
    const rep = 1300 * alpha;
    for (const n of nodes) {
      const gx = (n.x / cell) | 0, gy = (n.y / cell) | 0;
      for (let ix = gx - 1; ix <= gx + 1; ix++)
        for (let iy = gy - 1; iy <= gy + 1; iy++) {
          const bucket = grid.get(ix + ":" + iy);
          if (!bucket) continue;
          for (const m of bucket) {
            if (m === n) continue;
            let dx = n.x - m.x, dy = n.y - m.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
            if (d2 > cell * cell * 2.6) continue;
            const f = rep / d2;
            n.vx += dx * f; n.vy += dy * f;
          }
        }
      // hafif merkez çekimi
      n.vx -= n.x * 0.0016 * alpha;
      n.vy -= n.y * 0.0016 * alpha;
    }
    const spr = 0.06 * alpha;
    for (const l of links) {
      const a = byId.get(l.s), b = byId.get(l.t);
      if (!a || !b) continue;
      const rest = a.k === "t" || b.k === "t" ? 90 : FAMILY.has(l.r) ? 46 : 62;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - rest) / d * spr;
      a.vx += dx * f; a.vy += dy * f;
      b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const n of nodes) {
      if (n === dragNode) { n.vx = n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tf.x, tf.y);
    ctx.scale(tf.k, tf.k);

    const selSet = selected ? neighborIds(selected.id) : null;
    ctx.lineWidth = 1 / tf.k;
    for (const l of links) {
      const a = byId.get(l.s), b = byId.get(l.t);
      const dim = selSet && !(selSet.has(l.s) && selSet.has(l.t));
      ctx.globalAlpha = dim ? 0.06 : Math.min(0.85, 0.28 + l.w * 0.12);
      ctx.strokeStyle = FAMILY.has(l.r) ? COL.edgeFam :
        (l.r === "TARIKAT_TAG" || l.t.startsWith?.("t:") || byId.get(l.t)?.k === "t")
          ? COL.edgeTar : COL.edgeAff;
      ctx.setLineDash(l.inf ? [4 / tf.k, 3 / tf.k] : []);
      ctx.lineWidth = (FAMILY.has(l.r) ? 1.6 : 1) / tf.k * (1 + Math.min(2, l.w - 1) * .4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const n of nodes) {
      const dim = selSet && !selSet.has(n.id);
      ctx.globalAlpha = dim ? 0.15 : 1;
      ctx.fillStyle = COL[n.k];
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      if (n === selected || n === hoverNode) {
        ctx.strokeStyle = "#26221c"; ctx.lineWidth = 1.6 / tf.k;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 1.5 / tf.k, 0, 7); ctx.stroke();
      }
    }

    const showLabels = tf.k > 0.9;
    ctx.textAlign = "center";
    ctx.font = `${11 / tf.k}px "IBM Plex Sans", sans-serif`;
    for (const n of nodes) {
      const want = n === selected || n === hoverNode ||
        (showLabels && n.r >= 6) || (selSet && selSet.has(n.id) && tf.k > 0.55);
      if (!want) continue;
      ctx.globalAlpha = 1;
      const y = n.y + n.r + 11 / tf.k;
      ctx.strokeStyle = COL.halo; ctx.lineWidth = 3 / tf.k;
      ctx.strokeText(n.l, n.x, y);
      ctx.fillStyle = COL.label;
      ctx.fillText(n.l, n.x, y);
    }
    ctx.globalAlpha = 1;
  }

  function neighborIds(id) {
    const s = new Set([id]);
    for (const l of adj.get(id) || []) { s.add(l.s); s.add(l.t); }
    return s;
  }

  function pick(mx, my) {
    const x = (mx - tf.x) / tf.k, y = (my - tf.y) / tf.k;
    let best = null, bd = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + 5 / tf.k && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  function onDown(e) {
    canvas.setPointerCapture(e.pointerId);
    const n = pick(e.offsetX, e.offsetY);
    if (n) { dragNode = n; n.moved = false; heat(Math.max(alpha, 0.12)); }
    else panFrom = { x: e.offsetX - tf.x, y: e.offsetY - tf.y };
    canvas.classList.add("dragging");
  }
  function onMove(e) {
    if (dragNode) {
      dragNode.x = (e.offsetX - tf.x) / tf.k;
      dragNode.y = (e.offsetY - tf.y) / tf.k;
      dragNode.moved = true;
      heat(Math.max(alpha, 0.08));
    } else if (panFrom) {
      tf.x = e.offsetX - panFrom.x; tf.y = e.offsetY - panFrom.y;
      if (!running) draw();
    } else {
      const n = pick(e.offsetX, e.offsetY);
      if (n !== hoverNode) {
        hoverNode = n;
        canvas.style.cursor = n ? "pointer" : "grab";
        if (n) {
          tipEl.style.display = "block";
          tipEl.style.left = e.offsetX + "px";
          tipEl.style.top = e.offsetY + "px";
          tipEl.textContent = n.l + (n.ns ? ` · ${n.ns} belge` : "");
        } else tipEl.style.display = "none";
        if (!running) draw();
      } else if (n) {
        tipEl.style.left = e.offsetX + "px";
        tipEl.style.top = e.offsetY + "px";
      }
    }
  }
  function onUp(e) {
    canvas.classList.remove("dragging");
    if (dragNode) {
      if (!dragNode.moved) {           // tıklama
        selected = dragNode;
        draw();
        hooks.openNode(dragNode.id);
      }
      dragNode = null; heat(Math.max(alpha, 0.05));
    }
    panFrom = null;
  }
  function onWheel(e) {
    e.preventDefault();
    const f = Math.pow(1.0015, -e.deltaY);
    const nx = e.offsetX - (e.offsetX - tf.x) * f;
    const ny = e.offsetY - (e.offsetY - tf.y) * f;
    tf.k *= f; tf.x = nx; tf.y = ny;
    if (!running) draw();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    if (nodes.length && !running) draw();
  }

  function focus(id) {
    focusId = id; tarFilter = "";
    const sel = document.getElementById("net-tarikat");
    if (sel) sel.value = "";
    rebuild();
  }
  function setMode(m) { mode = m; focusId = null; selected = null; rebuild(); }
  function setTarikat(t) { tarFilter = t; focusId = null; selected = null; rebuild(); }
  function clearFocus() { focusId = null; selected = null; rebuild(); }
  function redraw() { resize(); if (nodes.length) { heat(0.03); } }

  return { init, focus, setMode, setTarikat, clearFocus, redraw,
           get nodes() { return allNodes; } };
})();

export function createInk({ getPage, getViewport, isBusy, onChange }) {
  const layer = document.getElementById('ink');
  const toggle = document.getElementById('pen-toggle');
  const color = document.getElementById('pen-color');
  const width = document.getElementById('pen-width');
  const undo = document.getElementById('ink-undo');
  const redo = document.getElementById('ink-redo');
  let strokes = [], removed = [], active = null, enabled = false;
  const svgNS = 'http://www.w3.org/2000/svg';
  function render() {
    const v = getViewport();
    layer.replaceChildren();
    if (!v) return;
    layer.setAttribute('viewBox', `0 0 ${v.width} ${v.height}`);
    for (const s of [...strokes, ...(active ? [active] : [])].filter(s => s.page === getPage())) {
      const el = document.createElementNS(svgNS, 'path');
      const points = s.points.map(p => [p.x * v.width, p.y * v.height]);
      if (points.length === 1) points.push([points[0][0] + .01, points[0][1]]);
      el.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' '));
      el.setAttribute('stroke', s.color); el.setAttribute('stroke-width', s.width * v.width);
      el.setAttribute('fill', 'none'); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      layer.append(el);
    }
  }
  function sync() {
    const blocked = isBusy() || !!active;
    toggle.disabled = blocked || !getViewport();
    color.disabled = blocked; width.disabled = blocked;
    undo.disabled = blocked || !strokes.some(s => s.page === getPage());
    redo.disabled = blocked || !removed.some(s => s.page === getPage());
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? '✎ 畫筆已開啟' : '✎ 使用畫筆';
    layer.classList.toggle('drawing', enabled && !isBusy());
    document.getElementById('pen-hint').textContent = enabled ? '在文件上拖曳即可畫記；關閉畫筆可移動簽名。' : '開啟畫筆可打勾、畫線或手寫。';
  }
  function changed() { render(); sync(); onChange(); }
  toggle.onclick = () => { enabled = !enabled; sync(); };
  width.oninput = () => { document.getElementById('pen-width-value').value = width.value; };
  undo.onclick = () => { const i = strokes.findLastIndex(s => s.page === getPage()); if (i >= 0) removed.push(...strokes.splice(i, 1)); changed(); };
  redo.onclick = () => { const i = removed.findLastIndex(s => s.page === getPage()); if (i >= 0) strokes.push(...removed.splice(i, 1)); changed(); };
  function point(e) {
    const r = layer.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  }
  layer.onpointerdown = e => {
    if (!enabled || isBusy() || active || e.button !== 0) return;
    e.preventDefault();layer.setPointerCapture(e.pointerId);
    active = { page: getPage(), color: color.value, width: Number(width.value) / getViewport().width, points: [point(e)], pointerId: e.pointerId };
    changed();
  };
  layer.onpointermove = e => {
    if (!active || e.pointerId !== active.pointerId) return;
    e.preventDefault();
    for (const event of (e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e])) active.points.push(point(event));
    render();
  };
  function finish(e, cancelled) {
    if (!active || e.pointerId !== active.pointerId) return;
    if (!cancelled) { active.points.push(point(e)); strokes.push(active); removed = removed.filter(s => s.page !== active.page); }
    active = null; changed();
  }
  layer.onpointerup = e => finish(e, false);
  layer.onpointercancel = e => finish(e, true);
  layer.onlostpointercapture = e => finish(e, true);
  return {
    sync, render,
    reset() { strokes = []; removed = []; active = null; enabled = false; render(); sync(); },
    get strokes() { return strokes; }, get active() { return !!active; },
  };
}

export async function drawInkIntoPDF(doc, strokes, getViewport, lib) {
  for (const s of strokes) {
    const v = await getViewport(s.page), page = doc.getPage(s.page - 1);
    const toPdf = p => { const [x, y] = v.convertToPdfPoint(p.x * v.width, p.y * v.height); return { x, y }; };
    const a = v.convertToPdfPoint(0, 0), b = v.convertToPdfPoint(s.width * v.width, 0);
    const thickness = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const color = lib.rgb(...[1, 3, 5].map(i => parseInt(s.color.slice(i, i + 2), 16) / 255));
    for (let i = 1; i < s.points.length; i++) {
      page.drawLine({ start: toPdf(s.points[i - 1]), end: toPdf(s.points[i]), thickness, color, lineCap: lib.LineCapStyle.Round });
    }
    // Explicit endpoint disks also preserve single-click dots.
    for (const p of [s.points[0], s.points.at(-1)]) page.drawCircle({ ...toPdf(p), size: thickness / 2, color });
  }
}

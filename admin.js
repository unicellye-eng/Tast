(() => {
  const cats = (window.CATEGORIES || []).map(c => ({ id: c.id, name: c.name }));
  const ringtones = (window.RINGTONES || []).map(r => ({ ...r, rank: { ...(r.rank || {}) } }));

  const $ = (id) => document.getElementById(id);
  const search = $("search");
  const catSelect = $("catSelect");
  const tbody = $("tbody");
  const downloadBtn = $("downloadBtn");
  const renumberBtn = $("renumberBtn");

  function ensurePaths(r) {
    const isUrl = (v) => /^https?:\/\//i.test(v);
    if (r.audio && !isUrl(r.audio) && !r.audio.includes('/')) r.audio = 'ringtones/audio/' + r.audio;
    if (r.image && r.image !== 'AUTO' && !isUrl(r.image) && !r.image.includes('/')) r.image = 'ringtones/images/' + r.image;
  }

  // populate category selector (by NAME because your ranks use Arabic names)
  for (const c of cats) {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  }

  function render() {
    const q = (search.value || '').trim();
    const cname = catSelect.value;
    const rows = ringtones
      .filter(r => !q || String(r.title || '').includes(q) || String(r.id || '').includes(q))
      .slice(0, 500); // prevent heavy rendering

    tbody.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');

      const tdId = document.createElement('td');
      tdId.textContent = r.id || '';
      tr.appendChild(tdId);

      const tdTitle = document.createElement('td');
      const it = document.createElement('input');
      it.value = r.title || '';
      it.style.width = '100%';
      it.oninput = () => { r.title = it.value; };
      tdTitle.appendChild(it);
      tr.appendChild(tdTitle);

      const tdAudio = document.createElement('td');
      const ia = document.createElement('input');
      ia.value = r.audio || '';
      ia.style.width = '100%';
      ia.placeholder = 'ringtones/audio/file.mp3';
      ia.oninput = () => { r.audio = ia.value; };
      tdAudio.appendChild(ia);
      tr.appendChild(tdAudio);

      const tdImg = document.createElement('td');
      const ii = document.createElement('input');
      ii.value = r.image || '';
      ii.style.width = '100%';
      ii.placeholder = 'ringtones/images/file.webp';
      ii.oninput = () => { r.image = ii.value; };
      tdImg.appendChild(ii);
      tr.appendChild(tdImg);

      const tdRank = document.createElement('td');
      const ir = document.createElement('input');
      ir.type = 'number';
      ir.min = '1';
      ir.value = (r.rank && r.rank[cname]) ? r.rank[cname] : '';
      ir.style.width = '100%';
      ir.oninput = () => {
        const v = ir.value.trim();
        if (!r.rank) r.rank = {};
        if (!v) delete r.rank[cname];
        else r.rank[cname] = Number(v);
      };
      tdRank.appendChild(ir);
      tr.appendChild(tdRank);

      tbody.appendChild(tr);
    }
  }

  function renumberCategory() {
    const cname = catSelect.value;
    const items = ringtones
      .filter(r => r.rank && r.rank[cname] != null && r.rank[cname] !== '')
      .map(r => ({ r, n: Number(r.rank[cname]) }))
      .filter(x => !Number.isNaN(x.n))
      .sort((a,b) => a.n - b.n || String(a.r.title||'').localeCompare(String(b.r.title||'')));

    // assign 1..N
    for (let i=0; i<items.length; i++) {
      items[i].r.rank[cname] = i+1;
    }
    render();
    alert('تمت إعادة ترقيم قسم: ' + cname);
  }

  function downloadDataJs() {
    // normalize paths
    ringtones.forEach(ensurePaths);

    // keep original constants if present
    const categories = window.CATEGORIES || [];
    const contact = window.CONTACT || null;
    const carriers = window.CARRIERS || null;

    const pretty = (obj) => JSON.stringify(obj, null, 2);

    let out = '';
    out += 'window.CATEGORIES = ' + pretty(categories) + ';\n\n';
    if (carriers) out += 'window.CARRIERS = ' + pretty(carriers) + ';\n\n';
    if (contact) out += 'window.CONTACT = ' + pretty(contact) + ';\n\n';
    out += 'window.RINGTONES = ' + pretty(ringtones) + ';\n';

    const blob = new Blob([out], { type: 'application/javascript;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  search.addEventListener('input', render);
  catSelect.addEventListener('change', render);
  renumberBtn.addEventListener('click', renumberCategory);
  downloadBtn.addEventListener('click', downloadDataJs);

  render();
})();
/* Folio — a private document library that lives in your browser. */
(function () {
  'use strict';

  const DB_NAME = 'folio';
  const DB_VERSION = 1;
  const SETTINGS_KEY = 'folio:settings';
  const RECENT_DAYS = 14;

  const COVER_PALETTES = [
    { bg: '#17332c', ink: '#eadfc4', line: 'rgba(234,223,196,.34)', accent: '#d8a25d' },
    { bg: '#4a2222', ink: '#f0d8c6', line: 'rgba(240,216,198,.3)', accent: '#d9a66b' },
    { bg: '#1c2c47', ink: '#e4d6b6', line: 'rgba(228,214,182,.3)', accent: '#c9a15b' },
    { bg: '#38213a', ink: '#efd2d4', line: 'rgba(239,210,212,.3)', accent: '#d9a0a8' },
    { bg: '#242220', ink: '#ede5d1', line: 'rgba(237,229,209,.28)', accent: '#c6a97c' },
    { bg: '#12403d', ink: '#d3e6d9', line: 'rgba(211,230,217,.3)', accent: '#8fc7ae' },
    { bg: '#5a3a1b', ink: '#f3e3c8', line: 'rgba(243,227,200,.3)', accent: '#e0b06c' },
    { bg: '#1f2a22', ink: '#e5e2cf', line: 'rgba(229,226,207,.3)', accent: '#a9bc8e' }
  ];

  const COLLECTION_COLORS = ['#9a641f', '#5c7a52', '#a2543b', '#4c5e8a', '#7a4a6b', '#5d6b6b'];

  const EXT_KINDS = {
    pdf: 'pdf',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image',
    bmp: 'image', ico: 'image', tif: 'image', tiff: 'image', svg: 'image', heic: 'image', heif: 'image',
    txt: 'text', md: 'text', markdown: 'text', mdx: 'text', json: 'text', jsonc: 'text',
    xml: 'text', yaml: 'text', yml: 'text', toml: 'text', ini: 'text', cfg: 'text', log: 'text',
    html: 'text', htm: 'text', xhtml: 'text', css: 'text', scss: 'text', less: 'text',
    js: 'text', mjs: 'text', cjs: 'text', jsx: 'text', ts: 'text', tsx: 'text',
    py: 'text', rb: 'text', php: 'text', java: 'text', kt: 'text', swift: 'text',
    go: 'text', rs: 'text', c: 'text', h: 'text', cpp: 'text', hpp: 'text', cs: 'text',
    sh: 'text', bash: 'text', zsh: 'text', ps1: 'text', sql: 'text', graphql: 'text',
    vue: 'text', svelte: 'text', r: 'text', lua: 'text', pl: 'text', dart: 'text',
    scala: 'text', env: 'text',
    doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc', pages: 'doc', wpd: 'doc',
    csv: 'sheet', tsv: 'sheet', xls: 'sheet', xlsx: 'sheet', ods: 'sheet', numbers: 'sheet',
    ppt: 'slides', pptx: 'slides', odp: 'slides', key: 'slides',
    epub: 'ebook', mobi: 'ebook', azw: 'ebook', azw3: 'ebook', fb2: 'ebook', cbz: 'ebook', cbr: 'ebook',
    mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
    flac: 'audio', opus: 'audio', weba: 'audio', mid: 'audio', midi: 'audio',
    mp4: 'video', m4v: 'video', webm: 'video', ogv: 'video', mov: 'video',
    mkv: 'video', avi: 'video', wmv: 'video', flv: 'video',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
    tgz: 'archive', bz2: 'archive', xz: 'archive', zst: 'archive', iso: 'archive', dmg: 'archive'
  };

  const KIND_NAMES = {
    pdf: 'PDF document', image: 'Image', text: 'Text file', doc: 'Document',
    sheet: 'Spreadsheet', slides: 'Presentation', ebook: 'E-book', audio: 'Audio',
    video: 'Video', archive: 'Archive', other: 'File'
  };

  const KIND_NOUNS = {
    pdf: ['PDF', 'PDFs'],
    image: ['image', 'images'],
    text: ['text file', 'text files'],
    doc: ['document', 'documents'],
    sheet: ['spreadsheet', 'spreadsheets'],
    slides: ['presentation', 'presentations'],
    ebook: ['e-book', 'e-books'],
    audio: ['audio file', 'audio files'],
    video: ['video', 'videos'],
    archive: ['archive', 'archives'],
    other: ['file', 'files']
  };

  const PROSE_EXTS = new Set(['txt', 'md', 'markdown', 'mdx', 'log']);

  const state = {
    docs: [],
    collections: [],
    view: 'all',
    type: 'all',
    query: '',
    menuDocId: null,
    menuCollectionId: null,
    readerDocId: null,
    readerUrl: null,
    busy: false,
    color: COLLECTION_COLORS[0]
  };

  const settings = { theme: 'light', layout: 'grid', sort: 'recent' };
  const els = {};

  /* ------------------------------------------------------------
     Helpers
     ------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';

  function uid() {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      try { return crypto.randomUUID(); } catch (e) { /* fall through */ }
    }
    return 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    const units = ['KB', 'MB', 'GB', 'TB'];
    let n = bytes / 1024;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (n >= 10 ? Math.round(n) : n.toFixed(1).replace(/\.0$/, '')) + ' ' + units[i];
  }

  const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const shortDateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  const formatDate = (ts) => (ts ? dateFmt.format(new Date(ts)) : '—');
  const formatShortDate = (ts) => (ts ? shortDateFmt.format(new Date(ts)) : '—');

  function readBlobText(blob) {
    if (blob && typeof blob.text === 'function') return blob.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsText(blob);
    });
  }

  function snippetLines(text, ext) {
    let value = String(text || '').replace(/\r\n?/g, '\n');
    if (['html', 'htm', 'xhtml', 'xml', 'svg'].indexOf(ext) !== -1) {
      value = value.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
    }
    if (['md', 'markdown', 'mdx'].indexOf(ext) !== -1) {
      value = value
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s{0,3}>\s?/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/[*_~]/g, '');
    }
    value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');

    const lines = [];
    const raw = value.split('\n');
    for (let i = 0; i < raw.length && lines.length < 12; i++) {
      let line = raw[i].replace(/\s+/g, ' ').trim();
      while (line.length > 68 && lines.length < 12) {
        let cut = line.lastIndexOf(' ', 68);
        if (cut < 24) cut = 68;
        lines.push(line.slice(0, cut).trim());
        line = line.slice(cut).trim();
      }
      if (line && lines.length < 12) lines.push(line.length > 68 ? line.slice(0, 67) + '…' : line);
    }
    return lines;
  }

  function titleFromName(name) {
    const raw = String(name || '').trim();
    const base = raw.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    return base || raw || 'Untitled document';
  }

  function extFromName(name) {
    const match = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    return match ? match[1] : '';
  }

  function kindFromMime(mime) {
    const type = String(mime || '').toLowerCase();
    if (!type) return 'other';
    if (type === 'application/pdf') return 'pdf';
    if (type.indexOf('image/') === 0) return 'image';
    if (type.indexOf('audio/') === 0) return 'audio';
    if (type.indexOf('video/') === 0) return 'video';
    if (type.indexOf('text/') === 0) return type.indexOf('csv') !== -1 ? 'sheet' : 'text';
    if (/word|wordprocessingml|opendocument\.text|rtf/.test(type)) return 'doc';
    if (/sheet|excel|spreadsheetml|opendocument\.spreadsheet/.test(type)) return 'sheet';
    if (/presentation|powerpoint|opendocument\.presentation/.test(type)) return 'slides';
    if (/epub/.test(type)) return 'ebook';
    if (/json|xml|javascript|ecmascript|markdown|yaml|x-sh|sql/.test(type)) return 'text';
    if (/zip|rar|7z|tar|gzip|x-compressed/.test(type)) return 'archive';
    return 'other';
  }

  function kindFromFile(file, ext) {
    return EXT_KINDS[ext] || kindFromMime(file && file.type);
  }

  function extOf(doc) {
    return (doc && doc.ext) || extFromName(doc && doc.name);
  }

  function kindOf(doc) {
    if (!doc) return 'other';
    if (doc.kind) return doc.kind;
    return EXT_KINDS[extOf(doc)] || kindFromMime(doc.type) || 'other';
  }

  function typeLabel(doc) {
    const ext = extOf(doc);
    const kind = kindOf(doc);
    if (kind === 'pdf') return 'PDF';
    if (ext) return ext.toUpperCase();
    if (doc && doc.type) {
      const sub = String(doc.type).split('/')[1];
      if (sub) return sub.replace(/^x-/, '').split('+')[0].toUpperCase().slice(0, 7);
    }
    return (KIND_NAMES[kind] || 'File').split(' ')[0].toUpperCase();
  }

  function kindName(kind) {
    return KIND_NAMES[kind] || KIND_NAMES.other;
  }

  function kindNoun(kind, plural) {
    const pair = KIND_NOUNS[kind] || KIND_NOUNS.other;
    return plural ? pair[1] : pair[0];
  }

  function describeDoc(doc) {
    const kind = kindOf(doc);
    const ext = extOf(doc).toUpperCase();
    if (kind === 'pdf') {
      return 'PDF' + (doc.numPages ? ' · ' + doc.numPages + ' page' + (doc.numPages === 1 ? '' : 's') : '');
    }
    return (ext ? ext + ' ' : '') + (KIND_NAMES[kind] || 'File').toLowerCase();
  }

  function isTextPreviewable(doc) {
    const kind = kindOf(doc);
    if (kind === 'text') return true;
    if (kind === 'sheet') {
      const ext = extOf(doc);
      return ext === 'csv' || ext === 'tsv';
    }
    return false;
  }

  function canOpenInNewTab(doc) {
    const kind = kindOf(doc);
    if (kind === 'pdf') return true;
    if (kind === 'image') return extOf(doc) !== 'svg';
    return kind === 'audio' || kind === 'video';
  }

  const paletteFor = (doc) => COVER_PALETTES[(doc.colorSeed != null ? doc.colorSeed : hash(doc.title + doc.id)) % COVER_PALETTES.length];
  const collectionOf = (doc) => (doc.collectionId ? state.collections.find((c) => c.id === doc.collectionId) : null);
  const isRecent = (doc) => Date.now() - doc.addedAt < RECENT_DAYS * 864e5;
  const visibleDocs = () => filterAndSort();

  /* ------------------------------------------------------------
     Settings
     ------------------------------------------------------------ */
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (saved.theme === 'dark' || saved.theme === 'light') settings.theme = saved.theme;
      if (saved.layout === 'grid' || saved.layout === 'list') settings.layout = saved.layout;
      if (['recent', 'title', 'size', 'pages'].includes(saved.sort)) settings.sort = saved.sort;
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    els.themeIcon.innerHTML = icon(settings.theme === 'dark' ? 'sun' : 'moon');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#0e1817' : '#edeee6');
  }

  function applyLayout() {
    els.grid.classList.toggle('is-list', settings.layout === 'list');
    $$('.seg').forEach((btn) => {
      const active = btn.dataset.layout === settings.layout;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /* ------------------------------------------------------------
     IndexedDB
     ------------------------------------------------------------ */
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB is unavailable')); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open storage'));
      req.onblocked = () => reject(new Error('Storage is blocked by another tab'));
    });
    return dbPromise;
  }

  function dbReq(storeName, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(storeName, mode); } catch (e) { reject(e); return; }
      let req;
      try { req = fn(tx.objectStore(storeName)); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error || new Error('Storage error'));
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
    }));
  }

  const dbGetAll = (store) => dbReq(store, 'readonly', (s) => s.getAll());
  const dbGet = (store, key) => dbReq(store, 'readonly', (s) => s.get(key));
  const dbPut = (store, value) => dbReq(store, 'readwrite', (s) => s.put(value));
  const dbDelete = (store, key) => dbReq(store, 'readwrite', (s) => s.delete(key));

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  async function init() {
    cacheEls();
    loadSettings();
    applyTheme();
    applyLayout();
    bindEvents();
    els.sortSelect.value = settings.sort;
    els.typeSelect.value = state.type;
    let hasSavedSettings = false;
    try { hasSavedSettings = !!localStorage.getItem(SETTINGS_KEY); } catch (e) { /* ignore */ }
    if (!hasSavedSettings && matchMedia('(prefers-color-scheme: dark)').matches) {
      settings.theme = 'dark';
      applyTheme();
    }

    try {
      await openDB();
      const [docs, collections] = await Promise.all([dbGetAll('docs'), dbGetAll('collections')]);
      state.docs = docs || [];
      state.collections = collections || [];
      if (state.view.indexOf('collection:') === 0 && !state.collections.some((c) => c.id === state.view.slice(11))) {
        state.view = 'all';
      }
    } catch (err) {
      console.error(err);
      showFatal(err);
      return;
    }

    render();
    updateStorage();
  }

  function cacheEls() {
    const ids = [
      'sidebar', 'scrim', 'menuBtn', 'search', 'searchClear', 'searchWrap', 'themeBtn', 'themeIcon',
      'addBtn', 'addBtnTop', 'newCollectionBtn', 'collectionList', 'storageText', 'storageBar',
      'typeSelect', 'sortSelect', 'viewTitle', 'viewMeta', 'grid', 'empty', 'fileInput', 'dropOverlay',
      'reader', 'readerTitle', 'readerMeta', 'readerStar', 'readerDownload', 'readerNewTab',
      'readerClose', 'readerFrame', 'readerAlt', 'menu', 'nameDialog', 'nameForm', 'nameTitle', 'nameHelp',
      'nameInput', 'nameConfirm', 'nameCancel', 'colorRow', 'swatchRow', 'confirmDialog',
      'confirmTitle', 'confirmBody', 'confirmOk', 'confirmCancel', 'moveDialog', 'moveList',
      'moveCancel', 'toasts'
    ];
    ids.forEach((id) => { els[id] = document.getElementById(id); });
  }

  function showFatal(err) {
    els.grid.innerHTML = '';
    els.grid.hidden = true;
    els.empty.hidden = false;
    els.empty.className = 'empty';
    els.empty.innerHTML =
      '<h2>Storage is unavailable</h2>' +
      '<p>Folio needs IndexedDB to keep your documents. This usually happens in private windows or when site data is blocked. Open the app in a normal window and reload.</p>' +
      '<div class="empty-actions"><button class="btn btn-ghost" data-act="reload">Reload</button></div>';
    els.viewTitle.textContent = 'Library unavailable';
    els.viewMeta.textContent = err && err.message ? err.message : '';
  }

  /* ------------------------------------------------------------
     Filtering and sorting
     ------------------------------------------------------------ */
  function filterAndSort() {
    let list = state.docs.slice();

    if (state.view === 'favorites') list = list.filter((d) => d.favorite);
    else if (state.view === 'recent') list = list.filter(isRecent);
    else if (state.view.indexOf('collection:') === 0) {
      const id = state.view.slice(11);
      list = list.filter((d) => d.collectionId === id);
    }

    if (state.type !== 'all') list = list.filter((d) => kindOf(d) === state.type);

    const q = state.query.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const haystack = (d.title || '') + ' ' + (d.name || '') + ' ' + typeLabel(d) + ' ' + kindName(kindOf(d));
        return haystack.toLowerCase().indexOf(q) !== -1;
      });
    }

    switch (settings.sort) {
      case 'title': list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })); break;
      case 'size': list.sort((a, b) => b.size - a.size); break;
      case 'pages': list.sort((a, b) => (b.numPages || 0) - (a.numPages || 0)); break;
      default: list.sort((a, b) => b.addedAt - a.addedAt);
    }
    return list;
  }

  /* ------------------------------------------------------------
     Rendering
     ------------------------------------------------------------ */
  function render() {
    renderSidebar();
    renderContent();
  }

  function renderSidebar() {
    const counts = {
      all: state.docs.length,
      recent: state.docs.filter(isRecent).length,
      favorites: state.docs.filter((d) => d.favorite).length
    };

    $$('.nav-item[data-view]').forEach((btn) => {
      const v = btn.dataset.view;
      const active = state.view === v;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
      const count = btn.querySelector('[data-count]');
      if (count) count.textContent = counts[v] != null ? counts[v] : 0;
    });

    els.collectionList.innerHTML = state.collections.map((c) => {
      const n = state.docs.filter((d) => d.collectionId === c.id).length;
      const active = state.view === 'collection:' + c.id;
      return '<li class="collection-item">' +
        '<button class="nav-item' + (active ? ' is-active' : '') + '" data-collection-id="' + esc(c.id) + '"' + (active ? ' aria-current="page"' : '') + '>' +
          '<span class="dot" style="--dot:' + esc(c.color) + '"></span>' +
          '<span class="nav-text">' + esc(c.name) + '</span>' +
          '<span class="nav-count">' + n + '</span>' +
        '</button>' +
        '<button class="icon-btn icon-btn-sm" data-act="collection-menu" data-collection-id="' + esc(c.id) + '" aria-label="Options for ' + esc(c.name) + '">' + icon('dots') + '</button>' +
      '</li>';
    }).join('') || '<li class="collections-empty">Group documents by course, project, or anything else.</li>';
  }

  function renderContent() {
    const list = visibleDocs();
    const view = state.view;
    const totalBytes = list.reduce((sum, d) => sum + (d.size || 0), 0);

    let title = 'All documents';
    let meta;
    if (view === 'recent') title = 'Recently added';
    else if (view === 'favorites') title = 'Favorites';
    else if (view.indexOf('collection:') === 0) {
      const coll = state.collections.find((c) => c.id === view.slice(11));
      title = coll ? coll.name : 'Collection';
    }

    if (!list.length) {
      meta = state.query ? 'No matches' : (state.type === 'all' ? 'No documents' : 'No ' + kindNoun(state.type, true));
    } else {
      const noun = state.type === 'all'
        ? (list.length === 1 ? 'document' : 'documents')
        : kindNoun(state.type, list.length !== 1);
      if (view === 'recent') meta = list.length + ' ' + noun + ' added in the last two weeks · ' + formatBytes(totalBytes);
      else if (view === 'favorites') meta = list.length + ' ' + noun + ' starred · ' + formatBytes(totalBytes);
      else meta = list.length + ' ' + noun + ' · ' + formatBytes(totalBytes);
    }

    els.viewTitle.textContent = title;
    els.viewMeta.textContent = meta;

    if (!list.length) {
      els.grid.innerHTML = '';
      els.grid.hidden = true;
      els.empty.hidden = false;
      els.empty.className = 'empty' + (state.docs.length ? ' empty--compact' : '');
      els.empty.innerHTML = emptyHTML();
      return;
    }

    els.empty.hidden = true;
    els.empty.innerHTML = '';
    els.grid.hidden = false;
    els.grid.classList.toggle('is-list', settings.layout === 'list');
    els.grid.innerHTML = settings.layout === 'list'
      ? list.map(listRowHTML).join('')
      : list.map(docCardHTML).join('');
  }

  function emptyHTML() {
    const q = state.query.trim();

    if (q) {
      return '<h2>Nothing matches “' + esc(q) + '”</h2>' +
        '<p>Try a different word, or search the file name instead of the title.</p>' +
        '<div class="empty-actions"><button class="btn btn-ghost" data-act="clear-search">Clear search</button></div>';
    }

    if (state.docs.length === 0) {
      return '<div class="empty-art" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<h2>A quiet home for every document.</h2>' +
        '<p>Papers, photos, notes, decks, contracts — keep them together. They stay in this browser, on this device — no account, no upload.</p>' +
        '<div class="dropcard" data-act="choose" role="button" tabindex="0">' +
          icon('upload') +
          '<p><strong>Drop files here</strong> or <span class="link">choose files</span></p>' +
          '<p class="dropcard-note">Any file type · add several at once</p>' +
        '</div>';
    }

    if (state.type !== 'all') {
      const plural = kindNoun(state.type, true);
      return '<h2>No ' + esc(plural) + ' here.</h2>' +
        '<p>Nothing of this type is in the current view. Show every type, or add something new.</p>' +
        '<div class="empty-actions">' +
          '<button class="btn btn-primary" data-act="choose">' + icon('plus') + 'Add files</button>' +
          '<button class="btn btn-ghost" data-act="clear-type">Show all types</button>' +
        '</div>';
    }

    if (state.view === 'favorites') {
      return '<h2>No favorites yet.</h2>' +
        '<p>Star a document and it will wait for you here, above the rest.</p>' +
        '<div class="empty-actions"><button class="btn btn-ghost" data-act="show-all">Browse all documents</button></div>';
    }

    if (state.view === 'recent') {
      return '<h2>Nothing new in two weeks.</h2>' +
        '<p>Documents you add will appear here for a fortnight, newest first.</p>' +
        '<div class="empty-actions"><button class="btn btn-ghost" data-act="show-all">Browse all documents</button></div>';
    }

    if (state.view.indexOf('collection:') === 0) {
      return '<h2>This collection is empty.</h2>' +
        '<p>Add a file here, or move an existing document into it from its menu.</p>' +
        '<div class="empty-actions"><button class="btn btn-primary" data-act="choose">' + icon('plus') + 'Add files</button></div>';
    }

    return '<h2>No documents here.</h2><p>Add a file to get started.</p>' +
      '<div class="empty-actions"><button class="btn btn-primary" data-act="choose">' + icon('plus') + 'Add files</button></div>';
  }

  /* ------------------------------------------------------------
     Card markup
     ------------------------------------------------------------ */
  function coverHTML(doc) {
    const p = paletteFor(doc);
    const kind = kindOf(doc);
    const ext = extOf(doc);
    const coll = collectionOf(doc);

    if (doc.thumb) {
      return '<span class="cover cover--thumb" style="--caccent:' + p.accent + '">' +
        '<img src="' + doc.thumb + '" alt="" loading="lazy" decoding="async" />' +
        '<span class="cover-spine"></span>' +
        '<span class="cover-badge">' + esc(doc.numPages ? doc.numPages + ' pp' : typeLabel(doc)) + '</span>' +
      '</span>';
    }

    if (doc.snippet && doc.snippet.length) {
      return '<span class="cover cover--snippet" style="--caccent:' + p.accent + '">' +
        '<span class="cover-inner">' +
          '<span class="cover-top"><span class="cover-chip"></span><span>Excerpt · ' + esc(typeLabel(doc)) + '</span></span>' +
          '<span class="cover-snippet">' +
            doc.snippet.slice(0, 12).map((line) => '<span class="snip-line">' + esc(line) + '</span>').join('') +
            '<span class="snip-end"></span>' +
          '</span>' +
          '<span class="cover-foot">' +
            '<span>' + esc(coll ? coll.name : kindName(kind)) + '</span>' +
            '<span>' + esc(typeLabel(doc)) + '</span>' +
          '</span>' +
        '</span>' +
      '</span>';
    }

    const num = String(((doc.colorSeed != null ? doc.colorSeed : hash(doc.title)) % 900) + 100);
    return '<span class="cover" style="--cbg:' + p.bg + ';--cink:' + p.ink + ';--cline:' + p.line + ';--caccent:' + p.accent + '">' +
      '<span class="cover-inner">' +
        '<span class="cover-top"><span class="cover-chip"></span><span>No. ' + num + '</span></span>' +
        '<span class="cover-title">' + esc(doc.title) + '</span>' +
        '<span class="cover-foot">' +
          '<span>' + esc(coll ? coll.name : kindName(kind)) + '</span>' +
          '<span>' + esc(doc.numPages ? doc.numPages + ' pp' : typeLabel(doc)) + '</span>' +
        '</span>' +
      '</span>' +
    '</span>';
  }

  function miniCoverHTML(doc) {
    const p = paletteFor(doc);
    if (doc.thumb) {
      return '<span class="cover cover--thumb cover--mini" style="--caccent:' + p.accent + '">' +
        '<img src="' + doc.thumb + '" alt="" loading="lazy" decoding="async" />' +
        '<span class="cover-spine"></span>' +
      '</span>';
    }
    if (doc.snippet && doc.snippet.length) {
      let lines = '';
      const count = Math.min(5, Math.max(3, doc.snippet.length));
      for (let i = 0; i < count; i++) lines += '<i></i>';
      return '<span class="cover cover--mini cover--snippet" style="--caccent:' + p.accent + '">' +
        '<span class="cover-inner"><span class="mini-lines">' + lines + '</span></span>' +
      '</span>';
    }
    return '<span class="cover cover--mini" style="--cbg:' + p.bg + ';--cink:' + p.ink + ';--cline:' + p.line + ';--caccent:' + p.accent + '">' +
      '<span class="cover-inner"><span class="cover-chip"></span></span>' +
    '</span>';
  }

  function metaHTML(doc, withDate) {
    const coll = collectionOf(doc);
    const bits = [];
    if (coll) bits.push('<span class="dot" style="--dot:' + esc(coll.color) + '"></span><span>' + esc(coll.name) + '</span>');
    if (doc.numPages) bits.push('<span>' + doc.numPages + ' pp</span>');
    else bits.push('<span>' + esc(typeLabel(doc)) + '</span>');
    bits.push('<span>' + formatBytes(doc.size) + '</span>');
    if (withDate) bits.push('<span>' + formatShortDate(doc.addedAt) + '</span>');
    return bits.join('<span class="meta-sep">·</span>');
  }

  function actionsHTML(doc) {
    return '<div class="doc-actions">' +
      '<button class="mini-btn star' + (doc.favorite ? ' is-on' : '') + '" data-act="star" aria-pressed="' + !!doc.favorite + '" aria-label="' + (doc.favorite ? 'Remove from favorites' : 'Add to favorites') + '" title="Favorite">' + icon('star') + '</button>' +
      '<button class="mini-btn" data-act="menu" aria-label="More actions" title="More">' + icon('dots') + '</button>' +
    '</div>';
  }

  function docCardHTML(doc) {
    return '<article class="doc" data-doc-id="' + esc(doc.id) + '">' +
      '<button class="cover-btn" data-act="open" aria-label="Open ' + esc(doc.title) + '">' + coverHTML(doc) + '</button>' +
      '<div class="doc-row">' +
        '<div class="doc-text">' +
          '<h3 class="doc-title">' + esc(doc.title) + '</h3>' +
          '<p class="doc-meta">' + metaHTML(doc, false) + '</p>' +
        '</div>' +
        actionsHTML(doc) +
      '</div>' +
    '</article>';
  }

  function listRowHTML(doc) {
    return '<div class="list-row" data-doc-id="' + esc(doc.id) + '">' +
      '<button class="list-open" data-act="open" aria-label="Open ' + esc(doc.title) + '">' +
        '<span class="list-cover">' + miniCoverHTML(doc) + '</span>' +
        '<span class="list-main">' +
          '<span class="list-title">' + esc(doc.title) + '</span>' +
          '<span class="list-sub">' + metaHTML(doc, false) + '</span>' +
        '</span>' +
      '</button>' +
      '<span class="list-kind">' + esc(doc.numPages ? doc.numPages + ' pp' : typeLabel(doc)) + '</span>' +
      '<span class="list-date">' + formatShortDate(doc.addedAt) + '</span>' +
      '<span class="list-actions">' + actionsHTML(doc) + '</span>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     Views
     ------------------------------------------------------------ */
  function setView(view) {
    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    closeSidebar();
  }

  function openSidebar() {
    els.sidebar.classList.add('is-open');
    els.scrim.hidden = false;
  }

  function closeSidebar() {
    els.sidebar.classList.remove('is-open');
    els.scrim.hidden = true;
  }

  /* ------------------------------------------------------------
     Reader
     ------------------------------------------------------------ */
  function metaText(doc) {
    return [describeDoc(doc), formatBytes(doc.size), 'Added ' + formatDate(doc.addedAt)].join(' · ');
  }

  function resetReaderBody() {
    els.readerFrame.src = 'about:blank';
    els.readerFrame.hidden = false;
    els.readerAlt.hidden = true;
    els.readerAlt.innerHTML = '';
  }

  function readerUnsupported(doc, message) {
    els.readerAlt.innerHTML = '<div class="reader-unsupported-wrap"><div class="reader-unsupported">' +
      '<span class="reader-unsupported-mark">' + esc(typeLabel(doc)) + '</span>' +
      '<h3>' + esc(kindName(kindOf(doc))) + '</h3>' +
      '<p>' + esc(message || 'This file type can’t be previewed in the browser. Download it to open it in its native app.') + '</p>' +
      '<button class="btn btn-primary" data-reader-download>' + icon('download') + 'Download file</button>' +
    '</div></div>';
    els.readerAlt.hidden = false;
    const btn = els.readerAlt.querySelector('[data-reader-download]');
    if (btn) btn.addEventListener('click', () => downloadDoc(doc.id));
  }

  async function readerText(doc, blob) {
    const limit = 200000;
    const slice = blob.size > limit ? blob.slice(0, limit) : blob;
    const text = await readBlobText(slice);
    const code = !PROSE_EXTS.has(extOf(doc));
    const note = blob.size > limit ? '<p class="reader-note">Preview limited to the first 200,000 characters.</p>' : '';
    els.readerAlt.innerHTML = '<div class="reader-paper' + (code ? ' reader-paper--code' : '') + '">' +
      '<div class="reader-paper-head"><span>Preview</span><span>' + esc(typeLabel(doc)) + '</span></div>' +
      '<pre>' + esc(text) + '</pre>' + note +
    '</div>';
    els.readerAlt.hidden = false;
  }

  function readerImage(doc, url) {
    els.readerAlt.innerHTML = '<div class="reader-image-wrap"><img class="reader-image" alt="' + esc(doc.title) + '" src="' + esc(url) + '" /></div>';
    els.readerAlt.hidden = false;
    const img = els.readerAlt.querySelector('img');
    if (img) {
      img.onerror = () => readerUnsupported(doc, 'This image could not be displayed in your browser. Download it to view it in another app.');
    }
  }

  function readerAudio(doc, url) {
    els.readerAlt.innerHTML = '<div class="reader-media-wrap"><div class="reader-media">' +
      '<span class="reader-media-mark">' + esc(typeLabel(doc)) + '</span>' +
      '<h3>' + esc(doc.title) + '</h3>' +
      '<p>' + esc(describeDoc(doc)) + ' · ' + formatBytes(doc.size) + '</p>' +
      '<audio controls preload="metadata" src="' + esc(url) + '"></audio>' +
    '</div></div>';
    els.readerAlt.hidden = false;
    const audio = els.readerAlt.querySelector('audio');
    if (audio) {
      audio.onerror = () => readerUnsupported(doc, 'This audio format could not be played in your browser. Download it to open it in another app.');
    }
  }

  function readerVideo(doc, url) {
    els.readerAlt.innerHTML = '<div class="reader-video-wrap"><video class="reader-video" controls playsinline preload="metadata" src="' + esc(url) + '"></video></div>';
    els.readerAlt.hidden = false;
    const video = els.readerAlt.querySelector('video');
    if (video) {
      video.onerror = () => readerUnsupported(doc, 'This video format could not be played in your browser. Download it to open it in another app.');
    }
  }

  async function openDoc(id) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;

    let file;
    try { file = await dbGet('files', id); } catch (e) { file = null; }
    if (!file || !file.blob) {
      toast('That file is missing from storage. Try adding it again.', 'warn', 5000);
      return;
    }

    if (state.readerUrl) URL.revokeObjectURL(state.readerUrl);
    resetReaderBody();
    state.readerUrl = URL.createObjectURL(file.blob);
    state.readerDocId = id;

    const kind = kindOf(doc);
    els.readerTitle.textContent = doc.title;
    els.readerMeta.textContent = metaText(doc);
    els.readerNewTab.href = state.readerUrl;
    els.readerNewTab.hidden = !canOpenInNewTab(doc);
    els.readerStar.classList.toggle('is-on', !!doc.favorite);
    els.readerStar.setAttribute('aria-pressed', String(!!doc.favorite));
    els.readerStar.setAttribute('aria-label', doc.favorite ? 'Remove from favorites' : 'Add to favorites');

    if (kind === 'pdf') {
      els.readerFrame.src = state.readerUrl + '#view=FitH';
    } else if (kind === 'image') {
      els.readerFrame.hidden = true;
      readerImage(doc, state.readerUrl);
    } else if (isTextPreviewable(doc)) {
      els.readerFrame.hidden = true;
      try {
        await readerText(doc, file.blob);
      } catch (err) {
        console.warn('Could not read ' + doc.name, err);
        readerUnsupported(doc, 'This file could not be read as text. Download it to open it in its native app.');
      }
    } else if (kind === 'audio') {
      els.readerFrame.hidden = true;
      readerAudio(doc, state.readerUrl);
    } else if (kind === 'video') {
      els.readerFrame.hidden = true;
      readerVideo(doc, state.readerUrl);
    } else {
      els.readerFrame.hidden = true;
      readerUnsupported(doc);
    }

    els.reader.hidden = false;
    document.body.style.overflow = 'hidden';
    const app = document.querySelector('.app');
    if (app) app.inert = true;
    els.readerClose.focus();

    doc.lastOpenedAt = Date.now();
    dbPut('docs', doc).catch(() => {});
  }

  function closeReader() {
    if (!state.readerDocId && els.reader.hidden) return;
    els.reader.hidden = true;
    resetReaderBody();
    els.readerNewTab.hidden = false;
    if (state.readerUrl) {
      URL.revokeObjectURL(state.readerUrl);
      state.readerUrl = null;
    }
    state.readerDocId = null;
    document.body.style.overflow = '';
    const app = document.querySelector('.app');
    if (app) app.inert = false;
  }

  async function toggleFavorite(id) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    doc.favorite = !doc.favorite;
    try {
      await dbPut('docs', doc);
    } catch (e) {
      toast('Could not save that change.', 'warn');
    }
    closeMenu();
    render();
    if (state.readerDocId === id) {
      els.readerStar.classList.toggle('is-on', !!doc.favorite);
      els.readerStar.setAttribute('aria-pressed', String(!!doc.favorite));
      els.readerStar.setAttribute('aria-label', doc.favorite ? 'Remove from favorites' : 'Add to favorites');
    }
    toast(doc.favorite ? 'Added to favorites' : 'Removed from favorites');
  }

  /* ------------------------------------------------------------
     Document actions
     ------------------------------------------------------------ */
  async function renameDoc(id) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    const name = await askName({
      title: 'Rename document',
      help: 'This changes the title in your library. The file itself is untouched.',
      value: doc.title,
      confirmText: 'Save'
    });
    if (!name || name === doc.title) return;
    doc.title = name;
    try {
      await dbPut('docs', doc);
    } catch (e) {
      toast('Could not rename that document.', 'warn');
      return;
    }
    render();
    if (state.readerDocId === id) els.readerTitle.textContent = doc.title;
    toast('Document renamed');
  }

  async function moveDoc(id) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    const choice = await chooseCollection(doc.collectionId || null);
    if (choice === undefined) return;
    doc.collectionId = choice;
    try {
      await dbPut('docs', doc);
    } catch (e) {
      toast('Could not move that document.', 'warn');
      return;
    }
    render();
    const coll = choice ? state.collections.find((c) => c.id === choice) : null;
    toast(coll ? 'Moved to ' + coll.name : 'Removed from collection');
  }

  async function deleteDoc(id) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    const ok = await askConfirm({
      title: 'Delete this document?',
      body: '“' + doc.title + '” will be removed from this browser for good. This cannot be undone.',
      confirmText: 'Delete'
    });
    if (!ok) return;
    try {
      await Promise.all([dbDelete('docs', id), dbDelete('files', id)]);
    } catch (e) {
      toast('Could not delete that document.', 'warn');
      return;
    }
    if (state.readerDocId === id) closeReader();
    state.docs = state.docs.filter((d) => d.id !== id);
    render();
    updateStorage();
    toast('Document deleted');
  }

  async function downloadDoc(id) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    let file;
    try { file = await dbGet('files', id); } catch (e) { file = null; }
    if (!file || !file.blob) {
      toast('That file is missing from storage.', 'warn');
      return;
    }
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name || doc.title;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Download started');
  }

  /* ------------------------------------------------------------
     Menus
     ------------------------------------------------------------ */
  function menuItem(act, label, ic, danger) {
    return '<button class="menu-item' + (danger ? ' is-danger' : '') + '" role="menuitem" data-act="' + act + '">' +
      icon(ic) + '<span>' + esc(label) + '</span>' +
    '</button>';
  }

  function openDocMenu(id, anchor) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    state.menuDocId = id;
    state.menuCollectionId = null;
    els.menu.innerHTML =
      menuItem('open', 'Open', 'file') +
      menuItem('rename', 'Rename', 'pencil') +
      menuItem('move', doc.collectionId ? 'Change collection' : 'Move to collection', 'folder') +
      '<div class="menu-sep"></div>' +
      menuItem('download', 'Download', 'download') +
      menuItem('favorite', doc.favorite ? 'Remove from favorites' : 'Add to favorites', 'star') +
      '<div class="menu-sep"></div>' +
      menuItem('delete', 'Delete', 'trash', true);
    showMenuAt(anchor);
  }

  function openCollectionMenu(id, anchor) {
    const coll = state.collections.find((c) => c.id === id);
    if (!coll) return;
    state.menuCollectionId = id;
    state.menuDocId = null;
    els.menu.innerHTML =
      menuItem('rename-collection', 'Rename collection', 'pencil') +
      menuItem('delete-collection', 'Delete collection', 'trash', true);
    showMenuAt(anchor);
  }

  function showMenuAt(anchor) {
    els.menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    const mw = els.menu.offsetWidth;
    const mh = els.menu.offsetHeight;
    let left = Math.min(r.right - mw, window.innerWidth - mw - 12);
    left = Math.max(12, left);
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 12) top = Math.max(12, r.top - mh - 6);
    els.menu.style.left = left + 'px';
    els.menu.style.top = top + 'px';
    const first = els.menu.querySelector('button');
    if (first) first.focus();
  }

  function closeMenu() {
    els.menu.hidden = true;
    els.menu.innerHTML = '';
    state.menuDocId = null;
    state.menuCollectionId = null;
  }

  /* ------------------------------------------------------------
     Dialogs
     ------------------------------------------------------------ */
  function askName(opts) {
    return new Promise((resolve) => {
      state.color = COLLECTION_COLORS[0];
      els.nameTitle.textContent = opts.title;
      els.nameHelp.textContent = opts.help || '';
      els.nameHelp.hidden = !opts.help;
      els.nameInput.value = opts.value || '';
      els.nameConfirm.textContent = opts.confirmText || 'Save';
      els.colorRow.hidden = !opts.colors;

      if (opts.colors) {
        els.swatchRow.innerHTML = COLLECTION_COLORS.map((c) =>
          '<button type="button" class="swatch" style="--sw:' + c + '" data-color="' + c + '" aria-label="Use this color" aria-pressed="' + (c === state.color) + '"></button>'
        ).join('');
      }

      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (els.nameDialog.open) els.nameDialog.close();
        resolve(value);
      };

      els.nameForm.onsubmit = (e) => {
        e.preventDefault();
        const value = els.nameInput.value.trim();
        if (!value) { els.nameInput.focus(); return; }
        finish(value);
      };
      els.nameCancel.onclick = () => finish(null);
      els.nameDialog.oncancel = (e) => { e.preventDefault(); finish(null); };

      els.nameDialog.showModal();
      setTimeout(() => { els.nameInput.focus(); els.nameInput.select(); }, 40);
    });
  }

  function askConfirm(opts) {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = opts.title;
      els.confirmBody.textContent = opts.body;
      els.confirmOk.textContent = opts.confirmText || 'Delete';

      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (els.confirmDialog.open) els.confirmDialog.close();
        resolve(value);
      };

      els.confirmOk.onclick = () => finish(true);
      els.confirmCancel.onclick = () => finish(false);
      els.confirmDialog.oncancel = (e) => { e.preventDefault(); finish(false); };

      els.confirmDialog.showModal();
      setTimeout(() => els.confirmCancel.focus(), 40);
    });
  }

  function chooseCollection(currentId) {
    return new Promise((resolve) => {
      const options = [{ id: null, name: 'No collection', color: '#8f9a93' }].concat(state.collections);
      els.moveList.innerHTML = options.map((c) => {
        const isCurrent = (c.id || null) === (currentId || null);
        return '<button type="button" class="move-item' + (isCurrent ? ' is-current' : '') + '" data-move="' + esc(c.id || '') + '">' +
          '<span class="dot" style="--dot:' + esc(c.color) + '"></span>' +
          '<span>' + esc(c.name) + '</span>' +
          (isCurrent ? '<span class="check">' + icon('check') + '</span>' : '') +
        '</button>';
      }).join('');

      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (els.moveDialog.open) els.moveDialog.close();
        resolve(value);
      };

      els.moveList.onclick = (e) => {
        const btn = e.target.closest('[data-move]');
        if (!btn) return;
        finish(btn.dataset.move || null);
      };
      els.moveCancel.onclick = () => finish(undefined);
      els.moveDialog.oncancel = (e) => { e.preventDefault(); finish(undefined); };

      els.moveDialog.showModal();
      setTimeout(() => {
        const current = els.moveList.querySelector('.is-current') || els.moveList.querySelector('button');
        if (current) current.focus();
      }, 40);
    });
  }

  /* ------------------------------------------------------------
     Collections
     ------------------------------------------------------------ */
  async function newCollection() {
    const name = await askName({
      title: 'New collection',
      help: 'Group documents by course, project, or client.',
      value: '',
      confirmText: 'Create',
      colors: true
    });
    if (!name) return;
    const coll = { id: uid(), name: name, color: state.color, createdAt: Date.now() };
    state.collections.push(coll);
    try {
      await dbPut('collections', coll);
    } catch (e) {
      state.collections.pop();
      toast('Could not create that collection.', 'warn');
      return;
    }
    render();
    toast('Collection created');
  }

  async function renameCollection(id) {
    const coll = state.collections.find((c) => c.id === id);
    if (!coll) return;
    const name = await askName({
      title: 'Rename collection',
      value: coll.name,
      confirmText: 'Save'
    });
    if (!name || name === coll.name) return;
    coll.name = name;
    try {
      await dbPut('collections', coll);
    } catch (e) {
      toast('Could not rename that collection.', 'warn');
      return;
    }
    render();
    toast('Collection renamed');
  }

  async function deleteCollection(id) {
    const coll = state.collections.find((c) => c.id === id);
    if (!coll) return;
    const count = state.docs.filter((d) => d.collectionId === id).length;
    const ok = await askConfirm({
      title: 'Delete this collection?',
      body: count
        ? 'The ' + count + ' document' + (count === 1 ? '' : 's') + ' inside will stay in your library. Only the collection is removed.'
        : 'The collection will be removed. Your documents are untouched.',
      confirmText: 'Delete collection'
    });
    if (!ok) return;
    try {
      await dbDelete('collections', id);
    } catch (e) {
      toast('Could not delete that collection.', 'warn');
      return;
    }
    state.collections = state.collections.filter((c) => c.id !== id);
    for (const doc of state.docs.filter((d) => d.collectionId === id)) {
      doc.collectionId = null;
      try { await dbPut('docs', doc); } catch (e) { /* best effort */ }
    }
    if (state.view === 'collection:' + id) state.view = 'all';
    render();
    toast('Collection deleted');
  }

  /* ------------------------------------------------------------
     Previews
     ------------------------------------------------------------ */
  let pdfjsPromise = null;

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;

    pdfjsPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = async () => {
        const lib = window.pdfjsLib;
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        if (lib) {
          try {
            lib.GlobalWorkerOptions.workerSrc = workerUrl;
            const controller = new AbortController();
            const abort = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(workerUrl, { signal: controller.signal, mode: 'cors' });
            clearTimeout(abort);
            if (!response.ok) throw new Error('Worker request failed');
            const code = await response.text();
            lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
              new Blob([code], { type: 'application/javascript' })
            );
          } catch (e) {
            /* keep the CDN worker URL; the preview will simply time out if it is blocked */
          }
        }
        finish(lib || null);
      };
      script.onerror = () => finish(null);
      document.head.appendChild(script);
      setTimeout(() => finish(window.pdfjsLib || null), 9000);
    });

    return pdfjsPromise;
  }

  async function makePdfThumb(file) {
    const lib = await loadPdfJs();
    if (!lib) return {};
    let pdf = null;
    let timer = null;
    try {
      const work = (async () => {
        const buffer = await file.arrayBuffer();
        pdf = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 480 / base.width);
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        return { numPages: pdf.numPages, thumb: canvas.toDataURL('image/jpeg', 0.78) };
      })();

      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), 10000);
      });
      const result = await Promise.race([work, timeout]);
      if (!result) {
        work.catch(() => {});
        console.warn('Timed out rendering a preview for ' + file.name);
        return {};
      }
      return result;
    } catch (err) {
      console.warn('Could not render a preview for ' + file.name, err);
      return {};
    } finally {
      if (timer) clearTimeout(timer);
      if (pdf) {
        try {
          const destroying = pdf.destroy();
          if (destroying && destroying.catch) destroying.catch(() => {});
        } catch (e) { /* ignore */ }
      }
    }
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        URL.revokeObjectURL(url);
      };
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out decoding image'));
      }, 10000);
      img.onload = () => { cleanup(); resolve(img); };
      img.onerror = () => { cleanup(); reject(new Error('Could not decode image')); };
      img.src = url;
    });
  }

  async function makeImageThumb(file) {
    let source = null;
    let fromBitmap = false;
    try {
      if (window.createImageBitmap) {
        try {
          source = await createImageBitmap(file, { imageOrientation: 'from-image' });
          fromBitmap = true;
        } catch (e) {
          source = null;
        }
      }
      if (!source) source = await loadImage(file);

      const sw = source.width || source.naturalWidth || 0;
      const sh = source.height || source.naturalHeight || 0;
      if (!sw || !sh) return {};

      const width = 420;
      const height = 560;
      const target = width / height;
      let cw = sw;
      let ch = sh;
      let cx = 0;
      let cy = 0;
      if (sw / sh > target) {
        cw = sh * target;
        cx = (sw - cw) / 2;
      } else {
        ch = sw / target;
        cy = 0;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, cx, cy, cw, ch, 0, 0, width, height);

      return { thumb: canvas.toDataURL('image/jpeg', 0.8) };
    } catch (err) {
      console.warn('Could not render a preview for ' + file.name, err);
      return {};
    } finally {
      if (fromBitmap && source && source.close) {
        try { source.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  async function makeTextSnippet(file, doc) {
    try {
      const text = await readBlobText(file.slice(0, 24000));
      const lines = snippetLines(text, extOf(doc));
      return lines.length ? { snippet: lines } : {};
    } catch (err) {
      console.warn('Could not read ' + file.name, err);
      return {};
    }
  }

  async function makePreview(file, doc) {
    const kind = kindOf(doc);
    if (kind === 'pdf') return makePdfThumb(file);
    if (kind === 'image') return makeImageThumb(file);
    if (isTextPreviewable(doc)) return makeTextSnippet(file, doc);
    return {};
  }

  function queuePreview(file, doc) {
    makePreview(file, doc).then(async (info) => {
      if (!state.docs.some((d) => d.id === doc.id)) return;
      if (info.numPages) doc.numPages = info.numPages;
      if (info.thumb) doc.thumb = info.thumb;
      if (info.snippet) doc.snippet = info.snippet;
      if (info.numPages || info.thumb || info.snippet) {
        try { await dbPut('docs', doc); } catch (e) { /* keep the document without a preview */ }
        render();
      }
    }).catch((err) => {
      console.warn('Could not build a preview for ' + file.name, err);
    });
  }

  /* ------------------------------------------------------------
     Adding files
     ------------------------------------------------------------ */
  async function addFiles(fileList) {
    if (state.busy) {
      toast('Still adding the previous files. One moment.', 'warn');
      return;
    }

    const incoming = Array.from(fileList || []);
    const empty = incoming.filter((f) => !f || !f.size).length;
    const files = incoming.filter((f) => f && f.size > 0);

    if (empty) toast(empty + ' empty file' + (empty === 1 ? '' : 's') + ' skipped', 'warn');
    if (!files.length) return;

    const duplicates = [];
    const fresh = files.filter((f) => {
      const exists = state.docs.some((d) => d.name === f.name && d.size === f.size);
      if (exists) duplicates.push(f.name);
      return !exists;
    });

    if (duplicates.length) {
      toast(
        duplicates.length === 1
          ? '“' + duplicates[0] + '” is already in your library'
          : duplicates.length + ' files are already in your library',
        'warn',
        5000
      );
    }
    if (!fresh.length) return;

    requestPersistence();

    const targetCollection = state.view.indexOf('collection:') === 0 ? state.view.slice(11) : null;
    state.busy = true;
    setBusy(0, fresh.length);
    let added = 0;

    try {
      for (let i = 0; i < fresh.length; i++) {
        const file = fresh[i];
        setBusy(i, fresh.length);

        const id = uid();
        const ext = extFromName(file.name);
        const doc = {
          id: id,
          name: file.name,
          title: titleFromName(file.name),
          size: file.size,
          type: file.type || '',
          ext: ext,
          kind: kindFromFile(file, ext),
          addedAt: Date.now(),
          lastOpenedAt: 0,
          collectionId: targetCollection,
          favorite: false,
          numPages: null,
          thumb: null,
          snippet: null,
          colorSeed: hash(file.name + file.size)
        };

        try {
          await dbPut('files', { id: id, blob: file });
          await dbPut('docs', doc);
        } catch (err) {
          console.error(err);
          toast('Could not save “' + file.name + '”. Storage may be full.', 'warn', 6000);
          continue;
        }

        state.docs.push(doc);
        added++;
        render();
        queuePreview(file, doc);
      }
    } finally {
      state.busy = false;
      setBusy(fresh.length, fresh.length);
    }

    updateStorage();

    if (added) {
      const coll = targetCollection ? state.collections.find((c) => c.id === targetCollection) : null;
      toast(
        added + ' ' + (added === 1 ? 'document' : 'documents') + ' added' +
        (coll ? ' to ' + coll.name : '')
      );
    }
  }

  function setBusy(done, total) {
    const busy = done < total;
    const sideLabel = els.addBtn.querySelector('span:last-child');
    const topLabel = els.addBtnTop.querySelector('.btn-label');
    if (sideLabel) sideLabel.textContent = busy ? 'Adding ' + (done + 1) + ' of ' + total + '…' : 'Add files';
    if (topLabel) topLabel.textContent = busy ? (done + 1) + '/' + total : 'Add files';
    els.addBtn.disabled = busy;
    els.addBtnTop.disabled = busy;
  }

  function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) { /* ignore */ }
  }

  async function updateStorage() {
    const localTotal = state.docs.reduce((sum, d) => sum + (d.size || 0), 0);
    if (!(navigator.storage && navigator.storage.estimate)) {
      els.storageText.textContent = formatBytes(localTotal) + ' used';
      return;
    }
    try {
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 0;
      els.storageText.textContent = formatBytes(usage) + ' used';
      const pct = quota ? Math.min(100, Math.max(1.5, (usage / quota) * 100)) : 0;
      els.storageBar.style.width = pct + '%';
      els.storageBar.parentElement.title = quota
        ? formatBytes(usage) + ' of ' + formatBytes(quota) + ' available'
        : '';
    } catch (e) {
      els.storageText.textContent = formatBytes(localTotal) + ' used';
    }
  }

  /* ------------------------------------------------------------
     Toasts
     ------------------------------------------------------------ */
  function toast(message, kind, ms) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'warn' ? ' is-warn' : '');
    el.innerHTML = icon(kind === 'warn' ? 'alert' : 'check') + '<span>' + esc(message) + '</span>';
    els.toasts.appendChild(el);

    const life = ms || 3400;
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 240);
    }, life);
  }

  function clearSearch() {
    state.query = '';
    els.search.value = '';
    els.searchClear.hidden = true;
    renderContent();
    els.search.focus();
  }

  /* ------------------------------------------------------------
     Events
     ------------------------------------------------------------ */
  function isTyping(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' || el.isContentEditable);
  }

  function onGridClick(e) {
    const holder = e.target.closest('[data-doc-id]');
    if (!holder) return;
    const id = holder.dataset.docId;

    if (e.target.closest('[data-act="star"]')) { toggleFavorite(id); return; }
    const menuBtn = e.target.closest('[data-act="menu"]');
    if (menuBtn) { openDocMenu(id, menuBtn); return; }
    if (e.target.closest('[data-act="open"]') || e.target.closest('.doc-text')) openDoc(id);
  }

  function onMenuClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const docId = state.menuDocId;
    const collId = state.menuCollectionId;
    closeMenu();

    if (docId) {
      if (act === 'open') openDoc(docId);
      else if (act === 'rename') renameDoc(docId);
      else if (act === 'move') moveDoc(docId);
      else if (act === 'download') downloadDoc(docId);
      else if (act === 'favorite') toggleFavorite(docId);
      else if (act === 'delete') deleteDoc(docId);
    } else if (collId) {
      if (act === 'rename-collection') renameCollection(collId);
      else if (act === 'delete-collection') deleteCollection(collId);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (document.querySelector('dialog[open]')) return;
      if (!els.menu.hidden) { closeMenu(); return; }
      if (!els.reader.hidden) { closeReader(); return; }
      if (els.sidebar.classList.contains('is-open')) { closeSidebar(); return; }
      if (state.query) { clearSearch(); return; }
      return;
    }
    if (e.key === '/' && !isTyping(e.target)) {
      e.preventDefault();
      els.search.focus();
      els.search.select();
    }
  }

  function bindEvents() {
    els.addBtn.addEventListener('click', () => els.fileInput.click());
    els.addBtnTop.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', () => {
      const files = Array.from(els.fileInput.files || []);
      els.fileInput.value = '';
      if (files.length) addFiles(files);
    });

    let searchTimer = null;
    els.search.addEventListener('input', () => {
      state.query = els.search.value;
      els.searchClear.hidden = !state.query;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderContent, 90);
    });
    els.searchClear.addEventListener('click', clearSearch);

    els.typeSelect.addEventListener('change', () => {
      state.type = els.typeSelect.value;
      renderContent();
    });

    els.sortSelect.addEventListener('change', () => {
      settings.sort = els.sortSelect.value;
      saveSettings();
      renderContent();
    });

    $$('.seg').forEach((btn) => btn.addEventListener('click', () => {
      if (settings.layout === btn.dataset.layout) return;
      settings.layout = btn.dataset.layout;
      saveSettings();
      applyLayout();
      renderContent();
    }));

    els.themeBtn.addEventListener('click', () => {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      saveSettings();
      applyTheme();
    });

    $$('.nav-item[data-view]').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));

    els.newCollectionBtn.addEventListener('click', newCollection);

    els.collectionList.addEventListener('click', (e) => {
      const more = e.target.closest('[data-act="collection-menu"]');
      if (more) {
        e.stopPropagation();
        openCollectionMenu(more.dataset.collectionId, more);
        return;
      }
      const btn = e.target.closest('[data-collection-id]');
      if (btn) setView('collection:' + btn.dataset.collectionId);
    });

    els.grid.addEventListener('click', onGridClick);
    els.grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const opener = e.target.closest('[data-act="open"]');
      if (opener) { e.preventDefault(); opener.click(); }
    });

    els.empty.addEventListener('click', (e) => {
      const action = e.target.closest('[data-act]');
      if (!action) return;
      const act = action.dataset.act;
      if (act === 'choose') els.fileInput.click();
      else if (act === 'clear-search') clearSearch();
      else if (act === 'clear-type') {
        state.type = 'all';
        els.typeSelect.value = 'all';
        renderContent();
      }
      else if (act === 'show-all') setView('all');
      else if (act === 'reload') location.reload();
    });
    els.empty.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-act="choose"]')) {
        e.preventDefault();
        els.fileInput.click();
      }
    });

    els.menu.addEventListener('click', onMenuClick);

    els.menuBtn.addEventListener('click', openSidebar);
    els.scrim.addEventListener('click', closeSidebar);

    els.readerClose.addEventListener('click', closeReader);
    els.reader.addEventListener('click', (e) => { if (e.target === els.reader) closeReader(); });
    els.readerStar.addEventListener('click', () => { if (state.readerDocId) toggleFavorite(state.readerDocId); });
    els.readerDownload.addEventListener('click', () => { if (state.readerDocId) downloadDoc(state.readerDocId); });

    els.swatchRow.addEventListener('click', (e) => {
      const swatch = e.target.closest('[data-color]');
      if (!swatch) return;
      state.color = swatch.dataset.color;
      $$('.swatch', els.swatchRow).forEach((s) => s.setAttribute('aria-pressed', String(s === swatch)));
    });

    document.addEventListener('click', (e) => {
      if (els.menu.hidden) return;
      if (e.target.closest('#menu')) return;
      if (e.target.closest('[data-act="menu"], [data-act="collection-menu"]')) return;
      closeMenu();
    });
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', () => { if (!els.menu.hidden) closeMenu(); }, true);
    document.addEventListener('keydown', onKeyDown);

    let dragDepth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1;

    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth++;
      els.dropOverlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) els.dropOverlay.hidden = true;
    });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      els.dropOverlay.hidden = true;
      if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
  }

  init();
})();

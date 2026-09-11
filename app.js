const API_URL = 'https://script.google.com/macros/s/AKfycbxSplON-1eRjJJv2fPYtaOJAdSdFQSN5DN749QZAh2BijkYKbpwK1nO2edMtktDX5U/exec';

const NDC = [
  { n: '0', label: '総記', emoji: '📚' },
  { n: '1', label: '哲学', emoji: '🧠' },
  { n: '2', label: '歴史', emoji: '🏛️' },
  { n: '3', label: '社会科学', emoji: '⚖️' },
  { n: '4', label: '自然科学', emoji: '🔬' },
  { n: '5', label: '技術・工学', emoji: '⚙️' },
  { n: '6', label: '産業', emoji: '🏭' },
  { n: '7', label: '芸術', emoji: '🎨' },
  { n: '8', label: '言語', emoji: '🗣️' },
  { n: '9', label: '文学', emoji: '✒️' },
];

let books = [];
let mode = 'home';
let query = '';
let activeCat = '';
let searchTimer = null;
let sessionPin = null;

// ---- 背景カスタマイズ(この端末だけのローカル設定) ----
const BG_KEY = 'library-app-bg';
const BG_COLORS = ['#F5EFE0', '#E9F1EE', '#FDEBE3', '#EAEFF7', '#F3E9F5', '#1B2430'];

function applyBackground(pref) {
  if (!pref) {
    document.body.style.background = '';
    document.body.style.backgroundImage = '';
    return;
  }
  if (pref.type === 'color') {
    document.body.style.backgroundImage = '';
    document.body.style.background = pref.value;
  } else if (pref.type === 'image') {
    document.body.style.backgroundImage = `url(${pref.value})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  }
}
function loadBackground() {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (raw) applyBackground(JSON.parse(raw));
  } catch (e) {}
}
function saveBackground(pref) {
  try {
    localStorage.setItem(BG_KEY, JSON.stringify(pref));
  } catch (e) {
    showError('背景の保存に失敗しました(容量オーバーの可能性があります)。');
  }
  applyBackground(pref);
}
function renderSwatches() {
  const wrap = document.getElementById('colorSwatches');
  wrap.innerHTML = '';
  BG_COLORS.forEach((c) => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = c;
    s.addEventListener('click', () => saveBackground({ type: 'color', value: c }));
    wrap.appendChild(s);
  });
}
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.toggle('open');
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.remove('open');
});
document.getElementById('resetBgBtn').addEventListener('click', () => {
  localStorage.removeItem(BG_KEY);
  applyBackground(null);
});
document.getElementById('bgImageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    window.alert('画像サイズが大きすぎます(2MB以下にしてください)。');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => saveBackground({ type: 'image', value: reader.result });
  reader.readAsDataURL(file);
});
renderSwatches();
loadBackground();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function showError(msg) {
  const el = document.getElementById('saveError');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('saveError').style.display = 'none';
}
function askPin() {
  if (sessionPin) return sessionPin;
  const p = window.prompt('合言葉(PIN)を入力してください');
  sessionPin = p;
  return p;
}
async function callApi(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return res.json();
}

// ---- お知らせ ----
async function loadAnnouncements() {
  try {
    const res = await fetch(`${API_URL}?ann=1`, { cache: 'no-store' });
    const data = await res.json();
    renderAnnouncements(Array.isArray(data) ? data : []);
  } catch (e) {
    // お知らせ取得失敗は静かに無視(本の検索機能には影響させない)
  }
}
function renderAnnouncements(list) {
  const area = document.getElementById('announceArea');
  area.innerHTML = '';
  list.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'announce-card';
    card.innerHTML = `
      <div class="a-text">${escapeHtml(String(a.text || ''))}</div>
      <div class="a-meta">
        <span class="a-date">${escapeHtml(String(a.postedAt || ''))}</span>
        <button class="a-delete">削除</button>
      </div>
    `;
    card.querySelector('.a-delete').addEventListener('click', async () => {
      const pin = askPin();
      if (!pin) return;
      const result = await callApi({ action: 'deleteAnnouncement', id: a.id, pin });
      if (result && result.error === 'invalid_pin') {
        sessionPin = null;
        showError('合言葉が違います。');
      }
      loadAnnouncements();
    });
    area.appendChild(card);
  });
}
document.getElementById('openAnnounceFormBtn').addEventListener('click', () => {
  document.getElementById('announceForm').classList.add('open');
});
document.getElementById('closeAnnounceFormBtn').addEventListener('click', () => {
  document.getElementById('announceForm').classList.remove('open');
});
document.getElementById('postAnnounceBtn').addEventListener('click', async () => {
  const text = document.getElementById('announceText').value.trim();
  if (!text) {
    window.alert('お知らせの内容を入力してください。');
    return;
  }
  const pin = askPin();
  if (!pin) return;
  try {
    const result = await callApi({ action: 'addAnnouncement', text, pin });
    if (result && result.error === 'invalid_pin') {
      sessionPin = null;
      showError('合言葉が違います。');
      return;
    }
    hideError();
    document.getElementById('announceText').value = '';
    document.getElementById('announceForm').classList.remove('open');
    loadAnnouncements();
  } catch (e) {
    showError('お知らせの投稿に失敗しました。「お知らせ」シートが作成されているか確認してください。');
  }
});

// ---- NDCグリッド ----
function renderNdcGrid() {
  const grid = document.getElementById('ndcGrid');
  grid.innerHTML = '';
  NDC.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'ndc-btn' + (mode === 'category' && activeCat === c.n ? ' active' : '');
    btn.innerHTML = `<span class="emoji">${c.emoji}</span><span><span class="num">${c.n}類</span><span class="label">${c.label}</span></span>`;
    btn.addEventListener('click', () => {
      mode = 'category';
      activeCat = c.n;
      query = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('clearSearchBtn').style.display = 'none';
      loadBooks();
    });
    grid.appendChild(btn);
  });
}

// ---- 本の検索・一覧 ----
async function loadBooks() {
  const heading = document.getElementById('listHeading');
  const grid = document.getElementById('ndcGrid');

  if (mode === 'home') {
    heading.style.display = 'none';
    grid.style.display = 'grid';
    document.getElementById('listArea').innerHTML = '';
    renderNdcGrid();
    return;
  }

  grid.style.display = 'none';
  heading.style.display = 'flex';
  document.getElementById('listArea').innerHTML = '<div class="empty">読み込み中…</div>';

  try {
    const url = mode === 'search'
      ? `${API_URL}?q=${encodeURIComponent(query.trim())}`
      : `${API_URL}?cat=${encodeURIComponent(activeCat)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    books = Array.isArray(data) ? data : [];
    hideError();
  } catch (e) {
    showError('データの取得に失敗しました。通信環境を確認してください。');
    books = [];
  }
  render();
}

function render() {
  const area = document.getElementById('listArea');
  const heading = document.getElementById('listHeading');
  area.innerHTML = '';

  const NDC_LABELS = Object.fromEntries(NDC.map((c) => [c.n, c.label]));
  const backLink = `<span class="back-link" id="backToHome">← 分類にもどる</span>`;
  if (mode === 'search') {
    heading.innerHTML = `<span>「${escapeHtml(query.trim())}」の検索結果</span>${backLink}`;
  } else if (mode === 'category') {
    heading.innerHTML = `<span>${activeCat}類: ${NDC_LABELS[activeCat]}</span>${backLink}`;
  }
  const back = document.getElementById('backToHome');
  if (back) back.addEventListener('click', () => { mode = 'home'; activeCat = ''; loadBooks(); });

  if (books.length === 0) {
    area.innerHTML = '<div class="empty">該当する本が見つかりません。</div>';
    return;
  }

  books.forEach((b) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-top">
        <div>
          <div class="book-title">${escapeHtml(String(b.title || ''))}</div>
          <div class="book-meta">${escapeHtml(String(b.author || ''))} ・ ${escapeHtml(String(b.genre || ''))}</div>
        </div>
        ${b.ndc ? `<span class="ndc-pill">${escapeHtml(String(b.ndc))}</span>` : ''}
      </div>
      <button class="delete-btn">🗑 この本を削除</button>
    `;
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      const ok = window.confirm(`「${b.title}」を削除します。よろしいですか？`);
      if (!ok) return;
      const pin = askPin();
      if (!pin) return;
      try {
        const result = await callApi({ action: 'delete', id: b.id, pin });
        if (result && result.error === 'invalid_pin') {
          sessionPin = null;
          showError('合言葉が違います。もう一度お試しください。');
        } else {
          hideError();
        }
      } catch (e) {
        showError('削除に失敗しました。もう一度お試しください。');
      }
      await loadBooks();
    });
    area.appendChild(card);
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  query = e.target.value;
  document.getElementById('clearSearchBtn').style.display = query ? 'inline' : 'none';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    mode = query.trim() ? 'search' : 'home';
    loadBooks();
  }, 400);
});
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  mode = 'home';
  loadBooks();
});

document.getElementById('openAddFormBtn').addEventListener('click', () => {
  document.getElementById('addForm').classList.add('open');
  document.getElementById('openAddFormBtn').classList.add('hidden');
});
document.getElementById('closeAddFormBtn').addEventListener('click', () => {
  document.getElementById('addForm').classList.remove('open');
  document.getElementById('openAddFormBtn').classList.remove('hidden');
});
document.getElementById('addBookBtn').addEventListener('click', async () => {
  const title = document.getElementById('newTitle').value.trim();
  const author = document.getElementById('newAuthor').value.trim() || '不明';
  const genre = document.getElementById('newGenre').value.trim() || 'その他';
  const ndc = document.getElementById('newNdc').value.trim();
  if (!title) return;
  const pin = askPin();
  if (!pin) return;
  const btn = document.getElementById('addBookBtn');
  btn.disabled = true;
  btn.textContent = '追加中…';
  try {
    const result = await callApi({ action: 'add', title, author, genre, ndc, pin });
    if (result && result.error === 'invalid_pin') {
      sessionPin = null;
      showError('合言葉が違います。もう一度お試しください。');
    } else {
      hideError();
    }
  } catch (e) {
    showError('保存に失敗しました。もう一度お試しください。');
  }
  btn.disabled = false;
  btn.textContent = '追加する';
  document.getElementById('newTitle').value = '';
  document.getElementById('newAuthor').value = '';
  document.getElementById('newGenre').value = '';
  document.getElementById('newNdc').value = '';
  document.getElementById('addForm').classList.remove('open');
  document.getElementById('openAddFormBtn').classList.remove('hidden');
  if (mode !== 'home') await loadBooks();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

loadAnnouncements();
loadBooks();

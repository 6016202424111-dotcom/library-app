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

// ---- お気に入り(この端末だけのローカル保存) ----
const FAV_KEY = 'library-app-favs';
function favKeyOf(book) {
  return book.id ? String(book.id) : `t:${book.title}|a:${book.author}`;
}
function getFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
function isFav(book) {
  const key = favKeyOf(book);
  return getFavs().some((f) => favKeyOf(f) === key);
}
function toggleFav(book) {
  const favs = getFavs();
  const key = favKeyOf(book);
  const idx = favs.findIndex((f) => favKeyOf(f) === key);
  if (idx === -1) {
    favs.push(book);
  } else {
    favs.splice(idx, 1);
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}
document.getElementById('showFavsBtn').addEventListener('click', () => {
  mode = 'favorites';
  activeCat = '';
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  loadBooks();
});
document.getElementById('showRankingBtn').addEventListener('click', () => {
  mode = 'ranking';
  activeCat = '';
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  loadBooks();
});

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
  } catch (e) {}
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

  if (mode === 'favorites') {
    grid.style.display = 'none';
    heading.style.display = 'flex';
    books = getFavs();
    render();
    return;
  }

  if (mode === 'ranking') {
    grid.style.display = 'none';
    heading.style.display = 'flex';
    document.getElementById('listArea').innerHTML = '<div class="empty">読み込み中…</div>';
    try {
      const res = await fetch(`${API_URL}?ranking=1`, { cache: 'no-store' });
      const data = await res.json();
      books = Array.isArray(data) ? data : [];
      hideError();
    } catch (e) {
      showError('ランキングの取得に失敗しました。');
      books = [];
    }
    render();
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
  } else if (mode === 'favorites') {
    heading.innerHTML = `<span>❤️ お気に入り</span>${backLink}`;
  } else if (mode === 'ranking') {
    heading.innerHTML = `<span>🏆 いいねランキング</span>${backLink}`;
  }
  const back = document.getElementById('backToHome');
  if (back) back.addEventListener('click', () => { mode = 'home'; activeCat = ''; loadBooks(); });

  if (books.length === 0) {
    area.innerHTML = `<div class="empty">${mode === 'favorites' ? 'まだお気に入りがありません。' : mode === 'ranking' ? 'まだいいねがついた本がありません。' : '該当する本が見つかりません。'}</div>`;
    return;
  }

  books.forEach((b, idx) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    const favActive = isFav(b);
    const rankBadge = mode === 'ranking' ? `<span class="rank-badge">${idx + 1}位</span>` : '';
    card.innerHTML = `
      <div class="book-top">
        <div>
          ${rankBadge}
          <div class="book-title">${escapeHtml(String(b.title || ''))}</div>
          <div class="book-meta">${escapeHtml(String(b.author || ''))} ・ ${escapeHtml(String(b.genre || ''))}</div>
        </div>
        ${b.ndc ? `<span class="ndc-pill">${escapeHtml(String(b.ndc))}</span>` : ''}
      </div>
      <div class="card-actions">
        <button class="fav-btn ${favActive ? 'active' : ''}">${favActive ? '❤️' : '🤍'} お気に入り</button>
        <button class="like-btn">👍 いいね <span class="like-count">${Number(b.likes) || 0}</span></button>
      </div>
    `;

    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', () => {
      toggleFav({ id: b.id, title: b.title, author: b.author, genre: b.genre, ndc: b.ndc });
      const nowFav = isFav(b);
      favBtn.classList.toggle('active', nowFav);
      favBtn.innerHTML = `${nowFav ? '❤️' : '🤍'} お気に入り`;
      if (mode === 'favorites' && !nowFav) {
        loadBooks();
      }
    });

    const likeBtn = card.querySelector('.like-btn');
    likeBtn.addEventListener('click', async () => {
      likeBtn.disabled = true;
      try {
        const result = await callApi({ action: 'like', id: b.id });
        if (result && result.ok) {
          likeBtn.querySelector('.like-count').textContent = result.likes;
        }
      } catch (e) {
        // 通信エラー時は静かに無視
      }
      likeBtn.disabled = false;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

loadAnnouncements();
loadBooks();

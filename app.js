const API_URL = 'https://script.google.com/macros/s/AKfycbxSplON-1eRjJJv2fPYtaOJAdSdFQSN5DN749QZAh2BijkYKbpwK1nO2edMtktDX5U/exec';

const NDC = [
  { n: '0', label: '総記', emoji: '📚' },
  { n: '1', label: '哲学・宗教', emoji: '🧠' },
  { n: '2', label: '歴史・地理・伝記', emoji: '🏛️' },
  { n: '3', label: '社会科学', emoji: '⚖️' },
  { n: '4', label: '自然科学', emoji: '🔬' },
  { n: '5', label: '技術・工学・家政学', emoji: '⚙️' },
  { n: '6', label: '産業', emoji: '🏭' },
  { n: '7', label: '芸術・スポーツ', emoji: '🎨' },
  { n: '8', label: '言語', emoji: '🗣️' },
  { n: '9', label: '文学', emoji: '✒️' },
  { n: 'none', label: '分類なし', emoji: '❓' },
];

// NDCの十の位(2桁目)までの区分名。例: 291 → 「29」→地理・地誌・紀行
const NDC_DIVISIONS = {
  '00': '総記', '01': '図書館・図書館学', '02': '図書・書誌学', '03': '百科事典',
  '04': '一般論文集', '05': '逐次刊行物', '06': '団体', '07': 'ジャーナリズム・新聞',
  '08': '叢書', '09': '貴重書',
  '10': '哲学', '11': '哲学各論', '12': '東洋思想', '13': '西洋哲学', '14': '心理学',
  '15': '倫理・道徳', '16': '宗教', '17': '神道', '18': '仏教', '19': 'キリスト教',
  '20': '歴史', '21': '日本史', '22': 'アジア史・東洋史', '23': 'ヨーロッパ史・西洋史',
  '24': 'アフリカ史', '25': '北アメリカ史', '26': '南アメリカ史', '27': 'オセアニア史',
  '28': '伝記', '29': '地理・地誌・紀行',
  '30': '社会科学', '31': '政治', '32': '法律', '33': '経済', '34': '財政',
  '35': '統計', '36': '社会', '37': '教育', '38': '風俗習慣・民俗学', '39': '国防・軍事',
  '40': '自然科学', '41': '数学', '42': '物理学', '43': '化学', '44': '天文学・宇宙科学',
  '45': '地球科学・地学', '46': '生物科学', '47': '植物学', '48': '動物学', '49': '医学・薬学',
  '50': '技術・工学', '51': '建設工学・土木工学', '52': '建築学', '53': '機械工学',
  '54': '電気工学・電子工学', '55': '海洋工学・船舶工学', '56': '金属工学・鉱山工学',
  '57': '化学工業', '58': '製造工業', '59': '家政学・生活科学',
  '60': '産業', '61': '農業', '62': '園芸', '63': '蚕糸業', '64': '畜産業・獣医学',
  '65': '林業', '66': '水産業', '67': '商業', '68': '運輸・交通', '69': '通信事業',
  '70': '芸術・美術', '71': '彫刻', '72': '絵画・書道', '73': '版画', '74': '写真・印刷',
  '75': '工芸', '76': '音楽・舞踊', '77': '演劇・映画', '78': 'スポーツ・体育', '79': '諸芸・娯楽',
  '80': '言語', '81': '日本語', '82': '中国語', '83': '英語', '84': 'ドイツ語',
  '85': 'フランス語', '86': 'スペイン語', '87': 'イタリア語', '88': 'ロシア語', '89': 'その他の言語',
  '90': '文学', '91': '日本文学', '92': '中国文学', '93': '英米文学', '94': 'ドイツ文学',
  '95': 'フランス文学', '96': 'スペイン文学', '97': 'イタリア文学', '98': 'ロシア文学', '99': 'その他の文学',
};
function ndcDivisionLabel(ndc) {
  const digits = String(ndc || '').match(/\d{2,}/);
  if (!digits) return '';
  const key = digits[0].slice(0, 2);
  return NDC_DIVISIONS[key] || '';
}

let books = [];
let mode = 'home';
let query = '';
let activeCat = '';
let searchTimer = null;
let sessionPin = null;
let currentOffset = 0;
let hasMoreResults = false;
let currentSort = 'old';
let ndcCounts = null;

const LIKED_KEY = 'library-app-liked';
function getLikedIds() {
  try {
    return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
function isLiked(id) {
  return getLikedIds().includes(String(id));
}
function setLiked(id, liked) {
  const ids = getLikedIds();
  const idx = ids.indexOf(String(id));
  if (liked && idx === -1) ids.push(String(id));
  if (!liked && idx !== -1) ids.splice(idx, 1);
  localStorage.setItem(LIKED_KEY, JSON.stringify(ids));
}

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

// ---- 本ガチャ(1日1回) ----
const GACHA_KEY = 'library-app-gacha-history';
const GACHA_TODAY_KEY = 'library-app-gacha-today';
const FORTUNES = [
  { label: '大吉', weight: 5 },
  { label: '吉', weight: 20 },
  { label: '中吉', weight: 25 },
  { label: '小吉', weight: 25 },
  { label: '末吉', weight: 20 },
  { label: '凶(でも良書)', weight: 5 },
];
function pickFortune() {
  const total = FORTUNES.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of FORTUNES) {
    if (r < f.weight) return f.label;
    r -= f.weight;
  }
  return FORTUNES[0].label;
}
function todayStr2() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayGacha() {
  try {
    const raw = JSON.parse(localStorage.getItem(GACHA_TODAY_KEY) || 'null');
    if (raw && raw.date === todayStr2()) return raw;
  } catch (e) {}
  return null;
}
function saveTodayGacha(book, fortune) {
  const record = { date: todayStr2(), book, fortune };
  localStorage.setItem(GACHA_TODAY_KEY, JSON.stringify(record));
  try {
    const history = JSON.parse(localStorage.getItem(GACHA_KEY) || '[]');
    history.push({ id: book.id, title: book.title, author: book.author, ndc: book.ndc, drawnAt: new Date().toISOString() });
    localStorage.setItem(GACHA_KEY, JSON.stringify(history));
  } catch (e) {}
}
function renderGachaResult(book, fortune, alreadyDrawn) {
  const modal = document.getElementById('gachaModal');
  modal.innerHTML = `
    <div class="gacha-fortune">${fortune}</div>
    <div style="font-size:13px;color:#8A7B5C;">${alreadyDrawn ? '今日引いた本です' : '今日のあなたに引き当てられた本'}</div>
    <div class="gacha-book-title">${escapeHtml(String(book.title || ''))}</div>
    <div class="gacha-book-meta">${escapeHtml(String(book.author || ''))}${book.ndc ? ` ・ ${escapeHtml(String(book.ndc))}` : ''}</div>
    ${alreadyDrawn ? '<div style="font-size:12px;color:#8A7B5C;margin-top:6px;">本ガチャは1日1回です。また明日引けます。</div>' : ''}
    <button class="gacha-close-btn" id="gachaCloseBtn">閉じる</button>
  `;
  document.getElementById('gachaCloseBtn').addEventListener('click', () => {
    document.getElementById('gachaOverlay').classList.remove('open');
  });
}

document.getElementById('gachaBtn').addEventListener('click', async () => {
  const overlay = document.getElementById('gachaOverlay');
  const modal = document.getElementById('gachaModal');
  overlay.classList.add('open');

  const existing = getTodayGacha();
  if (existing) {
    renderGachaResult(existing.book, existing.fortune, true);
    return;
  }

  modal.innerHTML = `<div class="gacha-shuffling">🎴 シャッフル中…</div>`;
  try {
    const res = await fetch(`${API_URL}?gacha=1&r=${Date.now()}`, { cache: 'no-store' });
    const book = await res.json();
    await new Promise((r) => setTimeout(r, 600));
    if (!book || !book.id) {
      modal.innerHTML = `<div class="gacha-shuffling">本が見つかりませんでした。</div><button class="gacha-close-btn" id="gachaCloseBtn">閉じる</button>`;
      document.getElementById('gachaCloseBtn').addEventListener('click', () => overlay.classList.remove('open'));
      return;
    }
    const fortune = pickFortune();
    saveTodayGacha(book, fortune);
    renderGachaResult(book, fortune, false);
  } catch (e) {
    modal.innerHTML = `<div class="gacha-shuffling">通信に失敗しました。</div><button class="gacha-close-btn" id="gachaCloseBtn">閉じる</button>`;
    document.getElementById('gachaCloseBtn').addEventListener('click', () => overlay.classList.remove('open'));
  }
});

// ---- ガチャコレクション ----
function getGachaCollection() {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(GACHA_KEY) || '[]');
  } catch (e) {}
  const map = new Map();
  history.forEach((h) => {
    if (!map.has(h.id)) {
      map.set(h.id, { ...h, count: 1 });
    } else {
      map.get(h.id).count++;
    }
  });
  return Array.from(map.values());
}
document.getElementById('showCollectionBtn').addEventListener('click', () => {
  mode = 'collection';
  activeCat = '';
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  loadBooks();
});

// ---- 目的から探す(質問に答えて絞り込む) ----
const FINDER_GENRES = [
  { label: '物語・小説が読みたい', cat: '9' },
  { label: '歴史や地理、伝記に興味がある', cat: '2' },
  { label: '社会のしくみを知りたい', cat: '3' },
  { label: '科学や自然について知りたい', cat: '4' },
  { label: 'ものづくり・技術に興味がある', cat: '5' },
  { label: 'スポーツや芸術が好き', cat: '7' },
  { label: 'ことば・外国語に興味がある', cat: '8' },
  { label: '哲学や宗教、心について考えたい', cat: '1' },
  { label: '特にこだわらない', cat: '' },
];
const FINDER_MOODS = [
  '今はのんびりしたい気分',
  '元気や勇気がほしい気分',
  '新しい知識を深めたい気分',
  'ワクワク・冒険したい気分',
  '笑いたい・軽い気分で読みたい',
];
let finderMood = '';

function openFinder() {
  const overlay = document.getElementById('gachaOverlay');
  const modal = document.getElementById('gachaModal');
  overlay.classList.add('open');
  renderFinderStep1();
}
function renderFinderStep1() {
  const modal = document.getElementById('gachaModal');
  modal.innerHTML = `
    <div class="gacha-fortune" style="color:#2F6B52;">🧭 目的から探す</div>
    <div style="font-size:13px;color:#8A7B5C;margin-bottom:12px;">今の気分は？</div>
    <div class="finder-options" id="finderOptions"></div>
    <button class="gacha-close-btn" id="gachaCloseBtn" style="margin-top:14px;">閉じる</button>
  `;
  const opts = document.getElementById('finderOptions');
  FINDER_MOODS.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'finder-btn';
    btn.textContent = m;
    btn.addEventListener('click', () => {
      finderMood = m;
      renderFinderStep2();
    });
    opts.appendChild(btn);
  });
  document.getElementById('gachaCloseBtn').addEventListener('click', () => {
    document.getElementById('gachaOverlay').classList.remove('open');
  });
}
function renderFinderStep2() {
  const modal = document.getElementById('gachaModal');
  modal.innerHTML = `
    <div class="gacha-fortune" style="color:#2F6B52;">🧭 目的から探す</div>
    <div style="font-size:13px;color:#8A7B5C;margin-bottom:12px;">興味のある分野は？</div>
    <div class="finder-options" id="finderOptions"></div>
    <button class="gacha-close-btn" id="gachaCloseBtn" style="margin-top:14px;">閉じる</button>
  `;
  const opts = document.getElementById('finderOptions');
  FINDER_GENRES.forEach((g) => {
    const btn = document.createElement('button');
    btn.className = 'finder-btn';
    btn.textContent = g.label;
    btn.addEventListener('click', () => runFinder(g.cat));
    opts.appendChild(btn);
  });
  document.getElementById('gachaCloseBtn').addEventListener('click', () => {
    document.getElementById('gachaOverlay').classList.remove('open');
  });
}
async function runFinder(cat) {
  const modal = document.getElementById('gachaModal');
  modal.innerHTML = `<div class="gacha-shuffling">🔍 探しています…</div>`;
  try {
    const params = [`gacha=1`, `r=${Date.now()}`];
    if (cat) params.push(`cat=${encodeURIComponent(cat)}`);
    const res = await fetch(`${API_URL}?${params.join('&')}`, { cache: 'no-store' });
    const book = await res.json();
    await new Promise((r) => setTimeout(r, 500));
    if (!book || !book.id) {
      modal.innerHTML = `<div class="gacha-shuffling">該当する本が見つかりませんでした。</div><button class="gacha-close-btn" id="gachaCloseBtn">閉じる</button>`;
      document.getElementById('gachaCloseBtn').addEventListener('click', () => document.getElementById('gachaOverlay').classList.remove('open'));
      return;
    }
    modal.innerHTML = `
      <div class="gacha-fortune" style="color:#2F6B52;">あなたへのおすすめ</div>
      <div style="font-size:12.5px;color:#8A7B5C;">${escapeHtml(finderMood)}のあなたへ</div>
      <div class="gacha-book-title">${escapeHtml(String(book.title || ''))}</div>
      <div class="gacha-book-meta">${escapeHtml(String(book.author || ''))}${book.ndc ? ` ・ ${escapeHtml(String(book.ndc))}` : ''}</div>
      <button class="gacha-again-btn" id="finderAgainBtn">もう一度探す</button>
      <button class="gacha-close-btn" id="gachaCloseBtn">閉じる</button>
    `;
    document.getElementById('finderAgainBtn').addEventListener('click', () => renderFinderStep1());
    document.getElementById('gachaCloseBtn').addEventListener('click', () => document.getElementById('gachaOverlay').classList.remove('open'));
  } catch (e) {
    modal.innerHTML = `<div class="gacha-shuffling">通信に失敗しました。</div><button class="gacha-close-btn" id="gachaCloseBtn">閉じる</button>`;
    document.getElementById('gachaCloseBtn').addEventListener('click', () => document.getElementById('gachaOverlay').classList.remove('open'));
  }
}
document.getElementById('finderBtn').addEventListener('click', openFinder);
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
    const countText = ndcCounts && typeof ndcCounts[c.n] === 'number' ? `(${ndcCounts[c.n]}冊)` : '';
    btn.innerHTML = `<span class="emoji">${c.emoji}</span><span><span class="num">${c.n}類</span><span class="label">${c.label} ${countText}</span></span>`;
    btn.addEventListener('click', () => {
      mode = 'category';
      activeCat = c.n;
      loadBooks();
    });
    grid.appendChild(btn);
  });
}

async function loadNdcCounts() {
  try {
    const res = await fetch(`${API_URL}?counts=1`, { cache: 'no-store' });
    ndcCounts = await res.json();
    if (mode === 'home') renderNdcGrid();
  } catch (e) {
    // 冊数の取得に失敗しても、通常のブラウズには影響させない
  }
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

  if (mode === 'collection') {
    grid.style.display = 'none';
    heading.style.display = 'flex';
    books = getGachaCollection();
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
  currentOffset = 0;
  document.getElementById('listArea').innerHTML = '<div class="empty">読み込み中…</div>';

  try {
    const params = [];
    if (activeCat) params.push(`cat=${encodeURIComponent(activeCat)}`);
    if (query.trim()) params.push(`q=${encodeURIComponent(query.trim())}`);
    params.push(`sort=${currentSort}`);
    const url = `${API_URL}?${params.join('&')}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    books = Array.isArray(data.books) ? data.books : [];
    hasMoreResults = !!data.hasMore;
    hideError();
  } catch (e) {
    showError('データの取得に失敗しました。通信環境を確認してください。');
    books = [];
    hasMoreResults = false;
  }
  render();
}

async function loadMoreBooks() {
  currentOffset += 60;
  try {
    const params = [`offset=${currentOffset}`, `sort=${currentSort}`];
    if (activeCat) params.push(`cat=${encodeURIComponent(activeCat)}`);
    if (query.trim()) params.push(`q=${encodeURIComponent(query.trim())}`);
    const url = `${API_URL}?${params.join('&')}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    const more = Array.isArray(data.books) ? data.books : [];
    books = books.concat(more);
    hasMoreResults = !!data.hasMore;
  } catch (e) {
    showError('追加の読み込みに失敗しました。');
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
    const label = activeCat === 'none' ? '分類なし' : `${activeCat}類: ${NDC_LABELS[activeCat]}`;
    heading.innerHTML = `<span>${label}</span>${backLink}`;
  } else if (mode === 'favorites') {
    heading.innerHTML = `<span>❤️ お気に入り</span>${backLink}`;
  } else if (mode === 'collection') {
    heading.innerHTML = `<span>🎴 コレクション(${books.length}冊)</span>${backLink}`;
  } else if (mode === 'ranking') {
    heading.innerHTML = `<span>🏆 いいねランキング</span>${backLink}`;
  }
  const back = document.getElementById('backToHome');
  if (back) back.addEventListener('click', () => {
    mode = 'home';
    activeCat = '';
    query = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    loadBooks();
  });

  if (mode === 'search' || mode === 'category') {
    const sortWrap = document.createElement('div');
    sortWrap.className = 'sort-row';
    sortWrap.innerHTML = `
      <select id="sortSelect">
        <option value="old" ${currentSort === 'old' ? 'selected' : ''}>登録が古い順</option>
        <option value="new" ${currentSort === 'new' ? 'selected' : ''}>登録が新しい順</option>
        <option value="likes" ${currentSort === 'likes' ? 'selected' : ''}>いいねが多い順</option>
      </select>
    `;
    area.appendChild(sortWrap);
    document.getElementById('sortSelect').addEventListener('change', (e) => {
      currentSort = e.target.value;
      loadBooks();
    });
  }

  if (books.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty';
    emptyDiv.textContent = mode === 'favorites' ? 'まだお気に入りがありません。' : mode === 'ranking' ? 'まだいいねがついた本がありません。' : mode === 'collection' ? 'まだガチャを引いていません。' : '該当する本が見つかりません。';
    area.appendChild(emptyDiv);
    return;
  }

  books.forEach((b, idx) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    const favActive = isFav(b);
    const rankBadge = mode === 'ranking' ? `<span class="rank-badge">${idx + 1}位</span>` : mode === 'collection' ? `<span class="rank-badge">${b.count}回GET</span>` : '';
    card.innerHTML = `
      <div class="book-top">
        <div>
          ${rankBadge}
          <div class="book-title">${escapeHtml(String(b.title || ''))}</div>
          <div class="book-meta">${escapeHtml(String(b.author || ''))} ・ ${escapeHtml(String(b.genre || ''))}</div>
        </div>
        ${b.ndc ? `<span class="ndc-pill">${escapeHtml(String(b.ndc))}${ndcDivisionLabel(b.ndc) ? `<br>(${ndcDivisionLabel(b.ndc)})` : ''}</span>` : ''}
      </div>
      <div class="card-actions">
        <button class="fav-btn ${favActive ? 'active' : ''}">${favActive ? '❤️' : '🤍'} お気に入り</button>
        <button class="like-btn ${isLiked(b.id) ? 'active' : ''}">${isLiked(b.id) ? '👍' : '👍🏻'} いいね <span class="like-count">${Number(b.likes) || 0}</span></button>
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
      const alreadyLiked = isLiked(b.id);
      const action = alreadyLiked ? 'unlike' : 'like';
      try {
        const result = await callApi({ action, id: b.id });
        if (result && result.ok) {
          likeBtn.querySelector('.like-count').textContent = result.likes;
          setLiked(b.id, !alreadyLiked);
          likeBtn.classList.toggle('active', !alreadyLiked);
          likeBtn.innerHTML = `${!alreadyLiked ? '👍' : '👍🏻'} いいね <span class="like-count">${result.likes}</span>`;
          hideError();
        } else {
          showError(`いいねに失敗しました(理由: ${result && result.error ? result.error : '不明'})`);
        }
      } catch (e) {
        showError('いいねの通信に失敗しました。');
      }
      likeBtn.disabled = false;
    });

    area.appendChild(card);
  });

  if (hasMoreResults && (mode === 'search' || mode === 'category')) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'load-more-btn';
    moreBtn.textContent = 'もっと見る';
    moreBtn.addEventListener('click', async () => {
      moreBtn.disabled = true;
      moreBtn.textContent = '読み込み中…';
      await loadMoreBooks();
    });
    area.appendChild(moreBtn);
  }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  query = e.target.value;
  document.getElementById('clearSearchBtn').style.display = query ? 'inline' : 'none';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (activeCat) {
      mode = 'category';
    } else {
      mode = query.trim() ? 'search' : 'home';
    }
    loadBooks();
  }, 400);
});
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  mode = activeCat ? 'category' : 'home';
  loadBooks();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

loadAnnouncements();
loadBooks();
loadNdcCounts();

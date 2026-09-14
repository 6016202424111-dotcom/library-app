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
function

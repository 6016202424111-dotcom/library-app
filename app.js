const API_URL = 'https://script.google.com/macros/s/AKfycbxSplON-1eRjJJv2fPYtaOJAdSdFQSN5DN749QZAh2BijkYKbpwK1nO2edMtktDX5U/exec';

const NDC_LABELS = {
  '0': '総記', '1': '哲学', '2': '歴史', '3': '社会科学', '4': '自然科学',
  '5': '技術・工学', '6': '産業', '7': '芸術', '8': '言語', '9': '文学',
};

let books = [];
let mode = 'home'; // 'home' | 'search' | 'category'
let query = '';
let activeCat = '';
let searchTimer = null;
let sessionPin = null;

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

function renderNdcGrid() {
  const grid = document.getElementById('ndcGrid');
  grid.innerHTML = '';
  Object.keys(NDC_LABELS).forEach((num) => {
    const btn = document.createElement('button');
    btn.className = 'ndc-btn' + (mode === 'category' && activeCat === num ? ' active' : '');
    btn.innerHTML = `<span class="num">${num}類</span><span class="label">${NDC_LABELS[num]}</span>`;
    btn.addEventListener('click', () => {
      mode = 'category';
      activeCat = num;
      query = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('clearSearchBtn').style.display = 'none';
      loadBooks();
    });
    grid.appendChild(btn);
  });
}

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
    let url;
    if (mode === 'search') {
      url = `${API_URL}?q=${encodeURIComponent(query.trim())}`;
    } else {
      url = `${API_URL}?cat=${encodeURIComponent(activeCat)}`;
    }
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

async function callApi(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return res.json();
}

function askPin() {
  if (sessionPin) return sessionPin;
  const p = window.prompt('合言葉(PIN)を入力してください');
  sessionPin = p;
  return p;
}

function render() {
  const area = document.getElementById('listArea');
  const heading = document.getElementById('listHeading');
  area.innerHTML = '';

  const backLink = `<span class="back-link" id="backToHome">← 分類にもどる</span>`;
  if (mode === 'search') {
    heading.innerHTML = `<span>「${escapeHtml(query.trim())}」の検索結果</span>${backLink}`;
  } else if (mode === 'category') {
    heading.innerHTML = `<span>${activeCat}類: ${NDC_LABELS[activeCat]}</span>${backLink}`;
  }
  const back = document.getElementById('backToHome');
  if (back) {
    back.addEventListener('click', () => {
      mode = 'home';
      activeCat = '';
      loadBooks();
    });
  }

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

    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
      const ok = window.confirm(`「${b.title}」を削除します。よろしいですか？`);
      if (!ok) return;
      const pin = askPin();
      if (!pin) return;
      deleteBtn.disabled = true;
      deleteBtn.textContent = '削除中…';
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
    if (query.trim()) {
      mode = 'search';
      loadBooks();
    } else {
      mode = 'home';
      loadBooks();
    }
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

loadBooks();

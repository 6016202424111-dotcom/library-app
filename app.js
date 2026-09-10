const API_URL = 'https://script.google.com/macros/s/AKfycbxSplON-1eRjJJv2fPYtaOJAdSdFQSN5DN749QZAh2BijkYKbpwK1nO2edMtktDX5U/exec';

let books = [];
let query = '';
let borrowingId = null;
let searchTimer = null;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
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

async function loadBooks() {
  document.getElementById('listArea').innerHTML = '<div class="empty">読み込み中…</div>';
  try {
    const url = query.trim() ? `${API_URL}?q=${encodeURIComponent(query.trim())}` : API_URL;
    const res = await fetch(url);
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
  });
  return res.json();
}

function render() {
  const area = document.getElementById('listArea');
  area.innerHTML = '';
  const today = todayStr();
  const heading = document.getElementById('listHeading');

  if (query.trim()) {
    heading.textContent = `「${query.trim()}」の検索結果`;
  } else {
    heading.textContent = '現在貸出中の本';
  }

  if (books.length === 0) {
    area.innerHTML = `<div class="empty">${query.trim() ? '該当する本が見つかりません。' : '現在、貸出中の本はありません。'}</div>`;
    return;
  }

  books.forEach((b) => {
    const overdue = b.status === 'borrowed' && b.dueDate && b.dueDate < today;
    const card = document.createElement('div');
    card.className = 'book-card';

    let pillClass = 'status-available';
    let pillText = '在架';
    if (b.status === 'borrowed') {
      pillClass = overdue ? 'status-overdue' : 'status-borrowed';
      pillText = overdue ? '返却期限切れ' : '貸出中';
    }

    let actionHtml = '';
    if (b.status !== 'borrowed') {
      if (borrowingId === b.id) {
        actionHtml = `
          <div class="confirm-row">
            <input type="date" class="due-input" value="${defaultDueDate()}" />
            <button class="confirm-btn">確定</button>
          </div>`;
      } else {
        actionHtml = `<button class="borrow-btn">貸し出す</button>`;
      }
    } else {
      actionHtml = `<button class="return-btn">↺ 返却する</button>`;
    }

    card.innerHTML = `
      <div class="book-top">
        <div>
          <div class="book-title">${escapeHtml(String(b.title || ''))}</div>
          <div class="book-meta">${escapeHtml(String(b.author || ''))} ・ ${escapeHtml(String(b.genre || ''))}</div>
        </div>
        <span class="status-pill ${pillClass}">${pillText}</span>
      </div>
      ${b.status === 'borrowed' && b.dueDate ? `<div class="due-date">返却予定日: ${b.dueDate}</div>` : ''}
      <div class="action-row">${actionHtml}</div>
      <button class="delete-btn">🗑 この本を削除</button>
    `;

    const borrowBtn = card.querySelector('.borrow-btn');
    if (borrowBtn) borrowBtn.addEventListener('click', () => { borrowingId = b.id; render(); });

    const confirmBtn = card.querySelector('.confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const dueInput = card.querySelector('.due-input').value;
        confirmBtn.disabled = true;
        confirmBtn.textContent = '処理中…';
        try {
          await callApi({ action: 'borrow', id: b.id, dueDate: dueInput });
          hideError();
        } catch (e) {
          showError('保存に失敗しました。もう一度お試しください。');
        }
        borrowingId = null;
        await loadBooks();
      });
    }

    const returnBtn = card.querySelector('.return-btn');
    if (returnBtn) {
      returnBtn.addEventListener('click', async () => {
        returnBtn.disabled = true;
        returnBtn.textContent = '処理中…';
        try {
          await callApi({ action: 'return', id: b.id });
          hideError();
        } catch (e) {
          showError('保存に失敗しました。もう一度お試しください。');
        }
        await loadBooks();
      });
    }

    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const ok = window.confirm(`「${b.title}」を削除します。よろしいですか？`);
        if (!ok) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = '削除中…';
        try {
          await callApi({ action: 'delete', id: b.id });
          hideError();
        } catch (e) {
          showError('削除に失敗しました。もう一度お試しください。');
        }
        await loadBooks();
      });
    }

    area.appendChild(card);
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  query = e.target.value;
  document.getElementById('clearSearchBtn').style.display = query ? 'inline' : 'none';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { loadBooks(); }, 400);
});
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
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
  if (!title) return;
  const btn = document.getElementById('addBookBtn');
  btn.disabled = true;
  btn.textContent = '追加中…';
  try {
    await callApi({ action: 'add', title, author, genre });
    hideError();
  } catch (e) {
    showError('保存に失敗しました。もう一度お試しください。');
  }
  btn.disabled = false;
  btn.textContent = '追加する';
  document.getElementById('newTitle').value = '';
  document.getElementById('newAuthor').value = '';
  document.getElementById('newGenre').value = '';
  document.getElementById('addForm').classList.remove('open');
  document.getElementById('openAddFormBtn').classList.remove('hidden');
  await loadBooks();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

loadBooks();

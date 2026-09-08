// ============================================
// My Bookshelf — データ管理とロジック
// ============================================

const STORAGE_BOOKS = 'mybookshelf_books';
const STORAGE_IMPRESSIONS = 'mybookshelf_impressions';

let state = {
  activeShelf: 'unread',
  currentBookId: null,
  pendingStars: 0,
  pendingTag: null,
};

// ---------- localStorage 読み書き ----------

function loadBooks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_BOOKS)) || [];
  } catch {
    return [];
  }
}

function saveBooks(books) {
  localStorage.setItem(STORAGE_BOOKS, JSON.stringify(books));
}

function loadImpressions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_IMPRESSIONS)) || [];
  } catch {
    return [];
  }
}

function saveImpressions(impressions) {
  localStorage.setItem(STORAGE_IMPRESSIONS, JSON.stringify(impressions));
}

// ---------- 要素参照 ----------

const shelfEl = document.getElementById('shelf');
const emptyStateEl = document.getElementById('emptyState');
const shelfTabsEl = document.getElementById('shelfTabs');

const searchPanel = document.getElementById('searchPanel');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchResultsEl = document.getElementById('searchResults');
const searchHint = document.getElementById('searchHint');

const detailPanel = document.getElementById('detailPanel');
const detailCover = document.getElementById('detailCover');
const detailTitle = document.getElementById('detailTitle');
const detailAuthor = document.getElementById('detailAuthor');
const detailDate = document.getElementById('detailDate');
const detailActions = document.getElementById('detailActions');
const impressionListEl = document.getElementById('impressionList');
const noImpressionHint = document.getElementById('noImpressionHint');

const impressionPanel = document.getElementById('impressionPanel');
const starPicker = document.getElementById('starPicker');
const tagPicker = document.getElementById('tagPicker');
const saveImpressionBtn = document.getElementById('saveImpressionBtn');

// ---------- パネルの開閉 ----------

function openPanel(panel) {
  panel.hidden = false;
}

function closePanel(panel) {
  panel.hidden = true;
}

document.querySelectorAll('[data-close-panel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    closePanel(btn.closest('.panel'));
  });
});

// ---------- 本棚の描画 ----------

function renderShelf() {
  const books = loadBooks().filter((b) => b.status === state.activeShelf);
  shelfEl.innerHTML = '';

  if (books.length === 0) {
    emptyStateEl.hidden = false;
  } else {
    emptyStateEl.hidden = true;
    books.forEach((book) => {
      const spine = document.createElement('button');
      spine.className = 'book-spine';
      spine.innerHTML = `<span>${escapeHtml(book.title)}</span>`;
      spine.addEventListener('click', () => openDetail(book.id));
      shelfEl.appendChild(spine);
    });
  }
}

shelfTabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
  tab.classList.add('is-active');
  state.activeShelf = tab.dataset.status;
  renderShelf();
});

// ---------- 検索（Google Books API） ----------

document.getElementById('openSearchBtn').addEventListener('click', () => {
  searchResultsEl.innerHTML = '';
  searchHint.hidden = false;
  searchInput.value = '';
  openPanel(searchPanel);
  searchInput.focus();
});

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  searchHint.hidden = false;
  searchHint.textContent = '検索中…';
  searchResultsEl.innerHTML = '';

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`
    );
    const data = await res.json();
    renderSearchResults(data.items || []);
  } catch (err) {
    searchHint.textContent = '検索に失敗しました。通信環境を確認してもう一度お試しください。';
  }
});

function renderSearchResults(items) {
  searchResultsEl.innerHTML = '';

  if (items.length === 0) {
    searchHint.hidden = false;
    searchHint.textContent = '該当する本が見つかりませんでした。別のキーワードで試してください。';
    return;
  }

  searchHint.hidden = true;
  const registeredIds = new Set(loadBooks().map((b) => b.id));

  items.forEach((item) => {
    const info = item.volumeInfo || {};
    const li = document.createElement('li');
    li.className = 'result-item';

    const cover = info.imageLinks?.thumbnail || '';
    const alreadyAdded = registeredIds.has(item.id);

    li.innerHTML = `
      <img class="result-cover" src="${cover}" alt="">
      <div class="result-info">
        <p class="result-title">${escapeHtml(info.title || 'タイトル不明')}</p>
        <p class="result-author">${escapeHtml((info.authors || []).join(', ') || '著者不明')}</p>
      </div>
      <button class="btn-signup" ${alreadyAdded ? 'disabled' : ''}>
        ${alreadyAdded ? '登録済み' : 'sign up'}
      </button>
    `;

    const btn = li.querySelector('.btn-signup');
    if (!alreadyAdded) {
      btn.addEventListener('click', () => {
        registerBook(item.id, info);
        btn.disabled = true;
        btn.textContent = '登録済み';
      });
    }

    searchResultsEl.appendChild(li);
  });
}

function registerBook(id, info) {
  const books = loadBooks();
  books.push({
    id,
    title: info.title || 'タイトル不明',
    author: (info.authors || []).join(', ') || '著者不明',
    cover: info.imageLinks?.thumbnail || '',
    status: 'unread',
    addedDate: new Date().toISOString(),
  });
  saveBooks(books);

  if (state.activeShelf === 'unread') {
    renderShelf();
  }
}

// ---------- 本の詳細 ----------

function openDetail(bookId) {
  const book = loadBooks().find((b) => b.id === bookId);
  if (!book) return;

  state.currentBookId = bookId;

  detailCover.src = book.cover;
  detailTitle.textContent = book.title;
  detailAuthor.textContent = book.author;
  detailDate.textContent = `登録日：${formatDate(book.addedDate)}`;

  detailActions.querySelectorAll('.btn-status').forEach((btn) => {
    btn.classList.toggle('is-current', btn.dataset.setStatus === book.status);
  });

  renderImpressions(bookId);
  openPanel(detailPanel);
}

detailActions.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-status');
  if (!btn) return;

  const books = loadBooks();
  const book = books.find((b) => b.id === state.currentBookId);
  if (!book) return;

  book.status = btn.dataset.setStatus;
  saveBooks(books);

  detailActions.querySelectorAll('.btn-status').forEach((b) => {
    b.classList.toggle('is-current', b === btn);
  });
  renderShelf();
});

function renderImpressions(bookId) {
  const impressions = loadImpressions()
    .filter((imp) => imp.bookId === bookId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  impressionListEl.innerHTML = '';

  if (impressions.length === 0) {
    noImpressionHint.hidden = false;
    return;
  }

  noImpressionHint.hidden = true;
  impressions.forEach((imp) => {
    const li = document.createElement('li');
    li.className = 'impression-item';
    li.innerHTML = `
      <p class="impression-stars">${'★'.repeat(imp.stars)}${'☆'.repeat(5 - imp.stars)}</p>
      <p class="impression-tag">${escapeHtml(imp.tag)}</p>
      <p class="impression-date">${formatDate(imp.date)}</p>
    `;
    impressionListEl.appendChild(li);
  });
}

// ---------- 感想を記録する ----------

document.getElementById('leaveImpressionBtn').addEventListener('click', () => {
  state.pendingStars = 0;
  state.pendingTag = null;
  updateStarDisplay();
  tagPicker.querySelectorAll('.tag-option').forEach((t) => t.classList.remove('is-selected'));
  saveImpressionBtn.disabled = true;
  openPanel(impressionPanel);
});

starPicker.addEventListener('click', (e) => {
  const star = e.target.closest('.star');
  if (!star) return;
  state.pendingStars = Number(star.dataset.value);
  updateStarDisplay();
  updateSaveButtonState();
});

function updateStarDisplay() {
  starPicker.querySelectorAll('.star').forEach((star) => {
    star.classList.toggle('is-filled', Number(star.dataset.value) <= state.pendingStars);
  });
}

tagPicker.addEventListener('click', (e) => {
  const tag = e.target.closest('.tag-option');
  if (!tag) return;
  tagPicker.querySelectorAll('.tag-option').forEach((t) => t.classList.remove('is-selected'));
  tag.classList.add('is-selected');
  state.pendingTag = tag.dataset.tag;
  updateSaveButtonState();
});

function updateSaveButtonState() {
  saveImpressionBtn.disabled = !(state.pendingStars > 0 && state.pendingTag);
}

saveImpressionBtn.addEventListener('click', () => {
  const impressions = loadImpressions();
  impressions.push({
    bookId: state.currentBookId,
    stars: state.pendingStars,
    tag: state.pendingTag,
    date: new Date().toISOString(),
  });
  saveImpressions(impressions);

  closePanel(impressionPanel);
  renderImpressions(state.currentBookId);
});

// ---------- ユーティリティ ----------

function formatDate(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- 初期描画 ----------

renderShelf();

// ============================================
// My Bookshelf — データ管理とロジック
// ============================================

const STORAGE_BOOKS = 'mybookshelf_books';
const STORAGE_IMPRESSIONS = 'mybookshelf_impressions';

let state = {
  activeShelf: 'unread',
  currentBookId: null,
  pendingStars: 0,
  pendingQ1Index: null,
  pendingQ2Index: null,
  pendingQ3Index: null,
  pendingNote: '',
  editingImpressionId: null,
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

// 旧バージョン（多言語対応前）は q1/q2/q3 に日本語のテキストをそのまま
// 保存していた。日本語ツリーと照合してインデックスに変換しておくことで、
// 過去に記録した感想も他言語に切り替えたときに正しく表示できるようにする。
function migrateImpression(imp) {
  if (imp.q1Index !== undefined && imp.q1Index !== null) return imp;
  if (!imp.q1) return imp;

  const jaTree = IMPRESSION_TREE_ALL.ja;
  const q1Index = jaTree.findIndex((b) => b.label === imp.q1);
  if (q1Index === -1) return imp;

  const branch = jaTree[q1Index];
  const q2Index = imp.q2 ? branch.options.findIndex((o) => o.label === imp.q2) : -1;
  let q3Index = -1;
  if (q2Index !== -1 && imp.q3) {
    q3Index = branch.options[q2Index].options.findIndex((o) => o === imp.q3);
  }

  return {
    ...imp,
    q1Index,
    q2Index: q2Index === -1 ? null : q2Index,
    q3Index: q3Index === -1 ? null : q3Index,
  };
}

function loadImpressions() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_IMPRESSIONS)) || [];
    return raw.map(migrateImpression);
  } catch {
    return [];
  }
}

function saveImpressions(impressions) {
  localStorage.setItem(STORAGE_IMPRESSIONS, JSON.stringify(impressions));
}

function generateId() {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- 要素参照 ----------

const shelfEl = document.getElementById('shelf');
const emptyStateEl = document.getElementById('emptyState');
const shelfTabsEl = document.getElementById('shelfTabs');

const homeDashboard = document.getElementById('homeDashboard');
const backHomeBtn = document.getElementById('backHomeBtn');
const recentBooksList = document.getElementById('recentBooksList');
const noRecentBooksEl = document.getElementById('noRecentBooks');

const unreadCount = document.getElementById('unreadCount');
const readingCount = document.getElementById('readingCount');
const finishedCount = document.getElementById('finishedCount');

const searchPanel = document.getElementById('searchPanel');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchResultsEl = document.getElementById('searchResults');
const searchHint = document.getElementById('searchHint');

const detailPanel = document.getElementById('detailPanel');
const detailCover = document.getElementById('detailCover');
const deleteBookBtn = document.getElementById('deleteBookBtn');
const detailTitle = document.getElementById('detailTitle');
const detailAuthor = document.getElementById('detailAuthor');
const detailDate = document.getElementById('detailDate');
const detailActions = document.getElementById('detailActions');
const impressionListEl = document.getElementById('impressionList');
const noImpressionHint = document.getElementById('noImpressionHint');

const impressionPanel = document.getElementById('impressionPanel');
const impressionPanelTitle = document.getElementById('impressionPanelTitle');
const starPicker = document.getElementById('starPicker');
const q1Picker = document.getElementById('q1Picker');
const q2Block = document.getElementById('q2Block');
const q3Block = document.getElementById('q3Block');
const freeTextBlock = document.getElementById('freeTextBlock');
const freeTextInput = document.getElementById('freeTextInput');
const freeTextCount = document.getElementById('freeTextCount');
const saveImpressionBtn = document.getElementById('saveImpressionBtn');

const langSwitch = document.getElementById('langSwitch');

// ---------- 多言語表示の更新 ----------

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  langSwitch.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.lang === getLang());
  });
  document.documentElement.lang = getLang();
}

function refreshDynamicView() {
  // 開いている画面に応じて、翻訳が必要な動的テキストを再描画する
  if (!homeDashboard.hidden) {
    renderHome();
  }
  if (!shelfEl.hidden) {
    renderShelf();
  }
  if (!detailPanel.hidden && state.currentBookId) {
    const book = loadBooks().find((b) => b.id === state.currentBookId);
    if (book) {
      detailDate.textContent = `${t('addedOn')}${formatDate(book.addedDate)}`;
    }
    renderImpressions(state.currentBookId);
  }
  if (!impressionPanel.hidden) {
    rebuildQ1Picker();
    if (state.pendingQ1Index !== null) {
      renderQ2(state.pendingQ1Index);
      if (state.pendingQ2Index !== null) {
        renderQ3(state.pendingQ1Index, state.pendingQ2Index);
      }
    }
  }
  // 検索結果が表示中なら、ボタンのラベルだけ翻訳し直す
  searchResultsEl.querySelectorAll('.btn-signup').forEach((btn) => {
    btn.textContent = btn.disabled ? t('addedLabel') : t('signUpButton');
  });
}

langSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-btn');
  if (!btn) return;
  setLang(btn.dataset.lang);
  applyStaticTranslations();
  refreshDynamicView();
});

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

function renderHome() {
  const books = loadBooks();

  const unreadBooks = books.filter((book) => book.status === 'unread');
  const readingBooks = books.filter((book) => book.status === 'reading');
  const finishedBooks = books.filter((book) => book.status === 'finished');

  unreadCount.textContent = formatCount(unreadBooks.length);
  readingCount.textContent = formatCount(readingBooks.length);
  finishedCount.textContent = formatCount(finishedBooks.length);

  renderRecentBooks();
}

// 本ごとに最新の感想日付を1つだけ求め、新しい順に直近5冊を表示する。
// クリックするとその本の詳細画面が開く。
function renderRecentBooks() {
  const books = loadBooks();
  const impressions = loadImpressions();

  // 本ごとに、一番新しい感想の日付だけを残す
  const latestDateByBook = new Map();
  impressions.forEach((imp) => {
    const current = latestDateByBook.get(imp.bookId);
    if (!current || new Date(imp.date) > new Date(current)) {
      latestDateByBook.set(imp.bookId, imp.date);
    }
  });

  const recentBooks = [...latestDateByBook.entries()]
    .map(([bookId, date]) => ({ book: books.find((b) => b.id === bookId), date }))
    .filter((entry) => entry.book)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  recentBooksList.innerHTML = '';

  if (recentBooks.length === 0) {
    noRecentBooksEl.hidden = false;
    return;
  }

  noRecentBooksEl.hidden = true;

  recentBooks.forEach(({ book, date }) => {
    const li = document.createElement('li');
    li.className = 'recent-book-item';
    li.innerHTML = `
      <span class="recent-book-date">${formatDate(date)}</span>
      <span class="recent-book-title">${escapeHtml(book.title)}</span>
    `;
    li.addEventListener('click', () => openDetail(book.id));
    recentBooksList.appendChild(li);
  });
}

document.querySelectorAll('[data-open-shelf]').forEach((button) => {
  button.addEventListener('click', () => {
    const status = button.dataset.openShelf;

    state.activeShelf = status;

    homeDashboard.hidden = true;
    shelfTabsEl.hidden = false;
    shelfEl.hidden = false;
    backHomeBtn.hidden = false;

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.status === status);
    });

    renderShelf();
  });
});

backHomeBtn.addEventListener('click', () => {
  homeDashboard.hidden = false;
  backHomeBtn.hidden = true;
  shelfTabsEl.hidden = true;
  shelfEl.hidden = true;
  emptyStateEl.hidden = true;

  renderHome();
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
  document.querySelectorAll('.tab').forEach((el) => el.classList.remove('is-active'));
  tab.classList.add('is-active');
  state.activeShelf = tab.dataset.status;
  renderShelf();
});

// ---------- 検索（Google Books API） ----------

document.getElementById('openSearchBtn').addEventListener('click', () => {
  searchResultsEl.innerHTML = '';
  searchHint.hidden = false;
  searchHint.textContent = t('searchHintDefault');
  searchInput.value = '';
  openPanel(searchPanel);
  searchInput.focus();
});

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  searchHint.hidden = false;
  searchHint.textContent = t('searching');
  searchResultsEl.innerHTML = '';

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=AIzaSyA7MtgZSbBxmJ5_H7OrkmSPidTvPAuR75A`
    );
    const data = await res.json();
    renderSearchResults(data.items || []);
  } catch (err) {
    searchHint.textContent = t('searchFailed');
  }
});

function renderSearchResults(items) {
  searchResultsEl.innerHTML = '';

  if (items.length === 0) {
    searchHint.hidden = false;
    searchHint.textContent = t('noResults');
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
        <p class="result-title">${escapeHtml(info.title || t('unknownTitle'))}</p>
        <p class="result-author">${escapeHtml((info.authors || []).join(', ') || t('unknownAuthor'))}</p>
      </div>
      <button class="btn-signup" ${alreadyAdded ? 'disabled' : ''}>
        ${alreadyAdded ? t('addedLabel') : t('signUpButton')}
      </button>
    `;

    const btn = li.querySelector('.btn-signup');
    if (!alreadyAdded) {
      btn.addEventListener('click', () => {
        registerBook(item.id, info);
        btn.disabled = true;
        btn.textContent = t('addedLabel');
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
  detailDate.textContent = `${t('addedOn')}${formatDate(book.addedDate)}`;

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
  const tree = getTree();
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
    const branch = imp.q1Index !== null && imp.q1Index !== undefined ? tree[imp.q1Index] : null;
    const q2 = branch && imp.q2Index !== null && imp.q2Index !== undefined ? branch.options[imp.q2Index] : null;
    const q3 = q2 && imp.q3Index !== null && imp.q3Index !== undefined ? q2.options[imp.q3Index] : null;

    const q1Label = branch ? branch.label : (imp.q1 || '');
    const q2Label = q2 ? q2.label : (imp.q2 || '');
    const q3Label = q3 || imp.q3 || '';

    const li = document.createElement('li');
    li.className = 'impression-item';
    const pathText = [q2Label, q3Label].filter(Boolean).join(' ／ ');
    li.innerHTML = `
      <p class="impression-stars">${'★'.repeat(imp.stars)}${'☆'.repeat(5 - imp.stars)}</p>
      <p class="impression-tag">${escapeHtml(q1Label)}</p>
      ${pathText ? `<p class="impression-path">${escapeHtml(pathText)}</p>` : ''}
      ${imp.note ? `<p class="impression-note">${escapeHtml(imp.note)}</p>` : ''}
      <p class="impression-date">${formatDate(imp.date)}</p>
      <div class="impression-item-actions">
        <button class="btn-edit" data-edit-id="${imp.id}">${t('edit')}</button>
        <button class="btn-delete" data-delete-id="${imp.id}">${t('delete')}</button>
      </div>
    `;
    impressionListEl.appendChild(li);
  });
}

impressionListEl.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit-id]');
  const deleteBtn = e.target.closest('[data-delete-id]');

  if (editBtn) {
    openImpressionEditor(editBtn.dataset.editId);
  }

  if (deleteBtn) {
    const ok = window.confirm(t('confirmDeleteImpression'));
    if (!ok) return;
    const impressions = loadImpressions().filter((imp) => imp.id !== deleteBtn.dataset.deleteId);
    saveImpressions(impressions);
    renderImpressions(state.currentBookId);
  }
});

// ---------- 感想を記録する（星→Q1→Q2→Q3の分岐） ----------

document.getElementById('leaveImpressionBtn').addEventListener('click', () => {
  startImpressionFlow();
});

function rebuildQ1Picker() {
  const tree = getTree();
  q1Picker.innerHTML = tree
    .map((branch, index) => `<button class="tag-option" data-q1-index="${index}">${escapeHtml(branch.label)}</button>`)
    .join('');

  q1Picker.querySelectorAll('.tag-option').forEach((btn) => {
    btn.classList.toggle('is-selected', Number(btn.dataset.q1Index) === state.pendingQ1Index);
  });
}

function startImpressionFlow() {
  state.editingImpressionId = null;
  state.pendingStars = 0;
  state.pendingQ1Index = null;
  state.pendingQ2Index = null;
  state.pendingQ3Index = null;

  impressionPanelTitle.textContent = t('recordImpression');
  updateStarDisplay();
  rebuildQ1Picker();
  q2Block.innerHTML = '';
  q3Block.innerHTML = '';
  freeTextBlock.hidden = true;
  freeTextInput.value = '';
  freeTextCount.textContent = '0';
  updateSaveButtonState();
  openPanel(impressionPanel);
}

function openImpressionEditor(impressionId) {
  const imp = loadImpressions().find((i) => i.id === impressionId);
  if (!imp) return;

  state.editingImpressionId = imp.id;
  state.pendingStars = imp.stars;
  state.pendingQ1Index = imp.q1Index !== undefined ? imp.q1Index : null;
  state.pendingQ2Index = imp.q2Index !== undefined ? imp.q2Index : null;
  state.pendingQ3Index = imp.q3Index !== undefined ? imp.q3Index : null;
  state.pendingNote = imp.note || '';

  impressionPanelTitle.textContent = t('editImpression');
  updateStarDisplay();
  freeTextInput.value = state.pendingNote;
  freeTextCount.textContent = String(state.pendingNote.length);

  rebuildQ1Picker();

  const tree = getTree();
  if (state.pendingQ1Index !== null && tree[state.pendingQ1Index]) {
    renderQ2(state.pendingQ1Index);
    if (state.pendingQ2Index !== null) {
      renderQ3(state.pendingQ1Index, state.pendingQ2Index);
    }
  } else {
    q2Block.innerHTML = '';
    q3Block.innerHTML = '';
  }

  freeTextBlock.hidden = state.pendingQ3Index === null;

  updateSaveButtonState();
  openPanel(impressionPanel);
}

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

q1Picker.addEventListener('click', (e) => {
  const tag = e.target.closest('.tag-option');
  if (!tag) return;

  q1Picker.querySelectorAll('.tag-option').forEach((el) => el.classList.remove('is-selected'));
  tag.classList.add('is-selected');

  state.pendingQ1Index = Number(tag.dataset.q1Index);
  state.pendingQ2Index = null;
  state.pendingQ3Index = null;
  q3Block.innerHTML = '';
  freeTextBlock.hidden = true;

  renderQ2(state.pendingQ1Index);

  updateSaveButtonState();
});

function renderQ2(q1Index) {
  const branch = getTree()[q1Index];
  if (!branch) {
    q2Block.innerHTML = '';
    return;
  }

  q2Block.innerHTML = `
    <p class="field-label">${escapeHtml(branch.q2Question)}</p>
    <div class="tag-picker" id="q2Picker">
      ${branch.options.map((opt, index) => `<button class="tag-option" data-q2-index="${index}">${escapeHtml(opt.label)}</button>`).join('')}
    </div>
  `;

  const q2PickerEl = document.getElementById('q2Picker');
  q2PickerEl.querySelectorAll('.tag-option').forEach((btn) => {
    btn.classList.toggle('is-selected', Number(btn.dataset.q2Index) === state.pendingQ2Index);
  });

  q2PickerEl.addEventListener('click', (e) => {
    const tag = e.target.closest('.tag-option');
    if (!tag) return;

    q2PickerEl.querySelectorAll('.tag-option').forEach((el) => el.classList.remove('is-selected'));
    tag.classList.add('is-selected');

    state.pendingQ2Index = Number(tag.dataset.q2Index);
    state.pendingQ3Index = null;
    freeTextBlock.hidden = true;
    renderQ3(q1Index, state.pendingQ2Index);
    updateSaveButtonState();
  });
}

function renderQ3(q1Index, q2Index) {
  const branch = getTree()[q1Index];
  const q2 = branch ? branch.options[q2Index] : null;
  if (!q2) {
    q3Block.innerHTML = '';
    return;
  }

  q3Block.innerHTML = `
    <p class="field-label">${escapeHtml(q2.question)}</p>
    <div class="tag-picker" id="q3Picker">
      ${q2.options.map((opt, index) => `<button class="tag-option" data-q3-index="${index}">${escapeHtml(opt)}</button>`).join('')}
    </div>
  `;

  const q3PickerEl = document.getElementById('q3Picker');
  q3PickerEl.querySelectorAll('.tag-option').forEach((btn) => {
    btn.classList.toggle('is-selected', Number(btn.dataset.q3Index) === state.pendingQ3Index);
  });

  q3PickerEl.addEventListener('click', (e) => {
    const tag = e.target.closest('.tag-option');
    if (!tag) return;

    q3PickerEl.querySelectorAll('.tag-option').forEach((el) => el.classList.remove('is-selected'));
    tag.classList.add('is-selected');

    state.pendingQ3Index = Number(tag.dataset.q3Index);
    freeTextBlock.hidden = false;
    updateSaveButtonState();
  });
}

function updateSaveButtonState() {
  const complete = state.pendingStars > 0
    && state.pendingQ1Index !== null
    && state.pendingQ2Index !== null
    && state.pendingQ3Index !== null;
  saveImpressionBtn.disabled = !complete;
}

freeTextInput.addEventListener('input', () => {
  state.pendingNote = freeTextInput.value;
  freeTextCount.textContent = String(freeTextInput.value.length);
});

saveImpressionBtn.addEventListener('click', () => {
  const impressions = loadImpressions();
  const note = freeTextInput.value.trim().slice(0, 50);

  if (state.editingImpressionId) {
    const target = impressions.find((imp) => imp.id === state.editingImpressionId);
    if (target) {
      target.stars = state.pendingStars;
      target.q1Index = state.pendingQ1Index;
      target.q2Index = state.pendingQ2Index;
      target.q3Index = state.pendingQ3Index;
      delete target.q1;
      delete target.q2;
      delete target.q3;
      target.note = note;
    }
  } else {
    impressions.push({
      id: generateId(),
      bookId: state.currentBookId,
      stars: state.pendingStars,
      q1Index: state.pendingQ1Index,
      q2Index: state.pendingQ2Index,
      q3Index: state.pendingQ3Index,
      note,
      date: new Date().toISOString(),
    });
  }

  saveImpressions(impressions);
  closePanel(impressionPanel);
  renderImpressions(state.currentBookId);
});

deleteBookBtn.addEventListener('click', () => {
  const confirmed = confirm(t('confirmDeleteBook'));

  if (!confirmed) {
    return;
  }
  const books = loadBooks().filter(
    (book) => book.id !== state.currentBookId
  );

  saveBooks(books);

  const impressions = loadImpressions().filter(
    (impression) => impression.bookId !== state.currentBookId
  );

  saveImpressions(impressions);

  closePanel(detailPanel);
  state.currentBookId = null;

  renderShelf();
});


// ---------- ユーティリティ ----------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- 初期描画 ----------

applyStaticTranslations();
renderHome();

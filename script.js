// ============================================
// My Bookshelf — データ管理とロジック
// ============================================

const STORAGE_BOOKS = 'mybookshelf_books';
const STORAGE_IMPRESSIONS = 'mybookshelf_impressions';

let state = {
  activeShelf: 'unread',
  currentBookId: null,
  pendingStars: 0,
  pendingQ1: null,
  pendingQ2: null,
  pendingQ3: null,
  editingImpressionId: null,
};

// ---------- 感想の分岐質問データ ----------
// 「心に残った」ルートのみ確定済み。他の答えはチームで質問内容が決まり次第、
// 同じ形式でここに追加する。

const IMPRESSION_TREE = {
  '心に残った': [
    {
      id: 'story',
      label: '物語の展開・ストーリー',
      question: 'その展開の、どんなところに惹かれましたか？',
      options: ['予想外の展開だった', '伏線が回収された', 'テンポの良さ', '緻密な構成', '危機を乗り越える過程', '複数の視点が交差する構成'],
    },
    {
      id: 'character',
      label: '登場人物の心情・生き方',
      question: 'その人物の、どんなところに惹かれましたか？',
      options: ['弱さや葛藤に共感した', '強さや芯の通った生き方', '変化・成長する姿', '自分と似た価値観', '自分にはない生き方への憧れ', '人との向き合い方'],
    },
    {
      id: 'writing',
      label: '文章・言葉の表現',
      question: 'どんな表現が印象に残りましたか？',
      options: ['情景描写の美しさ', '心情描写の繊細さ', '印象的な一文・フレーズ', 'リズムの良い文体', '比喩や言葉選びの巧みさ', '余白のある静かな文章'],
    },
    {
      id: 'ending',
      label: '結末・ラストシーン',
      question: '結末に、どう感じましたか？',
      options: ['予想を裏切られた', '静かに余韻が残った', 'すっきり報われた', 'あえて解決しない終わり方', '続きを想像したくなる', '涙が出た'],
    },
    {
      id: 'experience',
      label: '自分の経験と重なった',
      question: 'どんな経験と重なりましたか？',
      options: ['人間関係の悩み', '将来への不安', '大切な人との別れ', '挑戦した経験', '日常のささいな出来事', '過去の後悔'],
    },
    {
      id: 'theme',
      label: 'テーマ・伝えたいメッセージ',
      question: 'どんなメッセージを受け取りましたか？',
      options: ['生きることの意味', '人とのつながりの大切さ', '挑戦することの価値', '過去との向き合い方', '自分らしさとは何か', '当たり前の日常のありがたさ'],
    },
  ],
  // '学びがあった', '楽しかった', 'また読み返したい', '期待と違った', (6つ目・未定)
  // は今後チームで内容が決まり次第、同じ形式で追加する
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

function generateId() {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
const impressionPanelTitle = document.getElementById('impressionPanelTitle');
const starPicker = document.getElementById('starPicker');
const q1Picker = document.getElementById('q1Picker');
const q2Block = document.getElementById('q2Block');
const q3Block = document.getElementById('q3Block');
const branchPendingHint = document.getElementById('branchPendingHint');
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
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=AIzaSyA7MtgZSbBxmJ5_H7OrkmSPidTvPAuR75A`
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
    const pathText = [imp.q1, imp.q2, imp.q3].filter(Boolean).join(' ／ ');
    li.innerHTML = `
      <p class="impression-stars">${'★'.repeat(imp.stars)}${'☆'.repeat(5 - imp.stars)}</p>
      <p class="impression-tag">${escapeHtml(imp.q1 || '')}</p>
      ${pathText ? `<p class="impression-path">${escapeHtml(pathText)}</p>` : ''}
      <p class="impression-date">${formatDate(imp.date)}</p>
      <div class="impression-item-actions">
        <button class="btn-edit" data-edit-id="${imp.id}">編集</button>
        <button class="btn-delete" data-delete-id="${imp.id}">削除</button>
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
    const ok = window.confirm('この感想を削除しますか？');
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

function startImpressionFlow() {
  state.editingImpressionId = null;
  state.pendingStars = 0;
  state.pendingQ1 = null;
  state.pendingQ2 = null;
  state.pendingQ3 = null;

  impressionPanelTitle.textContent = '感想を記録';
  updateStarDisplay();
  q1Picker.querySelectorAll('.tag-option').forEach((t) => t.classList.remove('is-selected'));
  q2Block.innerHTML = '';
  q3Block.innerHTML = '';
  branchPendingHint.hidden = true;
  updateSaveButtonState();
  openPanel(impressionPanel);
}

function openImpressionEditor(impressionId) {
  const imp = loadImpressions().find((i) => i.id === impressionId);
  if (!imp) return;

  state.editingImpressionId = imp.id;
  state.pendingStars = imp.stars;
  state.pendingQ1 = imp.q1 || null;
  state.pendingQ2 = imp.q2 || null;
  state.pendingQ3 = imp.q3 || null;

  impressionPanelTitle.textContent = '感想を編集';
  updateStarDisplay();

  q1Picker.querySelectorAll('.tag-option').forEach((t) => {
    t.classList.toggle('is-selected', t.dataset.q1 === state.pendingQ1);
  });

  if (state.pendingQ1 && IMPRESSION_TREE[state.pendingQ1]) {
    renderQ2(state.pendingQ1);
    if (state.pendingQ2) {
      renderQ3(state.pendingQ1, state.pendingQ2);
    }
  } else {
    q2Block.innerHTML = '';
    q3Block.innerHTML = '';
    branchPendingHint.hidden = state.pendingQ1 ? false : true;
  }

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

  q1Picker.querySelectorAll('.tag-option').forEach((t) => t.classList.remove('is-selected'));
  tag.classList.add('is-selected');

  state.pendingQ1 = tag.dataset.q1;
  state.pendingQ2 = null;
  state.pendingQ3 = null;
  q3Block.innerHTML = '';

  if (IMPRESSION_TREE[state.pendingQ1]) {
    branchPendingHint.hidden = true;
    renderQ2(state.pendingQ1);
  } else {
    q2Block.innerHTML = '';
    branchPendingHint.hidden = false;
  }

  updateSaveButtonState();
});

function renderQ2(q1Value) {
  const options = IMPRESSION_TREE[q1Value];
  q2Block.innerHTML = `
    <p class="field-label">特に、どんな部分が${escapeHtml(q1Value)}ましたか？</p>
    <div class="tag-picker" id="q2Picker">
      ${options.map((opt) => `<button class="tag-option" data-q2="${escapeHtml(opt.label)}">${escapeHtml(opt.label)}</button>`).join('')}
    </div>
  `;

  const q2Picker = document.getElementById('q2Picker');
  q2Picker.querySelectorAll('.tag-option').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.q2 === state.pendingQ2);
  });

  q2Picker.addEventListener('click', (e) => {
    const tag = e.target.closest('.tag-option');
    if (!tag) return;

    q2Picker.querySelectorAll('.tag-option').forEach((t) => t.classList.remove('is-selected'));
    tag.classList.add('is-selected');

    state.pendingQ2 = tag.dataset.q2;
    state.pendingQ3 = null;
    renderQ3(q1Value, state.pendingQ2);
    updateSaveButtonState();
  });
}

function renderQ3(q1Value, q2Label) {
  const branch = IMPRESSION_TREE[q1Value].find((opt) => opt.label === q2Label);
  if (!branch) {
    q3Block.innerHTML = '';
    return;
  }

  q3Block.innerHTML = `
    <p class="field-label">${escapeHtml(branch.question)}</p>
    <div class="tag-picker" id="q3Picker">
      ${branch.options.map((opt) => `<button class="tag-option" data-q3="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
    </div>
  `;

  const q3Picker = document.getElementById('q3Picker');
  q3Picker.querySelectorAll('.tag-option').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.q3 === state.pendingQ3);
  });

  q3Picker.addEventListener('click', (e) => {
    const tag = e.target.closest('.tag-option');
    if (!tag) return;

    q3Picker.querySelectorAll('.tag-option').forEach((t) => t.classList.remove('is-selected'));
    tag.classList.add('is-selected');

    state.pendingQ3 = tag.dataset.q3;
    updateSaveButtonState();
  });
}

function updateSaveButtonState() {
  const complete = state.pendingStars > 0 && state.pendingQ1 && state.pendingQ2 && state.pendingQ3;
  saveImpressionBtn.disabled = !complete;
}

saveImpressionBtn.addEventListener('click', () => {
  const impressions = loadImpressions();

  if (state.editingImpressionId) {
    const target = impressions.find((imp) => imp.id === state.editingImpressionId);
    if (target) {
      target.stars = state.pendingStars;
      target.q1 = state.pendingQ1;
      target.q2 = state.pendingQ2;
      target.q3 = state.pendingQ3;
    }
  } else {
    impressions.push({
      id: generateId(),
      bookId: state.currentBookId,
      stars: state.pendingStars,
      q1: state.pendingQ1,
      q2: state.pendingQ2,
      q3: state.pendingQ3,
      date: new Date().toISOString(),
    });
  }

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

// ============================================
// My Bookshelf — データ管理とロジック
// ============================================

import { auth, db } from './firebase-init.js';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUid = null;
let booksCache = [];
let impressionsCache = [];

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

// ---------- Firestoreとの読み書き ----------
// 画面描画は同期的な配列操作のままにしたいので、ログイン時に一度
// Firestoreから全件読み込んでキャッシュ配列(booksCache / impressionsCache)を作り、
// 以降の読み取りはこのキャッシュを見る。書き込み操作のたびに、
// キャッシュとFirestoreの両方を更新する。

function loadBooks() {
  return booksCache;
}

function loadImpressions() {
  return impressionsCache;
}

function generateId() {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ログイン確認後にindex.htmlから呼び出す初期化処理。
// ユーザーの本棚・感想データをFirestoreから読み込んでから、最初の描画を行う。
export async function initApp(uid) {
  currentUid = uid;

  const [booksSnap, impressionsSnap] = await Promise.all([
    getDocs(query(collection(db, 'userBooks'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'impressions'), where('uid', '==', uid))),
  ]);

  booksCache = booksSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id,
      title: data.title,
      author: data.author,
      cover: data.cover,
      status: data.status,
      addedDate: data.addedDate,
    };
  });

  impressionsCache = impressionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  applyStaticTranslations();
  await refreshRecommendations();
  renderHome();
}


// ---------- 要素参照 ----------

const shelfEl = document.getElementById('shelf');
const emptyStateEl = document.getElementById('emptyState');
const shelfTabsEl = document.getElementById('shelfTabs');

const homeDashboard = document.getElementById('homeDashboard');
const backHomeBtn = document.getElementById('backHomeBtn');
const recentBooksList = document.getElementById('recentBooksList');
const noRecentBooksEl = document.getElementById('noRecentBooks');
const recommendedList = document.getElementById('recommendedList');
const noRecommendedHint = document.getElementById('noRecommendedHint');

const unreadCount = document.getElementById('unreadCount');
const readingCount = document.getElementById('readingCount');
const finishedCount = document.getElementById('finishedCount');

const searchPanel = document.getElementById('searchPanel');
const searchForm = document.getElementById('searchForm');
const titleInput = document.getElementById('titleInput');
const authorInput = document.getElementById('authorInput');
const keywordInput = document.getElementById('keywordInput');
const searchButton = document.getElementById('searchButton');
const searchResultsEl = document.getElementById('searchResults');
const searchHint = document.getElementById('searchHint');

function updateSearchButton() {
  const hasTitle = titleInput.value.trim() !== '';
  const hasAuthor = authorInput.value.trim() !== '';
  const hasKeyword = keywordInput.value.trim() !== '';

  searchButton.disabled = !(hasTitle || hasAuthor || hasKeyword);
}

titleInput.addEventListener('input', updateSearchButton);
authorInput.addEventListener('input', updateSearchButton);
keywordInput.addEventListener('input', updateSearchButton);

const detailPanel = document.getElementById('detailPanel');
const detailCover = document.getElementById('detailCover');
const deleteBookBtn = document.getElementById('deleteBookBtn');
const detailTitle = document.getElementById('detailTitle');
const detailAuthor = document.getElementById('detailAuthor');
const detailDate = document.getElementById('detailDate');
const detailActions = document.getElementById('detailActions');
const impressionListEl = document.getElementById('impressionList');
const noImpressionHint = document.getElementById('noImpressionHint');
const viewSharedBtn = document.getElementById('viewSharedBtn');
const sharedImpressionsPanel = document.getElementById('sharedImpressionsPanel');
const sharedImpressionList = document.getElementById('sharedImpressionList');
const noSharedImpressionHint = document.getElementById('noSharedImpressionHint');

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
  renderRecommendationsList();
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

const GOOGLE_BOOKS_API_KEY = 'AIzaSyA1LzbC_Px9kIVyDw8KBhOw0EZ66icACFI';


document.getElementById('openSearchBtn').addEventListener('click', () => {
  searchResultsEl.innerHTML = '';
  searchHint.hidden = false;

  titleInput.value = '';
  authorInput.value = '';
  keywordInput.value = '';

  updateSearchButton();

  openPanel(searchPanel);
  titleInput.focus();
});

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  const keyword = keywordInput.value.trim();

  const queryParts = [];

  if (title) {
    queryParts.push(`intitle:${title}`);
  }

  if (author) {
    queryParts.push(`inauthor:${author}`);
  }

  if (keyword) {
    queryParts.push(keyword);
  }

  const searchQuery = queryParts.join(' ');

  if (!searchQuery) return;

  searchHint.hidden = false;
  searchHint.textContent = t('searching');
  searchResultsEl.innerHTML = '';

  try {
    const res = await fetch(
  `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=40&key=${GOOGLE_BOOKS_API_KEY}`
);

    const data = await res.json();
    renderSearchResults(data.items || []);
  } catch (err) {
    searchHint.textContent =
      t('searchFailed');
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
      btn.addEventListener('click', async () => {
        await registerBook(item.id, info);
        btn.disabled = true;
        btn.textContent = t('addedLabel');
      });
    }

    searchResultsEl.appendChild(li);
  });
}

async function registerBook(id, info) {
  const book = {
    id,
    title: info.title || 'タイトル不明',
    author: (info.authors || []).join(', ') || '著者不明',
    cover: info.imageLinks?.thumbnail || '',
    status: 'unread',
    addedDate: new Date().toISOString(),
  };

  await setDoc(doc(db, 'userBooks', `${currentUid}_${id}`), {
    uid: currentUid,
    ...book,
  });

  booksCache.push(book);

  if (state.activeShelf === 'unread') {
    renderShelf();
  }
}

// ---------- おすすめの本（趣味が近い人の評価をもとに） ----------
// アルゴリズム:
// 1. 自分の感想を本ごとに平均し、平均★4以上の本を「自分が好きな本」とする
// 2. その本について、他の人が共有した感想（shared:true）を集め、
//    その人ごとの平均が★4以上なら「趣味が近い人」とみなす
// 3. 趣味が近い人たちが共有している、自分がまだ持っていない本のうち、
//    平均★4以上のものを、その人数が多い順におすすめとして表示する
// 4. 本の情報（タイトル・著者・表紙）はFirestoreではなくGoogle Books APIから直接取得する
//    （他人のuserBooksは読む権限がないため）

let recommendedBooks = [];

function averageStarsByBook(impressionsList) {
  const totals = new Map();
  impressionsList.forEach((imp) => {
    if (!totals.has(imp.bookId)) totals.set(imp.bookId, { sum: 0, count: 0 });
    const entry = totals.get(imp.bookId);
    entry.sum += imp.stars;
    entry.count += 1;
  });
  const averages = new Map();
  totals.forEach((v, bookId) => averages.set(bookId, v.sum / v.count));
  return averages;
}

async function computeRecommendations() {
  const myAverages = averageStarsByBook(impressionsCache);
  const myLikedBookIds = [...myAverages.entries()]
    .filter(([, avg]) => avg >= 4)
    .map(([bookId]) => bookId);

  if (myLikedBookIds.length === 0) return [];

  const myBookIdSet = new Set(booksCache.map((b) => b.id));

  // 趣味が近い人（自分が好きな本を、同じく高く評価している人）を集める
  const similarUids = new Set();
  for (const bookId of myLikedBookIds) {
    let snap;
    try {
      snap = await getDocs(
        query(collection(db, 'impressions'), where('bookId', '==', bookId), where('shared', '==', true))
      );
    } catch {
      continue;
    }

    const byUser = new Map();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.uid === currentUid) return;
      if (!byUser.has(data.uid)) byUser.set(data.uid, []);
      byUser.get(data.uid).push(data.stars);
    });

    byUser.forEach((starsArr, uid) => {
      const avg = starsArr.reduce((a, b) => a + b, 0) / starsArr.length;
      if (avg >= 4) similarUids.add(uid);
    });
  }

  if (similarUids.size === 0) return [];

  // 趣味が近い人たちが高評価している、自分がまだ持っていない本を集める
  const candidateScores = new Map();
  for (const uid of similarUids) {
    let snap;
    try {
      snap = await getDocs(
        query(collection(db, 'impressions'), where('uid', '==', uid), where('shared', '==', true))
      );
    } catch {
      continue;
    }

    const byBook = new Map();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (myBookIdSet.has(data.bookId)) return;
      if (!byBook.has(data.bookId)) byBook.set(data.bookId, []);
      byBook.get(data.bookId).push(data.stars);
    });

    byBook.forEach((starsArr, bookId) => {
      const avg = starsArr.reduce((a, b) => a + b, 0) / starsArr.length;
      if (avg < 4) return;
      if (!candidateScores.has(bookId)) candidateScores.set(bookId, { count: 0, avgSum: 0 });
      const entry = candidateScores.get(bookId);
      entry.count += 1;
      entry.avgSum += avg;
    });
  }

  const ranked = [...candidateScores.entries()]
    .map(([bookId, { count, avgSum }]) => ({ bookId, count, avgAvg: avgSum / count }))
    .sort((a, b) => b.count - a.count || b.avgAvg - a.avgAvg)
    .slice(0, 5);

  const results = [];
  for (const { bookId } of ranked) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${bookId}?key=${GOOGLE_BOOKS_API_KEY}`
      );
      const data = await res.json();
      if (data.volumeInfo) {
        results.push({ id: bookId, info: data.volumeInfo });
      }
    } catch {
      // 取得に失敗した本はスキップする
    }
  }
  return results;
}

async function refreshRecommendations() {
  recommendedBooks = await computeRecommendations();
}

function renderRecommendationsList() {
  if (!recommendedList) return;
  recommendedList.innerHTML = '';

  if (recommendedBooks.length === 0) {
    noRecommendedHint.hidden = false;
    return;
  }

  noRecommendedHint.hidden = true;
  const registeredIds = new Set(loadBooks().map((b) => b.id));

  recommendedBooks
    .filter((rec) => !registeredIds.has(rec.id))
    .forEach((rec) => {
      const info = rec.info;
      const cover = info.imageLinks?.thumbnail || '';
      const title = info.title || t('unknownTitle');
      const author = (info.authors || []).join(', ') || t('unknownAuthor');

      const li = document.createElement('li');
      li.className = 'recommend-item';
      li.innerHTML = `
        <img class="recommend-cover" src="${cover}" alt="">
        <div class="recommend-info">
          <p class="recommend-title">${escapeHtml(title)}</p>
          <p class="recommend-author">${escapeHtml(author)}</p>
        </div>
        <button class="btn-signup">${t('signUpButton')}</button>
      `;

      const btn = li.querySelector('.btn-signup');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await registerBook(rec.id, info);
        renderRecommendationsList();
      });

      recommendedList.appendChild(li);
    });
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

detailActions.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-status');
  if (!btn) return;

  const book = booksCache.find((b) => b.id === state.currentBookId);
  if (!book) return;

  const newStatus = btn.dataset.setStatus;
  book.status = newStatus;

  detailActions.querySelectorAll('.btn-status').forEach((b) => {
    b.classList.toggle('is-current', b === btn);
  });
  renderShelf();

  await updateDoc(doc(db, 'userBooks', `${currentUid}_${book.id}`), { status: newStatus });
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
        <button class="btn-share ${imp.shared ? 'is-shared' : ''}" data-share-id="${imp.id}">${imp.shared ? '共有中' : '共有する'}</button>
        <button class="btn-edit" data-edit-id="${imp.id}">${t('edit')}</button>
        <button class="btn-delete" data-delete-id="${imp.id}">${t('delete')}</button>
      </div>
    `;
    impressionListEl.appendChild(li);
  });
}

impressionListEl.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-id]');
  const deleteBtn = e.target.closest('[data-delete-id]');
  const shareBtn = e.target.closest('[data-share-id]');

  if (editBtn) {
    openImpressionEditor(editBtn.dataset.editId);
  }

  if (deleteBtn) {
    const ok = window.confirm(t('confirmDeleteImpression'));
    if (!ok) return;
    const impId = deleteBtn.dataset.deleteId;
    impressionsCache = impressionsCache.filter((imp) => imp.id !== impId);
    renderImpressions(state.currentBookId);
    await deleteDoc(doc(db, 'impressions', impId));
  }

  if (shareBtn) {
    const impId = shareBtn.dataset.shareId;
    const imp = impressionsCache.find((i) => i.id === impId);
    if (!imp) return;

    const newShared = !imp.shared;
    shareBtn.disabled = true;
    try {
      await updateDoc(doc(db, 'impressions', impId), { shared: newShared });
      imp.shared = newShared;
      renderImpressions(state.currentBookId);
    } finally {
      shareBtn.disabled = false;
    }
  }
});

// ---------- 感想を記録する（星→Q1→Q2→Q3の分岐） ----------

document.getElementById('leaveImpressionBtn').addEventListener('click', () => {
  startImpressionFlow();
});

// ---------- 他の人が共有した感想を見る ----------
// ユーザー名は毎回読み込むと無駄が多いので、一度取得したらキャッシュしておく。
const profileCache = new Map();

async function getProfileCached(uid) {
  if (profileCache.has(uid)) return profileCache.get(uid);
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.exists() ? snap.data() : null;
  profileCache.set(uid, data);
  return data;
}

async function renderSharedImpressions(bookId) {
  sharedImpressionList.innerHTML = '';
  noSharedImpressionHint.hidden = true;

  const snap = await getDocs(
    query(collection(db, 'impressions'), where('bookId', '==', bookId), where('shared', '==', true))
  );

  const others = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((imp) => imp.uid !== currentUid)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (others.length === 0) {
    noSharedImpressionHint.hidden = false;
    return;
  }

  const tree = getTree();

  for (const imp of others) {
    const profile = await getProfileCached(imp.uid);
    const username = profile ? profile.username : '（不明なユーザー）';

    const branch = imp.q1Index !== null && imp.q1Index !== undefined ? tree[imp.q1Index] : null;
    const q2 = branch && imp.q2Index !== null && imp.q2Index !== undefined ? branch.options[imp.q2Index] : null;
    const q3 = q2 && imp.q3Index !== null && imp.q3Index !== undefined ? q2.options[imp.q3Index] : null;
    const q1Label = branch ? branch.label : '';
    const pathText = [q2 ? q2.label : '', q3 || ''].filter(Boolean).join(' ／ ');

    const li = document.createElement('li');
    li.className = 'impression-item';
    li.innerHTML = `
      <p class="impression-author">${escapeHtml(username)}</p>
      <p class="impression-stars">${'★'.repeat(imp.stars)}${'☆'.repeat(5 - imp.stars)}</p>
      <p class="impression-tag">${escapeHtml(q1Label)}</p>
      ${pathText ? `<p class="impression-path">${escapeHtml(pathText)}</p>` : ''}
      ${imp.note ? `<p class="impression-note">${escapeHtml(imp.note)}</p>` : ''}
      <p class="impression-date">${formatDate(imp.date)}</p>
    `;
    sharedImpressionList.appendChild(li);
  }
}

viewSharedBtn.addEventListener('click', async () => {
  openPanel(sharedImpressionsPanel);
  await renderSharedImpressions(state.currentBookId);
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

saveImpressionBtn.addEventListener('click', async () => {
  const note = freeTextInput.value.trim().slice(0, 50);
  const bookId = state.currentBookId;
  const payload = {
    stars: state.pendingStars,
    q1Index: state.pendingQ1Index,
    q2Index: state.pendingQ2Index,
    q3Index: state.pendingQ3Index,
    note,
  };

  saveImpressionBtn.disabled = true;

  if (state.editingImpressionId) {
    await updateDoc(doc(db, 'impressions', state.editingImpressionId), payload);
    const target = impressionsCache.find((imp) => imp.id === state.editingImpressionId);
    if (target) Object.assign(target, payload);
  } else {
    const fullPayload = { ...payload, uid: currentUid, bookId, date: new Date().toISOString(), shared: false };
    const docRef = await addDoc(collection(db, 'impressions'), fullPayload);
    impressionsCache.push({ id: docRef.id, ...fullPayload });
  }

  closePanel(impressionPanel);
  renderImpressions(bookId);

  await refreshRecommendations();
  if (!homeDashboard.hidden) {
    renderRecommendationsList();
  }
});

deleteBookBtn.addEventListener('click', async () => {
  const confirmed = confirm(t('confirmDeleteBook'));

  if (!confirmed) {
    return;
  }

  const bookId = state.currentBookId;

  booksCache = booksCache.filter((book) => book.id !== bookId);
  const removedImpressionIds = impressionsCache
    .filter((imp) => imp.bookId === bookId)
    .map((imp) => imp.id);
  impressionsCache = impressionsCache.filter((imp) => imp.bookId !== bookId);

  closePanel(detailPanel);
  state.currentBookId = null;
  renderShelf();

  await deleteDoc(doc(db, 'userBooks', `${currentUid}_${bookId}`));
  await Promise.all(
    removedImpressionIds.map((impId) => deleteDoc(doc(db, 'impressions', impId)))
  );
});


// ---------- ユーティリティ ----------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

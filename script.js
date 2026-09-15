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
function loadBooks() {
  return booksCache;
}

function loadImpressions() {
  return impressionsCache;
}

function generateId() {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
  renderHome();

  refreshRecommendations().then(() => {
    if (!homeDashboard.hidden) {
      renderRecommendationsList();
      renderPopularList();
    }
  });
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
const popularList = document.getElementById('popularList');
const noPopularHint = document.getElementById('noPopularHint');

const unreadCount = document.getElementById('unreadCount');
const readingCount = document.getElementById('readingCount');
const finishedCount = document.getElementById('finishedCount');

const searchPanel = document.getElementById('searchPanel');
const searchForm = document.getElementById('searchForm');
const titleInput = document.getElementById('titleInput');
const authorInput = document.getElementById('authorInput');
const keywordInput = document.getElementById('keywordInput');
const advancedSearchToggle = document.getElementById('advancedSearchToggle');
const advancedSearchFields = document.getElementById('advancedSearchFields');

const genreInput = document.getElementById('genreInput');
const decadeInput = document.getElementById('decadeInput');
const languageInput = document.getElementById('languageInput');
const searchButton = document.getElementById('searchButton');
const searchResultsEl = document.getElementById('searchResults');
const searchHint = document.getElementById('searchHint');

function updateSearchButton() {
  const hasTitle = titleInput.value.trim() !== '';
  const hasAuthor = authorInput.value.trim() !== '';
  const hasKeyword = keywordInput.value.trim() !== '';

  const hasGenre = genreInput.value !== '';
  const hasDecade = decadeInput.value !== '';
  const hasLanguage = languageInput.value !== '';

  searchButton.disabled = !(
    hasTitle ||
    hasAuthor ||
    hasKeyword ||
    hasGenre ||
    hasDecade ||
    hasLanguage
  );
}

titleInput.addEventListener('input', updateSearchButton);
authorInput.addEventListener('input', updateSearchButton);
keywordInput.addEventListener('input', updateSearchButton);
genreInput.addEventListener('change', updateSearchButton);
decadeInput.addEventListener('change', updateSearchButton);
languageInput.addEventListener('change', updateSearchButton);
advancedSearchToggle.addEventListener('click', () => {
  advancedSearchFields.hidden = !advancedSearchFields.hidden;

  if (advancedSearchFields.hidden) {
    advancedSearchToggle.textContent = '詳細検索 ▼';
  } else {
    advancedSearchToggle.textContent = '詳細検索 ▲';
  }
});

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
  renderPopularList();
}

function renderRecentBooks() {
  const books = loadBooks();
  const impressions = loadImpressions();

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
    .slice(0, 10);

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
  const books = loadBooks().filter(
    (b) => b.status === state.activeShelf
  );

  shelfEl.innerHTML = '';

  if (books.length === 0) {
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;

  const booksPerRow = window.innerWidth <= 600 ? 3 : 8;

  for (let i = 0; i < books.length; i += booksPerRow) {
    const rowBooks = books.slice(i, i + booksPerRow);

    const shelfRow = document.createElement('div');
    shelfRow.className = 'shelf-row';

    const booksContainer = document.createElement('div');
    booksContainer.className = 'shelf-row-books';

    rowBooks.forEach((book) => {
      const bookItem = document.createElement('button');
      bookItem.className = 'bookshelf-book';

      bookItem.innerHTML = `
        <div class="bookshelf-cover-wrap">
          ${
            book.cover
              ? `<img
                  class="bookshelf-cover"
                  src="${book.cover}"
                  alt="${escapeHtml(book.title)}"
                >`
              : `<div class="bookshelf-cover bookshelf-cover-placeholder">
                  ${escapeHtml(book.title)}
                </div>`
          }
        </div>

        <div class="bookshelf-info">
          <span class="bookshelf-title">
            ${escapeHtml(book.title)}
          </span>

          <span class="bookshelf-author">
            ${escapeHtml(book.author || '')}
          </span>
        </div>
      `;

      bookItem.addEventListener('click', () => {
        openDetail(book.id);
      });

      booksContainer.appendChild(bookItem);
    });

    shelfRow.appendChild(booksContainer);

    const shelfBoard = document.createElement('div');
    shelfBoard.className = 'shelf-board';

    shelfRow.appendChild(shelfBoard);

    shelfEl.appendChild(shelfRow);
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
  const genre = genreInput.value;
const decade = decadeInput.value;
const language = languageInput.value;

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

  if (genre) {
  queryParts.push(`subject:${genre}`);
}

  let searchQuery = queryParts.join(' ');

// タイトル・著者・Keyword・ジャンルが何もない場合
// 詳細条件だけでも検索できるようにする
if (!searchQuery) {
  if (language === 'ja') {
    searchQuery = '本';
  } else if (language === 'vi') {
    searchQuery = 'sách';
  } else {
    searchQuery = 'book';
  }
}

  if (!searchQuery) return;

  searchHint.hidden = false;
  searchHint.textContent = t('searching');
  searchResultsEl.innerHTML = '';

let languageParam = '';

if (language) {
  languageParam = `&langRestrict=${language}`;
}

  try {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=40${languageParam}&key=${GOOGLE_BOOKS_API_KEY}`
  );

    const data = await res.json();

console.log('検索URL:', res.url);
console.log('Google Books APIの結果:', data);

if (!res.ok) {
  console.error('Google Books APIエラー:', res.status, data);

  if (res.status === 429) {
    searchHint.textContent =
      '検索回数の上限に達しました。少し時間をおいてから再度お試しください。';
  } else {
    searchHint.textContent =
      '検索中にエラーが発生しました。';
  }

  return;
}
let filteredItems = data.items || [];

// 出版年代で絞り込む
if (decade) {
  const startYear = Number(decade);
  const endYear = startYear + 9;

  filteredItems = filteredItems.filter((item) => {
    const publishedDate = item.volumeInfo?.publishedDate;

    if (!publishedDate) return false;

    const year = Number(publishedDate.substring(0, 4));

    return year >= startYear && year <= endYear;
  });
}

renderSearchResults(filteredItems);
  } catch (err) {
    searchHint.textContent =
      t('searchFailed');
  }
});

const bookPreviewPanel = document.getElementById('bookPreviewPanel');

const previewBookImage =
  document.getElementById('previewBookImage');

const previewBookTitle =
  document.getElementById('previewBookTitle');

const previewBookAuthor =
  document.getElementById('previewBookAuthor');

const previewBookPublished =
  document.getElementById('previewBookPublished');

const previewBookDescription =
  document.getElementById('previewBookDescription');

const previewRegisterBtn =
  document.getElementById('previewRegisterBtn');

const previewViewSharedBtn =
  document.getElementById('previewViewSharedBtn');



let selectedPreviewBook = null;


function openBookPreview(item) {

  selectedPreviewBook = item;

  const info = item.volumeInfo || {};

  previewBookTitle.textContent =
    info.title || 'タイトル不明';

  previewBookAuthor.textContent =
    info.authors
      ? info.authors.join(', ')
      : '著者不明';

  previewBookPublished.textContent =
    info.publishedDate
      ? `出版日：${info.publishedDate}`
      : '出版日：不明';

  previewBookDescription.textContent =
    info.description ||
    'この本の説明は登録されていません。';


  const imageUrl =
    info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail;

  if (imageUrl) {
    previewBookImage.src =
      imageUrl.replace('http://', 'https://');

    previewBookImage.hidden = false;

  } else {

    previewBookImage.hidden = true;

  }

const alreadyAdded = loadBooks().some((book) => book.id === item.id);

previewRegisterBtn.disabled = false;

if (alreadyAdded) {
  previewRegisterBtn.textContent = t('addedLabel');
  previewRegisterBtn.classList.add('is-added');
} else {
  previewRegisterBtn.textContent = t('signUpButton');
  previewRegisterBtn.classList.remove('is-added');
}

bookPreviewPanel.hidden = false;
}


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

      <button class="btn-signup" >
        ${alreadyAdded ? t('addedLabel') : t('signUpButton')}
      </button>
    `;

    const btn = li.querySelector('.btn-signup');
    if (alreadyAdded) {
  btn.classList.add('is-added');
}

    li.addEventListener('click', () => {
  openBookPreview(item);
});


   btn.addEventListener('click', async (e) => {
  e.stopPropagation();

  const isRegistered = booksCache.some((book) => book.id === item.id);

  if (isRegistered) {
    await unregisterBook(item.id);

    btn.disabled = false;
    btn.textContent = t('signUpButton');
    btn.classList.remove('is-added');
  } else {
    await registerBook(item.id, info);

    btn.disabled = false;
    btn.textContent = t('addedLabel');
    btn.classList.add('is-added');
  }
});

    searchResultsEl.appendChild(li);
  });
}

previewViewSharedBtn.addEventListener('click', async () => {
  if (!selectedPreviewBook) return;

  openPanel(sharedImpressionsPanel);
  await renderSharedImpressions(selectedPreviewBook.id);
});

previewRegisterBtn.addEventListener('click', async () => {
  if (!selectedPreviewBook) return;

  const info = selectedPreviewBook.volumeInfo || {};
  const bookId = selectedPreviewBook.id;

  const isRegistered = booksCache.some((book) => book.id === bookId);

  previewRegisterBtn.disabled = true;

  try {
    if (isRegistered) {
      await unregisterBook(bookId);

      previewRegisterBtn.textContent = t('signUpButton');
      previewRegisterBtn.classList.remove('is-added');

    } else {
      await registerBook(bookId, info);

      previewRegisterBtn.textContent = t('addedLabel');
      previewRegisterBtn.classList.add('is-added');
    }

    renderRecommendationsList();

  } catch (err) {
    console.error(err);
  } finally {
    previewRegisterBtn.disabled = false;
  }
});


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

const RECOMMEND_DISPLAY_COUNT = 10;
const RECOMMEND_POOL_SIZE = 50;
const POPULAR_DISPLAY_COUNT = 10;
const POPULAR_POOL_SIZE = 50;

let recommendedBooks = [];
let popularBooks = [];

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

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchBookInfoBatch(bookIds) {
console.log('おすすめ用API取得冊数:', bookIds.length);

  const results = await Promise.all(
    bookIds.map((bookId) =>
      fetch(`https://www.googleapis.com/books/v1/volumes/${bookId}?key=${GOOGLE_BOOKS_API_KEY}`)
        .then((res) => res.json())
        .then((data) => (data.volumeInfo ? { id: bookId, info: data.volumeInfo } : null))
        .catch(() => null)
    )
  );
  return results.filter(Boolean);
}

async function computeRecommendations() {
  const myAverages = averageStarsByBook(impressionsCache);
  const myLikedBookIds = [...myAverages.entries()]
    .filter(([, avg]) => avg >= 4)
    .map(([bookId]) => bookId);

  if (myLikedBookIds.length === 0) return [];

  const myBookIdSet = new Set(booksCache.map((b) => b.id));

  const likedBookSnaps = await Promise.all(
    myLikedBookIds.map((bookId) =>
      getDocs(
        query(collection(db, 'impressions'), where('bookId', '==', bookId), where('shared', '==', true))
      ).catch(() => null)
    )
  );

  const similarUids = new Set();
  likedBookSnaps.forEach((snap) => {
    if (!snap) return;
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
  });

  if (similarUids.size === 0) return [];

  const userSnaps = await Promise.all(
    [...similarUids].map((uid) =>
      getDocs(
        query(collection(db, 'impressions'), where('uid', '==', uid), where('shared', '==', true))
      ).catch(() => null)
    )
  );

  const candidateScores = new Map();
  userSnaps.forEach((snap) => {
    if (!snap) return;
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
  });

  const ranked = [...candidateScores.entries()]
    .map(([bookId, { count, avgSum }]) => ({ bookId, count, avgAvg: avgSum / count }))
    .sort((a, b) => b.count - a.count || b.avgAvg - a.avgAvg)
    .slice(0, RECOMMEND_POOL_SIZE);

  const selected = shuffleArray(ranked).slice(0, RECOMMEND_DISPLAY_COUNT);

  return fetchBookInfoBatch(selected.map((r) => r.bookId));
}

async function computePopularBooks(excludeIds) {
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'impressions'), where('shared', '==', true)));
  } catch {
    return [];
  }

  const byBook = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (excludeIds.has(data.bookId)) return;
    if (!byBook.has(data.bookId)) byBook.set(data.bookId, []);
    byBook.get(data.bookId).push(data.stars);
  });

  const ranked = [...byBook.entries()]
    .map(([bookId, starsArr]) => ({
      bookId,
      count: starsArr.length,
      avg: starsArr.reduce((a, b) => a + b, 0) / starsArr.length,
    }))
    .filter((entry) => entry.avg >= 3)
    .sort((a, b) => b.count - a.count || b.avg - a.avg)
    .slice(0, POPULAR_POOL_SIZE);

  const selected = shuffleArray(ranked).slice(0, POPULAR_DISPLAY_COUNT);

  return fetchBookInfoBatch(selected.map((r) => r.bookId));
}

async function refreshRecommendations() {
  const myBookIdSet = new Set(booksCache.map((b) => b.id));

  const [personal, popular] = await Promise.all([
    computeRecommendations(),
    computePopularBooks(myBookIdSet),
  ]);

  recommendedBooks = personal;
  popularBooks = popular;
}

function renderBookListInto(listEl, hintEl, books, emptyMessage) {
  if (!listEl) return;
  listEl.innerHTML = '';

  if (books.length === 0) {
    if (hintEl) {
      hintEl.textContent = emptyMessage;
      hintEl.hidden = false;
    }
    return;
  }

  if (hintEl) hintEl.hidden = true;
  const registeredIds = new Set(loadBooks().map((b) => b.id));

  books
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
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        await registerBook(rec.id, info);
        renderRecommendationsList();
        renderPopularList();
      });

      li.addEventListener('click', () => {
        openBookPreview({ id: rec.id, volumeInfo: info });
      });

      listEl.appendChild(li);
    });
}

function renderRecommendationsList() {
  renderBookListInto(
    recommendedList,
    noRecommendedHint,
    recommendedBooks,
    'まだおすすめできる本がありません。感想を記録して星4以上を付けると、趣味の近い人の評価をもとにおすすめが表示されます。'
  );
}

function renderPopularList() {
  renderBookListInto(
    popularList,
    noPopularHint,
    popularBooks,
    'まだ人気の本を集計できるほどのデータがありません。'
  );
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
    renderPopularList();
  }
});

async function unregisterBook(bookId) {
  booksCache = booksCache.filter((book) => book.id !== bookId);

  const removedImpressionIds = impressionsCache
    .filter((imp) => imp.bookId === bookId)
    .map((imp) => imp.id);

  impressionsCache = impressionsCache.filter((imp) => imp.bookId !== bookId);

  await deleteDoc(
    doc(db, 'userBooks', `${currentUid}_${bookId}`)
  );

  await Promise.all(
    removedImpressionIds.map((impId) =>
      deleteDoc(doc(db, 'impressions', impId))
    )
  );

  renderShelf();
}

deleteBookBtn.addEventListener('click', async () => {
  const confirmed = confirm(t('confirmDeleteBook'));

  if (!confirmed) {
    return;
  }

  const bookId = state.currentBookId;

  await unregisterBook(bookId);

  closePanel(detailPanel);
  state.currentBookId = null;
});


// ---------- ユーティリティ ----------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

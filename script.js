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
  pendingNote: '',
  editingImpressionId: null,
};

// ---------- 感想の分岐質問データ（6択 × 3段階 = 216通り） ----------

const IMPRESSION_TREE = {
  '心に残った': {
    q2Question: '特に、どんな部分が心に残りましたか？',
    options: [
      {
        label: '物語の展開・ストーリー',
        question: 'その展開の、どんなところに惹かれましたか？',
        options: ['予想外の展開だった', '伏線が回収された', 'テンポの良さ', '緻密な構成', '危機を乗り越える過程', '複数の視点が交差する構成'],
      },
      {
        label: '登場人物の心情・生き方',
        question: 'その人物の、どんなところに惹かれましたか？',
        options: ['弱さや葛藤に共感した', '強さや芯の通った生き方', '変化・成長する姿', '自分と似た価値観', '自分にはない生き方への憧れ', '人との向き合い方'],
      },
      {
        label: '文章・言葉の表現',
        question: 'どんな表現が印象に残りましたか？',
        options: ['情景描写の美しさ', '心情描写の繊細さ', '印象的な一文・フレーズ', 'リズムの良い文体', '比喩や言葉選びの巧みさ', '余白のある静かな文章'],
      },
      {
        label: '結末・ラストシーン',
        question: '結末に、どう感じましたか？',
        options: ['予想を裏切られた', '静かに余韻が残った', 'すっきり報われた', 'あえて解決しない終わり方', '続きを想像したくなる', '涙が出た'],
      },
      {
        label: '自分の経験と重なった',
        question: 'どんな経験と重なりましたか？',
        options: ['人間関係の悩み', '将来への不安', '大切な人との別れ', '挑戦した経験', '日常のささいな出来事', '過去の後悔'],
      },
      {
        label: 'テーマ・伝えたいメッセージ',
        question: 'どんなメッセージを受け取りましたか？',
        options: ['生きることの意味', '人とのつながりの大切さ', '挑戦することの価値', '過去との向き合い方', '自分らしさとは何か', '当たり前の日常のありがたさ'],
      },
    ],
  },

  '学びや気づきがあった': {
    q2Question: '特に、どんな学びや気づきがありましたか？',
    options: [
      {
        label: '新しい知識が増えた',
        question: 'どんな分野の知識でしたか？',
        options: ['歴史や社会の背景', '科学や仕組みの話', '専門的な技術や知識', '心理や人間関係の仕組み', 'お金や暮らしの知恵', '言葉や文化の違い'],
      },
      {
        label: 'ものの見方が変わった',
        question: 'どんな見方が変わりましたか？',
        options: ['物事の良し悪しの基準', '自分では気づかなかった視点', '当たり前だと思っていたことへの疑問', '失敗や挫折への捉え方', '他人への評価の仕方', '未来に対する考え方'],
      },
      {
        label: '自分の弱さや癖に気づいた',
        question: 'どんな弱さや癖に気づきましたか？',
        options: ['人に頼れないこと', 'すぐ諦めてしまうこと', '人の目を気にしすぎること', '変化を怖がること', '感情をため込みやすいこと', '完璧を求めすぎること'],
      },
      {
        label: '人との関わり方について考えた',
        question: 'どんな関わり方について考えましたか？',
        options: ['相手の話をちゃんと聞くこと', '自分の気持ちを伝えること', '距離感の取り方', '許すこと・許されること', '信頼を築くこと', 'すれ違いを乗り越えること'],
      },
      {
        label: '実生活で試したいことが見つかった',
        question: '何を試してみたいですか？',
        options: ['新しい習慣を始めること', '考え方を変えてみること', '苦手なことに挑戦すること', '誰かに連絡してみること', '環境を変えてみること', '今の生活を見直すこと'],
      },
      {
        label: '生き方や価値観について考えた',
        question: 'どんなことを考えましたか？',
        options: ['何を大切に生きるか', 'お金と幸せの関係', '仕事との向き合い方', '家族や人とのつながり方', '自分らしさとは何か', '後悔しない選択とは何か'],
      },
    ],
  },

  '楽しく読めた': {
    q2Question: '特に、どんなところが楽しかったですか？',
    options: [
      {
        label: '物語の展開にワクワクした',
        question: 'どんな展開にワクワクしましたか？',
        options: ['意外などんでん返し', 'スカッとする逆転劇', '謎が解けていく過程', 'ピンチを乗り越える瞬間', '仲間と協力する場面', '夢や目標が叶う瞬間'],
      },
      {
        label: 'ユーモアがあって笑えた',
        question: 'どんなところが面白かったですか？',
        options: ['登場人物同士の掛け合い', '予想外のボケやツッコミ', 'シュールな状況設定', '皮肉やブラックユーモア', '人間味あふれる失敗談', '軽快なテンポの会話'],
      },
      {
        label: 'キャラクターに魅力を感じた',
        question: 'どんな魅力を感じましたか？',
        options: ['一途で真っすぐな性格', 'どこか抜けている愛嬌', 'かっこいい・強い姿', '弱さも見せる人間らしさ', '独特な個性やクセ', '仲間思いなところ'],
      },
      {
        label: '世界観に引き込まれた',
        question: 'どんな世界観が魅力的でしたか？',
        options: ['緻密に作り込まれた設定', '幻想的で美しい雰囲気', '現実離れした非日常感', 'リアルで生々しい描写', '独自のルールや文化', '季節や情景の描き方'],
      },
      {
        label: 'すらすら読めて心地よかった',
        question: 'どんなところが心地よかったですか？',
        options: ['テンポの良い文章', '短くて読みやすい章立て', '難しい言葉が少ない', '自然な会話のリズム', '飽きさせない場面転換', 'すっと頭に入る構成'],
      },
      {
        label: '続きが気になってやめられなかった',
        question: 'どんなところで続きが気になりましたか？',
        options: ['章の終わり方の引き', '伏線が気になった', '登場人物の運命が心配だった', '次に何が起こるか読めなかった', '謎が明かされそうな予感', '時間を忘れて読み進めた'],
      },
    ],
  },

  '心が苦しくなった': {
    q2Question: '特に、どんなところが苦しかったですか？',
    options: [
      {
        label: '登場人物のつらさに胸が痛んだ',
        question: 'どんなつらさに胸が痛みましたか？',
        options: ['孤独や孤立', '誰にも理解されない苦しみ', '夢を諦めざるを得ない状況', '過去のトラウマ', '体や心の限界', '大切なものを守れない無力さ'],
      },
      {
        label: '理不尽さに怒りを感じた',
        question: 'どんな理不尽さに怒りを感じましたか？',
        options: ['不公平な扱い', '努力が報われないこと', '周囲の無理解', '社会の仕組みそのもの', '身勝手な他人の言動', '取り返しのつかない出来事'],
      },
      {
        label: '別れや喪失が悲しかった',
        question: 'どんな別れ・喪失が悲しかったですか？',
        options: ['大切な人の死', '関係の終わり', '夢や居場所を失うこと', 'かつての自分との別れ', '二度と戻らない時間', '伝えられなかった気持ち'],
      },
      {
        label: '自分の経験と重なって苦しかった',
        question: 'どんな経験と重なりましたか？',
        options: ['過去の後悔', 'うまくいかなかった人間関係', '挫折や失敗の経験', '孤独を感じた時期', '大切な人を失った経験', '自分を責めてしまう気持ち'],
      },
      {
        label: '社会の現実を突きつけられた',
        question: 'どんな現実を突きつけられましたか？',
        options: ['格差や不平等', '差別や偏見', '制度の限界', '弱者が置かれる状況', '変わらない現実への無力感', '見て見ぬふりされる問題'],
      },
      {
        label: '結末が重く心に残った',
        question: 'どんなところが重く残りましたか？',
        options: ['救いのない終わり方', '答えの出ない問い', '読後もずっと考えてしまうこと', '登場人物のその後が気になること', '自分ならどうするかを考えたこと', '簡単には消化できない感情'],
      },
    ],
  },

  '期待と違った': {
    q2Question: '特に、どんなところが期待と違いましたか？',
    options: [
      {
        label: '展開が予想と違った',
        question: 'どんなところが予想と違いましたか？',
        options: ['話の中心が変わっていった', '盛り上がりに欠けた', '予想通りすぎて驚きがなかった', 'テンポが自分に合わなかった', '脱線が多く感じた', '説明不足に感じた部分があった'],
      },
      {
        label: '人物像が思っていたのと違った',
        question: 'どんなところが思っていたのと違いましたか？',
        options: ['想像より魅力を感じなかった', '行動に共感できなかった', '描写が薄く感じた', '変化や成長が見えにくかった', '性格が一貫していない気がした', 'もっと深掘りしてほしかった'],
      },
      {
        label: '結末に納得できなかった',
        question: 'どんなところに納得できませんでしたか？',
        options: ['唐突に終わった感じがした', '伏線が回収されなかった', '都合が良すぎる終わり方', '逆に救いがなさすぎた', '説明が足りなかった', '自分の解釈と合わなかった'],
      },
      {
        label: '文体や雰囲気が合わなかった',
        question: 'どんなところが合いませんでしたか？',
        options: ['文章のテンポ', '言葉遣いや言い回し', '全体的なトーンの暗さ・明るさ', '専門的すぎる表現', '逆にくだけすぎている表現', '視点の切り替えの分かりにくさ'],
      },
      {
        label: '扱うテーマが重すぎた・軽すぎた',
        question: 'どちらの印象でしたか？',
        options: ['想像より重いテーマだった', '想像より軽いテーマだった', '扱い方が浅いと感じた', '扱い方が説教くさく感じた', '自分には難しいテーマだった', 'もっと深く掘り下げてほしかった'],
      },
      {
        label: '想像していたジャンルと違った',
        question: 'どんな点でイメージと違いましたか？',
        options: ['タイトルや表紙の印象と違った', '紹介文のイメージと違った', '恋愛要素が多い・少ない', 'ミステリー要素が多い・少ない', 'シリアスさとコメディのバランス', '対象年齢が想像と違った'],
      },
    ],
  },

  'もっと知りたくなった': {
    q2Question: '特に、どんなことをもっと知りたくなりましたか？',
    options: [
      {
        label: '続きの物語が気になる',
        question: '続きのどんなところが気になりますか？',
        options: ['物語のその後の展開', '謎の答え', '新しく出てきた伏線', '続編があるかどうか', '完結しているシリーズかどうか', '似た終わり方の作品'],
      },
      {
        label: '登場人物のその後が気になる',
        question: '誰の・どんなその後が気になりますか？',
        options: ['主人公のその後の人生', '恋愛や人間関係の行方', '夢や目標を叶えたかどうか', '脇役たちのその後', '敵役やライバルの末路', '登場人物同士の再会'],
      },
      {
        label: '作者や執筆背景に興味を持った',
        question: 'どんなことを知りたいですか？',
        options: ['作者の他の作品', '執筆のきっかけ', '作者自身の経歴や人柄', '実体験が反映されているか', '執筆時の裏話', '作者のインタビューや発言'],
      },
      {
        label: '扱われていたテーマをもっと知りたい',
        question: 'どんな切り口で知りたいですか？',
        options: ['専門的な解説書を読んでみたい', '同じテーマの別の作品を読みたい', '実際のニュースや事例を調べたい', '歴史的な背景を知りたい', '統計やデータを見てみたい', '専門家の意見を聞いてみたい'],
      },
      {
        label: '関連する作品を読んでみたい',
        question: 'どんな関連作品が気になりますか？',
        options: ['同じ作者の他の本', '同じジャンルの人気作', '似たテーマを扱う作品', '映像化された作品', '続編やスピンオフ', '影響を受けたとされる作品'],
      },
      {
        label: '実際の場所や出来事について調べたくなった',
        question: 'どんなことを調べたくなりましたか？',
        options: ['物語の舞台になった場所', 'モデルになった実在の人物', '描かれた歴史的な出来事', '登場した文化や風習', '作中に出てきた食べ物や物', '時代背景そのもの'],
      },
    ],
  },
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
const freeTextBlock = document.getElementById('freeTextBlock');
const freeTextInput = document.getElementById('freeTextInput');
const freeTextCount = document.getElementById('freeTextCount');
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
      ${imp.note ? `<p class="impression-note">${escapeHtml(imp.note)}</p>` : ''}
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
  state.pendingQ1 = imp.q1 || null;
  state.pendingQ2 = imp.q2 || null;
  state.pendingQ3 = imp.q3 || null;
  state.pendingNote = imp.note || '';

  impressionPanelTitle.textContent = '感想を編集';
  updateStarDisplay();
  freeTextInput.value = state.pendingNote;
  freeTextCount.textContent = String(state.pendingNote.length);

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
  }

  freeTextBlock.hidden = !state.pendingQ3;

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
  freeTextBlock.hidden = true;

  if (IMPRESSION_TREE[state.pendingQ1]) {
    renderQ2(state.pendingQ1);
  } else {
    q2Block.innerHTML = '';
  }

  updateSaveButtonState();
});

function renderQ2(q1Value) {
  const tree = IMPRESSION_TREE[q1Value];
  q2Block.innerHTML = `
    <p class="field-label">${escapeHtml(tree.q2Question)}</p>
    <div class="tag-picker" id="q2Picker">
      ${tree.options.map((opt) => `<button class="tag-option" data-q2="${escapeHtml(opt.label)}">${escapeHtml(opt.label)}</button>`).join('')}
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
    freeTextBlock.hidden = true;
    renderQ3(q1Value, state.pendingQ2);
    updateSaveButtonState();
  });
}

function renderQ3(q1Value, q2Label) {
  const tree = IMPRESSION_TREE[q1Value];
  const branch = tree.options.find((opt) => opt.label === q2Label);
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
    freeTextBlock.hidden = false;
    updateSaveButtonState();
  });
}

function updateSaveButtonState() {
  const complete = state.pendingStars > 0 && state.pendingQ1 && state.pendingQ2 && state.pendingQ3;
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
      target.q1 = state.pendingQ1;
      target.q2 = state.pendingQ2;
      target.q3 = state.pendingQ3;
      target.note = note;
    }
  } else {
    impressions.push({
      id: generateId(),
      bookId: state.currentBookId,
      stars: state.pendingStars,
      q1: state.pendingQ1,
      q2: state.pendingQ2,
      q3: state.pendingQ3,
      note,
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

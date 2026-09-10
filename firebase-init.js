// ============================================
// Firebaseの初期化（全ページ共通）
// ============================================
// Firebase v10 の CDN 経由モジュール版SDKを使用。
// バンドラー不要で <script type="module"> からそのままimportできる。

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

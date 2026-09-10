// ============================================
// アカウント作成・ログイン・ログアウト・認証ガード
// ============================================

import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- ユーザー名の正規化 ----------
// 大文字・小文字だけが違う名前を別名扱いにしないよう、
// 重複チェック・保存のキーには小文字化した値を使う。
export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

// ---------- 新規登録 ----------
// 1. ユーザー名を Firestore の usernames コレクションで「予約」する（重複防止）
// 2. Firebase Authenticationでメールアドレス＋パスワードのアカウントを作成
// 3. 予約したユーザー名にuidを紐付け、users/{uid} にプロフィールを保存
// 4. 認証アカウントの作成に失敗したら、予約したユーザー名を解放（ロールバック）
export async function registerUser(username, email, password) {
  const key = normalizeUsername(username);

  if (!key) {
    throw new Error("ユーザー名を入力してください。");
  }
  if (password.length < 6) {
    throw new Error("パスワードは6文字以上で入力してください。");
  }

  const usernameRef = doc(db, "usernames", key);

  // ユーザー名を先に予約する（同時登録による重複を防ぐ）
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(usernameRef);
    if (existing.exists()) {
      throw new Error("USERNAME_TAKEN");
    }
    transaction.set(usernameRef, {
      displayName: username.trim(),
      uid: null,
      createdAt: serverTimestamp(),
    });
  }).catch((err) => {
    if (err.message === "USERNAME_TAKEN") {
      throw new Error("このユーザー名はすでに使われています。");
    }
    throw err;
  });

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // 予約したユーザー名にuidを紐付ける
    await setDoc(usernameRef, { uid }, { merge: true });

    // ユーザープロフィールを保存
    await setDoc(doc(db, "users", uid), {
      username: username.trim(),
      usernameKey: key,
      email,
      createdAt: serverTimestamp(),
    });

    // 登録直後は自動ログイン状態になるため、ログイン画面へ移動する仕様に合わせて
    // 一旦サインアウトしておく（「作成したらログイン画面に移動し、
    // メールアドレスとパスワードでログインしてもらう」という要件のため）
    await signOut(auth);
  } catch (err) {
    // 認証アカウントの作成に失敗した場合は、予約したユーザー名を解放する
    await deleteDoc(usernameRef).catch(() => {});
    throw translateAuthError(err);
  }
}

// ---------- ログイン ----------
export async function loginUser(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw translateAuthError(err);
  }
}

// ---------- ログアウト ----------
export async function logoutUser() {
  await signOut(auth);
}

// ---------- プロフィール取得（ユーザー名の表示用） ----------
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ---------- ユーザー名の変更 ----------
// 新規登録と同じ考え方で、新しいユーザー名を先に「予約」してから
// プロフィールを更新し、最後に古いユーザー名を解放する。
export async function changeUsername(uid, newUsername) {
  const newKey = normalizeUsername(newUsername);

  if (!newKey) {
    throw new Error("ユーザー名を入力してください。");
  }

  const profile = await getUserProfile(uid);
  if (!profile) {
    throw new Error("プロフィールが見つかりませんでした。");
  }

  const oldKey = profile.usernameKey;

  // 表示だけの違い（大文字・小文字や前後の空白など）なら、
  // 重複チェックをせず表示名だけ更新する
  if (newKey === oldKey) {
    await updateDoc(doc(db, "users", uid), { username: newUsername.trim() });
    await updateDoc(doc(db, "usernames", oldKey), { displayName: newUsername.trim() }).catch(() => {});
    return;
  }

  const newRef = doc(db, "usernames", newKey);

  // 新しいユーザー名を予約する（同時変更による重複を防ぐ）
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(newRef);
    if (existing.exists()) {
      throw new Error("USERNAME_TAKEN");
    }
    transaction.set(newRef, {
      displayName: newUsername.trim(),
      uid,
      createdAt: serverTimestamp(),
    });
  }).catch((err) => {
    if (err.message === "USERNAME_TAKEN") {
      throw new Error("このユーザー名はすでに使われています。");
    }
    throw err;
  });

  try {
    // プロフィールを新しいユーザー名に更新
    await updateDoc(doc(db, "users", uid), {
      username: newUsername.trim(),
      usernameKey: newKey,
    });
    // 古いユーザー名の予約を解放
    await deleteDoc(doc(db, "usernames", oldKey));
  } catch (err) {
    // 途中で失敗したら、新しく予約したユーザー名を解放してロールバック
    await deleteDoc(newRef).catch(() => {});
    throw err;
  }
}

// ---------- Firebaseのエラーコードを日本語メッセージに変換 ----------
function translateAuthError(err) {
  const code = err && err.code;
  const messages = {
    "auth/email-already-in-use": "このメールアドレスはすでに登録されています。",
    "auth/invalid-email": "メールアドレスの形式が正しくありません。",
    "auth/weak-password": "パスワードは6文字以上で入力してください。",
    "auth/user-not-found": "メールアドレスまたはパスワードが正しくありません。",
    "auth/wrong-password": "メールアドレスまたはパスワードが正しくありません。",
    "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
    "auth/too-many-requests": "試行回数が多すぎます。しばらくしてからもう一度お試しください。",
  };
  return new Error(messages[code] || err.message || "エラーが発生しました。");
}

// ---------- ログイン状態の取得（1回だけ待ち受け） ----------
function waitForAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// ---------- 認証ガード ----------
// index.html（アプリ本体）の先頭で呼び出す。
// 未ログインなら login.html へ強制的に移動させる。
export async function requireAuth() {
  const user = await waitForAuthState();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

// ---------- ログイン済みなら本体へ ----------
// login.html / signup.html の先頭で呼び出す。
// すでにログイン済みの場合は index.html へ移動させる。
export async function redirectIfLoggedIn() {
  const user = await waitForAuthState();
  if (user) {
    window.location.href = "index.html";
  }
}

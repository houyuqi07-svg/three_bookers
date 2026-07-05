const todayKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const STORAGE_KEY = "threeBookwormsStateV1";
const USER_KEY = "threeBookwormsUserId";
const seedFinishedBooks = window.THREE_BOOKWORMS_FINISHED_BOOKS || {};
const validUserIds = ["yuki", "momo", "lusi"];
const lockedUserId = userIdFromPath() || userIdFromQuery();

const initialState = {
  currentUserId: initialUserId(),
  page: "home",
  syncStatus: "loading",
  selectedBookId: null,
  recentStarBookId: null,
  starFlight: null,
  toast: "",
  modal: null,
  people: [
    {
      id: "yuki",
      name: "Yuki",
      avatar: "Y",
      avatarColor: "#d9c8ff",
      currentBook: null,
      finishedBooks: seedFinishedBooks.yuki || [],
    },
    {
      id: "momo",
      name: "Momo",
      avatar: "M",
      avatarColor: "#9fd8ff",
      currentBook: null,
      finishedBooks: seedFinishedBooks.momo || [],
    },
    {
      id: "lusi",
      name: "Lusi",
      avatar: "L",
      avatarColor: "#ff9cc6",
      currentBook: null,
      finishedBooks: seedFinishedBooks.lusi || [],
    },
  ],
};

let state = loadState();
const app = document.querySelector("#app");

function loadState() {
  localStorage.removeItem("quietReadingState");
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return normalizeVisualState({ ...structuredClone(initialState), currentUserId: initialUserId() });

  try {
    return normalizeVisualState({
      ...structuredClone(initialState),
      ...JSON.parse(saved),
      currentUserId: initialUserId(),
      page: "home",
      modal: null,
      toast: "",
      recentStarBookId: null,
      starFlight: null,
      syncStatus: "loading",
    });
  } catch {
    return normalizeVisualState({ ...structuredClone(initialState), currentUserId: initialUserId() });
  }
}

function initialUserId() {
  if (lockedUserId) {
    localStorage.setItem(USER_KEY, lockedUserId);
    return lockedUserId;
  }

  const savedUser = localStorage.getItem(USER_KEY);
  return validUserIds.includes(savedUser) ? savedUser : "yuki";
}

function stableUserId(preferredUserId = state?.currentUserId) {
  const nextUserId = lockedUserId || (validUserIds.includes(preferredUserId) ? preferredUserId : initialUserId());
  localStorage.setItem(USER_KEY, nextUserId);
  return nextUserId;
}

function userIdFromPath() {
  const pathUser = window.location.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return validUserIds.includes(pathUser) ? pathUser : "";
}

function userIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const queryUser = params.get("user")?.toLowerCase();
  return validUserIds.includes(queryUser) ? queryUser : "";
}

function normalizeVisualState(nextState) {
  const lightCovers = {
    yuki: "linear-gradient(150deg, #fffaf0, #ded9cf)",
    momo: "linear-gradient(150deg, #f7f7f4, #d8dde6)",
    lusi: "linear-gradient(150deg, #fff4f7, #e4ddd4)",
  };

  return {
    ...nextState,
    people: nextState.people.map((person) => {
      const coverColor = lightCovers[person.id] || "linear-gradient(150deg, #f8f7f2, #ddd8cf)";
      const softenBook = (book) =>
        book && !book.coverUrl
          ? {
              ...book,
              coverColor,
              comments: Array.isArray(book.comments) ? book.comments : [],
            }
          : book;
      const normalizeBook = (book) =>
        book
          ? {
              ...softenBook(book),
              comments: Array.isArray(book.comments) ? book.comments : [],
            }
          : book;

      return {
        ...person,
        avatarColor: person.id === "yuki" ? "#d9c8ff" : person.avatarColor,
        currentBook: normalizeBook(person.currentBook),
        finishedBooks: person.finishedBooks.map(normalizeBook),
      };
    }),
  };
}

function saveState() {
  const { page, modal, toast, recentStarBookId, starFlight, selectedBookId, syncStatus, ...persisted } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function setState(patch, shouldSave = true) {
  state = { ...state, ...patch, currentUserId: stableUserId(patch.currentUserId) };
  if (shouldSave) {
    saveState();
    persistSharedState();
  }
  render();
}

async function loadSharedState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Shared state unavailable");
    const data = await response.json();
    if (!Array.isArray(data.people)) throw new Error("Invalid shared state");

    const currentUserId = stableUserId();
    const normalized = normalizeVisualState({ ...state, currentUserId, people: data.people });
    state = {
      ...normalized,
      currentUserId,
      page: "home",
      modal: null,
      toast: "",
      recentStarBookId: null,
      starFlight: null,
      syncStatus: "shared",
    };
    saveState();
    render();
  } catch {
    setState({ syncStatus: "local" }, false);
  }
}

async function refreshSharedPeople() {
  if (state.syncStatus !== "shared" || ["add", "note"].includes(state.page) || state.modal) return;

  const activeElement = document.activeElement;
  if (activeElement?.matches?.("input, textarea")) return;

  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.people)) return;
    const currentUserId = stableUserId();
    const normalized = normalizeVisualState({ ...state, currentUserId, people: data.people });
    state = { ...state, people: normalized.people };
    saveState();
    render();
  } catch {
    // Keep the current screen calm; the next explicit save will surface errors.
  }
}

window.setInterval(refreshSharedPeople, 8000);

async function persistSharedState() {
  if (!["shared", "saving"].includes(state.syncStatus)) return;

  const people = state.people;
  setState({ syncStatus: "saving" }, false);

  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ people }),
    });
    if (!response.ok) throw new Error("Save failed");
    const data = await response.json();
    const currentUserId = stableUserId();
    const normalized = normalizeVisualState({ ...state, currentUserId, people: data.people || people });
    state = { ...normalized, currentUserId, syncStatus: "shared" };
    saveState();
    render();
  } catch {
    setState({ syncStatus: "local" }, false);
    showToast("共享保存失败，已暂时切到本机模式。");
  }
}

function switchUser(userId) {
  if (lockedUserId) return;
  if (!validUserIds.includes(userId)) return;
  localStorage.setItem(USER_KEY, userId);
  const url = new URL(window.location.href);
  url.searchParams.set("user", userId);
  window.history.replaceState({}, "", url);
  setState({ currentUserId: userId, page: "home", selectedBookId: null, modal: null }, false);
  saveState();
}

function allEchoes() {
  return state.people
    .flatMap((person) =>
      person.finishedBooks
        .filter((book) => book.note?.body)
        .map((book) => ({
          ...book,
          ownerId: person.id,
          ownerName: person.name,
          ownerAvatar: person.avatar,
          ownerColor: person.avatarColor,
          comments: Array.isArray(book.comments) ? book.comments : [],
        })),
    )
    .sort((a, b) => {
      const dateCompare = new Date(`${b.finishedAt || "1900-01-01"}T00:00:00`) - new Date(`${a.finishedAt || "1900-01-01"}T00:00:00`);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
}

function currentUser() {
  const currentUserId = stableUserId();
  return state.people.find((person) => person.id === currentUserId) || state.people[0];
}

function personById(id) {
  return state.people.find((person) => person.id === id);
}

function selectedFinishedBook() {
  const user = currentUser();
  return user.finishedBooks.find((book) => book.id === state.selectedBookId);
}

function formatDate(dateString) {
  if (!dateString) return "未记录";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bookCover(book, mini = false) {
  const style = `--cover:${book.coverColor || "linear-gradient(150deg, #fffaf0, #ded9cf)"}`;
  if (book.coverUrl) {
    return `
      <div class="${mini ? "mini-cover" : "cover"}" style="${style}">
        <img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}封面" />
      </div>
    `;
  }

  return `
    <div class="${mini ? "mini-cover" : "cover"}" style="${style}">
      <div class="cover-fallback">
        <span>READING</span>
        <strong>${escapeHtml(book.title)}</strong>
        <span>${escapeHtml(book.author || "未填写作者")}</span>
      </div>
    </div>
  `;
}

function starHtml(count, bookId) {
  if (count <= 0) return `<span class="status-pill">还没有星星</span>`;
  return Array.from({ length: count }, (_, index) => {
    const isNew = state.recentStarBookId === bookId && index === count - 1;
    return `<span class="star ${isNew ? "is-new" : ""}">★</span>`;
  }).join("");
}

function pageHeader(title, subtitle = "") {
  return `
    <div class="page-heading">
      <div>
        <h2>${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
    </div>
  `;
}

function renderShell(content) {
  const syncLabel = {
    loading: "连接中",
    shared: "共享中",
    local: "本机模式",
    saving: "保存中",
  }[state.syncStatus] || "本机模式";

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">★</div>
          <div>
            <h1 class="brand-title">三只书虫</h1>
            <p class="brand-subtitle">当前身份：${escapeHtml(currentUser().name)} · ${syncLabel}</p>
          </div>
        </div>
        ${renderIdentityControl()}
      </header>
      ${content}
      ${renderBottomNav()}
      ${state.modal ? renderModal() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function navSection() {
  if (["finished", "note"].includes(state.page)) return "mine";
  if (state.page === "echoes") return "echoes";
  return "home";
}

function renderBottomNav() {
  const active = navSection();
  return `
    <nav class="bottom-nav" aria-label="主导航">
      <button class="bottom-nav-item ${active === "home" ? "is-active" : ""}" data-route="home">
        <span>★</span>
        打卡
      </button>
      <button class="bottom-nav-item ${active === "echoes" ? "is-active" : ""}" data-route="echoes">
        <span>◌</span>
        回响
      </button>
      <button class="bottom-nav-item ${active === "mine" ? "is-active" : ""}" data-route="finished">
        <span>☻</span>
        我的
      </button>
    </nav>
  `;
}

function renderIdentityControl() {
  if (lockedUserId) {
    return `
      <div class="identity-locked" aria-label="固定身份">
        <span>固定身份</span>
        <strong>${escapeHtml(currentUser().name)}</strong>
      </div>
    `;
  }

  return `
    <div class="identity-switcher" aria-label="选择身份">
      ${state.people
        .map(
          (person) => `
            <button class="identity-button ${person.id === state.currentUserId ? "is-active" : ""}" data-action="switch-user" data-user-id="${person.id}">
              ${escapeHtml(person.name)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderHome() {
  return renderShell(`
    <main class="page page-checkin">
      ${pageHeader("今天读到哪里了？", "三个人各自保留一本当前在读，打卡只为自己的这本书点亮一颗星。")}
      ${renderDailyCheckin()}
      <section class="reading-grid">
        ${state.people.map(renderReadingCard).join("")}
      </section>
    </main>
  `);
}

function renderEchoes() {
  const echoes = allEchoes();
  return renderShell(`
    <main class="page page-echoes">
      ${pageHeader("回响", "每一本读完的书，都留下一点回声。")}
      ${
        echoes.length
          ? `<section class="echo-feed">${echoes.map(renderEchoCard).join("")}</section>`
          : `<section class="panel empty-state">还没有读后感。读完一本书并写下笔记后，它会出现在这里。</section>`
      }
    </main>
  `);
}

function renderEchoCard(book) {
  return `
    <article class="echo-card">
      <div class="echo-meta">
        <div class="friend">
          <div class="avatar echo-avatar" style="--avatar:${book.ownerColor}">${escapeHtml(book.ownerAvatar)}</div>
          <div>
            <p class="friend-name">${escapeHtml(book.ownerName)}</p>
            <p class="friend-state">${formatDate(book.finishedAt)}</p>
          </div>
        </div>
        <span class="echo-stars">⭐ ${book.stars || 0}</span>
      </div>
      <div class="echo-book">
        <h3>《${escapeHtml(book.title)}》</h3>
        ${book.author ? `<p>${escapeHtml(book.author)}</p>` : ""}
      </div>
      <div class="echo-body">${formatNoteBody(book.note.body)}</div>
      <section class="comments">
        <h4>评论</h4>
        ${renderComments(book.comments)}
        <form class="comment-form" data-form="comment" data-book-id="${book.id}">
          <input name="content" required autocomplete="off" placeholder="写一句回响..." />
          <button class="button secondary" type="submit">发送</button>
        </form>
      </section>
    </article>
  `;
}

function formatNoteBody(body = "") {
  return escapeHtml(body)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function renderComments(comments = []) {
  if (!comments.length) return `<p class="comment-empty">还没有评论。</p>`;
  return `
    <div class="comment-list">
      ${comments
        .map(
          (comment) => `
            <div class="comment-item">
              <div class="comment-head">
                <strong>${escapeHtml(comment.userName || "朋友")}</strong>
                <span>${formatDateTime(comment.createdAt)}</span>
              </div>
              <p>${escapeHtml(comment.content)}</p>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderDailyCheckin() {
  const user = currentUser();
  const book = user.currentBook;
  const checkedToday = book?.lastCheckinAt === todayKey();
  const disabled = !book || checkedToday;

  let status = "今天的阅读，点亮在这里。";
  if (!book) status = "先开始一本书，再点亮今天的星星。";
  if (checkedToday) status = "今天已经点亮过一颗星。";

  const flightStyle = state.starFlight
    ? `style="--start-x:${state.starFlight.startX}px;--start-y:${state.starFlight.startY}px;--center-x:${state.starFlight.centerX}px;--center-y:${state.starFlight.centerY}px;--end-x:${state.starFlight.endX}px;--end-y:${state.starFlight.endY}px"`
    : "";

  return `
    <section class="daily-checkin-chart">
      <button class="star-chart" data-action="quick-checkin" ${disabled ? "disabled" : ""} aria-label="${checkedToday ? "今日已打卡" : "打卡点亮"}">
        <span class="orbit orbit-yellow"></span>
        <span class="orbit orbit-blue"></span>
        <span class="orbit orbit-pink"></span>
        <span class="orbit orbit-purple"></span>
        <span class="mini-orb mini-orb-one">✦</span>
        <span class="mini-orb mini-orb-two">✓</span>
        <span class="mini-orb mini-orb-three">♡</span>
        <span class="star-core">
          <span class="star-symbol">★</span>
          <span class="star-label">${checkedToday ? "今日已点亮" : "打卡点亮"}</span>
        </span>
      </button>
      <p class="chart-caption">${status}</p>
    </section>
    ${
      state.starFlight
        ? `
          <div class="checkin-celebration" ${flightStyle}>
            <div class="flight-star">
              <span>★</span>
            </div>
            <div class="success-badge">耶！成功点亮</div>
          </div>
        `
        : ""
    }
  `;
}

function renderReadingCard(person) {
  const isMine = person.id === state.currentUserId;
  const book = person.currentBook;

  if (!book) {
    return `
      <article class="reading-card ${isMine ? "is-mine" : ""}">
        <div class="card-inner">
          ${renderFriendRow(person, isMine, "未开始")}
          <div class="empty-reading">
            <h3>${isMine ? (person.finishedBooks.length ? "开始下一本书" : "你最近在读什么？") : "还没有在读书籍"}</h3>
            <p>${isMine ? "添上现在手边这一本，星星就从今天开始慢慢亮起来。" : "等对方开始阅读后，这里会出现新的书。"}</p>
            ${
              isMine
                ? `<button class="button" data-route="add">${person.finishedBooks.length ? "开始下一本书" : "开始阅读"}</button>`
                : ""
            }
          </div>
        </div>
      </article>
    `;
  }

  const checkedToday = book.lastCheckinAt === todayKey();

  return `
    <article class="reading-card ${isMine ? "is-mine" : ""}">
      <div class="card-inner">
        ${renderFriendRow(person, isMine, checkedToday ? "今日已打卡" : "今日未打卡")}
        <div class="cover-wrap">${bookCover(book)}</div>
        <h3 class="book-title">《${escapeHtml(book.title)}》</h3>
        <p class="book-author">${escapeHtml(book.author || "作者未填写")}</p>
        <div class="stars" aria-label="已获得 ${book.stars} 颗星">${starHtml(book.stars, book.id)}</div>
        <div class="stats">
          <span>已累计打卡 <strong>${book.checkins}</strong> 次</span>
          <span>${checkedToday ? "今日已打卡" : "今日还没打卡"}</span>
        </div>
        ${
          isMine
            ? `
              <div class="actions">
                <button class="button ghost" data-action="open-finish">我读完了</button>
              </div>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderFriendRow(person, isMine, status) {
  return `
    <div class="friend-row">
      <div class="friend">
        <div class="avatar" style="--avatar:${person.avatarColor}">${escapeHtml(person.avatar)}</div>
        <div>
          <p class="friend-name">${escapeHtml(person.name)}</p>
          <p class="friend-state">${status}</p>
        </div>
      </div>
      ${isMine ? `<span class="mine-pill">我</span>` : ""}
    </div>
  `;
}

function renderAddBook() {
  return renderShell(`
    <main class="page form-page page-checkin">
      ${pageHeader("添加在读书籍", "同一时间只保留一本当前在读。")}
      <section class="panel">
        <form class="form" data-form="add-book">
          <div class="field">
            <label for="title">书名</label>
            <input id="title" name="title" required autocomplete="off" />
          </div>
          <div class="field">
            <label for="author">作者</label>
            <input id="author" name="author" autocomplete="off" />
          </div>
          <div class="field">
            <label for="coverUrl">书籍封面</label>
            <input id="coverUrl" name="coverUrl" type="url" placeholder="https://..." autocomplete="off" />
          </div>
          <div class="form-actions">
            <button class="button" type="submit">开始阅读</button>
            <button class="button ghost" type="button" data-route="home">返回首页</button>
          </div>
        </form>
      </section>
    </main>
  `);
}

function renderFinished() {
  const user = currentUser();
  return renderShell(`
    <main class="page finished-page page-mine">
      ${pageHeader("我的", "已读书籍、个人笔记和还没补完的读后感都在这里。")}
      ${
        user.finishedBooks.length
          ? `<section class="finished-list">${user.finishedBooks.map(renderFinishedItem).join("")}</section>`
          : `<section class="panel empty-state">还没有已读书籍。读完当前这本后，它会出现在这里。</section>`
      }
    </main>
  `);
}

function renderFinishedItem(book) {
  const hasNote = Boolean(book.note?.body);
  return `
    <article class="finished-item">
      ${bookCover(book, true)}
      <div class="finished-main">
        <h3>《${escapeHtml(book.title)}》</h3>
        <p>${escapeHtml(book.author || "作者未填写")} · ${formatDate(book.finishedAt)}</p>
        <div class="badges">
          <span>⭐ ${book.stars}</span>
          <span>·</span>
          <span>✓ 已读完</span>
          <span>·</span>
          <span>✍ ${hasNote ? "有笔记" : "待写笔记"}</span>
        </div>
      </div>
      <button class="button secondary" data-action="edit-note" data-book-id="${book.id}">
        ${hasNote ? "查看笔记" : "写笔记"}
      </button>
    </article>
  `;
}

function renderNote() {
  const book = selectedFinishedBook();
  if (!book) return renderFinished();

  return renderShell(`
    <main class="page note-page page-mine">
      ${pageHeader(`《${escapeHtml(book.title)}》`, "读书笔记")}
      <section class="panel">
        <form class="form" data-form="note">
          <div class="field">
            <label for="noteTitle">笔记标题</label>
            <input id="noteTitle" name="noteTitle" value="${escapeHtml(book.note?.title || "")}" autocomplete="off" />
          </div>
          <div class="field">
            <label for="noteBody">笔记正文</label>
            <textarea id="noteBody" name="noteBody" required placeholder="写下这本书最触动你的观点、你不同意的地方，或者它与你生活的联系……">${escapeHtml(book.note?.body || "")}</textarea>
          </div>
          <div class="form-actions">
            <button class="button" type="submit">保存笔记</button>
            <button class="button ghost" type="button" data-route="finished">返回已读</button>
          </div>
        </form>
      </section>
    </main>
  `);
}

function renderModal() {
  if (state.modal === "checkin") {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
          <button class="modal-close" data-action="close-modal" aria-label="关闭">×</button>
          <div class="modal-body">
            <h3 id="checkin-title">今天也读书了吗？</h3>
            <p>为当前这本书点亮一颗星。</p>
            <div class="form-actions">
              <button class="button" data-action="confirm-checkin">点亮一颗星</button>
              <button class="button ghost" data-action="close-modal">先等等</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  if (state.modal === "finish") {
    const book = currentUser().currentBook;
    if (!book) return "";

    return `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <button class="modal-close" data-action="close-modal" aria-label="关闭">×</button>
          <div class="modal-body">
            <h3 id="finish-title">恭喜你读完《${escapeHtml(book.title)}》</h3>
            <div class="finish-summary">
              <span>星星数量：<strong>${book.stars}</strong></span>
              <span>累计打卡：<strong>${book.checkins}</strong> 次</span>
              <span>开始阅读：${formatDate(book.startedAt)}</span>
              <span>完成日期：${formatDate(todayKey())}</span>
            </div>
            <p>要不要为这本书写一篇读书笔记？</p>
            <div class="form-actions">
              <button class="button" data-action="finish-with-note">写读书笔记</button>
              <button class="button secondary" data-action="finish-later">稍后再写</button>
              <button class="button ghost" data-action="close-modal">继续阅读</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  return "";
}

function render() {
  const pages = {
    home: renderHome,
    echoes: renderEchoes,
    add: renderAddBook,
    finished: renderFinished,
    note: renderNote,
  };

  app.innerHTML = (pages[state.page] || renderHome)();
}

function navigate(page, extra = {}) {
  setState({ page, modal: null, ...extra }, false);
}

function showToast(message) {
  setState({ toast: message }, false);
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => setState({ toast: "" }, false), 2200);
}

function updateCurrentUser(updater) {
  const people = state.people.map((person) =>
    person.id === state.currentUserId ? updater(structuredClone(person)) : person,
  );
  setState({ people });
}

function confirmCheckin() {
  const user = currentUser();
  const book = user.currentBook;
  if (!book || book.lastCheckinAt === todayKey()) return;

  const starFlight = getStarFlight();
  const people = state.people.map((person) =>
    person.id === state.currentUserId
      ? {
          ...person,
          currentBook: {
            ...person.currentBook,
            stars: person.currentBook.stars + 1,
            checkins: person.currentBook.checkins + 1,
            lastCheckinAt: todayKey(),
          },
        }
      : person,
  );

  setState({ people, modal: null, recentStarBookId: book.id, starFlight });
  showToast("星星已点亮。");
  window.setTimeout(() => setState({ recentStarBookId: null, starFlight: null }, false), 2000);
}

function getStarFlight() {
  const button = document.querySelector(".star-chart");
  const cover = document.querySelector(".reading-card.is-mine .cover");
  if (!button || !cover) {
    const width = window.innerWidth || 390;
    const height = window.innerHeight || 844;
    return {
      startX: width / 2,
      startY: 260,
      centerX: width / 2,
      centerY: height * 0.42,
      endX: width / 2,
      endY: 520,
    };
  }

  const start = button.getBoundingClientRect();
  const end = cover.getBoundingClientRect();
  return {
    startX: Math.round(start.left + start.width / 2),
    startY: Math.round(start.top + start.height / 2),
    centerX: Math.round(window.innerWidth / 2),
    centerY: Math.round(window.innerHeight * 0.42),
    endX: Math.round(end.left + end.width / 2),
    endY: Math.round(end.top + end.height / 2),
  };
}

function finishBook(writeNow) {
  const user = currentUser();
  const book = user.currentBook;
  if (!book) return;

  const finishedBook = {
    ...book,
    finishedAt: todayKey(),
    note: { title: "", body: "" },
    comments: [],
  };

  const people = state.people.map((person) =>
    person.id === state.currentUserId
      ? {
          ...person,
          currentBook: null,
          finishedBooks: [finishedBook, ...person.finishedBooks],
        }
      : person,
  );

  if (writeNow) {
    setState({
      people,
      page: "note",
      selectedBookId: finishedBook.id,
      modal: null,
    });
  } else {
    setState({
      people,
      page: "home",
      selectedBookId: null,
      modal: null,
    });
    showToast("已进入已读记录，可以开始下一本书。");
  }
}

function addBook(form) {
  const data = new FormData(form);
  const title = data.get("title").trim();
  if (!title) return;

  const palette = [
    "linear-gradient(150deg, #fffaf0, #ded9cf)",
    "linear-gradient(150deg, #f8f7f2, #d8dde6)",
    "linear-gradient(150deg, #fff5f8, #e7ded6)",
    "linear-gradient(150deg, #f7f2ff, #ded8e8)",
  ];

  const book = {
    id: makeId("book"),
    title,
    author: data.get("author").trim(),
    coverUrl: data.get("coverUrl").trim(),
    coverColor: palette[Math.floor(Math.random() * palette.length)],
    stars: 0,
    checkins: 0,
    startedAt: todayKey(),
    lastCheckinAt: "",
  };

  updateCurrentUser((person) => {
    person.currentBook = book;
    return person;
  });
  navigate("home");
  showToast("新书已开始，星星从 0 颗慢慢攒。");
}

function saveNote(form) {
  const book = selectedFinishedBook();
  if (!book) return;

  const data = new FormData(form);
  const body = data.get("noteBody").trim();
  if (!body) return;

  updateCurrentUser((person) => {
    person.finishedBooks = person.finishedBooks.map((item) =>
      item.id === book.id
        ? {
            ...item,
            note: {
              title: data.get("noteTitle").trim(),
              body,
            },
          }
        : item,
    );
    return person;
  });

  navigate("finished");
  showToast("读书笔记已保存。");
}

function addCommentToPeople(people, bookId, comment) {
  return people.map((person) => ({
    ...person,
    finishedBooks: person.finishedBooks.map((book) =>
      book.id === bookId
        ? {
            ...book,
            comments: [...(Array.isArray(book.comments) ? book.comments : []), comment],
          }
        : book,
    ),
  }));
}

async function saveComment(form) {
  const content = form.content.value.trim();
  const bookId = form.dataset.bookId;
  if (!content || !bookId) return;

  const user = currentUser();
  const comment = {
    id: makeId("comment"),
    noteId: bookId,
    bookId,
    userId: user.id,
    userName: user.name,
    content,
    createdAt: new Date().toISOString(),
  };

  form.content.value = "";

  if (state.syncStatus === "shared") {
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comment),
      });
      if (!response.ok) throw new Error("Comment save failed");
      const data = await response.json();
      const currentUserId = stableUserId();
      const normalized = normalizeVisualState({ ...state, currentUserId, people: data.people });
      state = { ...normalized, currentUserId, syncStatus: "shared" };
      saveState();
      render();
      return;
    } catch {
      showToast("评论暂时没有同步成功，已保存在本机。");
    }
  }

  setState({ people: addCommentToPeople(state.people, bookId, comment) });
}

app.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    navigate(routeButton.dataset.route);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  if (action === "open-checkin") setState({ modal: "checkin" }, false);
  if (action === "quick-checkin") confirmCheckin();
  if (action === "switch-user") switchUser(actionButton.dataset.userId);
  if (action === "open-finish") setState({ modal: "finish" }, false);
  if (action === "close-modal") {
    const clickedBackdrop = actionButton.classList.contains("modal-backdrop");
    if (!clickedBackdrop || event.target === actionButton) {
      setState({ modal: null }, false);
    }
  }
  if (action === "confirm-checkin") confirmCheckin();
  if (action === "finish-with-note") finishBook(true);
  if (action === "finish-later") finishBook(false);
  if (action === "edit-note") {
    navigate("note", { selectedBookId: actionButton.dataset.bookId });
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === "add-book") addBook(form);
  if (form.dataset.form === "note") saveNote(form);
  if (form.dataset.form === "comment") saveComment(form);
});

render();
loadSharedState();

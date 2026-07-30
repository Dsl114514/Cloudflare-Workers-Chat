// 共享状态
export const state = {
  currentWebSocket: null,
  currentRelayId: null,
  selectedColor: localStorage.getItem("chat_color") || "#000000",

  // DOM 元素引用
  nameForm: document.querySelector("#name-form"),
  roomNameInput: document.querySelector("#room-name"),
  goPublicButton: document.querySelector("#go-public"),
  goPrivateButton: document.querySelector("#go-private"),
  chatroom: document.querySelector("#chatroom"),
  chatlog: document.querySelector("#chatlog"),
  chatInput: document.querySelector("#chat-input"),
  roster: document.querySelector("#roster"),

  isAtBottom: true,
  username: undefined,
  roomname: undefined,
  roomListInterval: null,

  blockedUsers: new Set(),
  hostname: window.location.host || "edge-chat-demo.cloudflareworkers.com",

  lastSeenTimestamp: 0,
  wroteWelcomeMessages: false,
  originalDocTitle: document.title,
  unreadCount: 0,

  menuTargetUser: null,

  dmCache: {},
  dmTarget: null,
  dmUnread: 0,
  dmUnreadTimer: null,

  replyTarget: null,
  replyText: null,

  soundMuted: false,

  typingTimers: {},
  lastTypingSent: 0,

  searchResults: [],
  searchIndex: -1,

  origTitle: document.title,
  titleInterval: null,

  customEmoji: null, // {name: dataURL, ...} — loaded on startChat
};

export function loadBlockedUsers() {
  try { state.blockedUsers = new Set(JSON.parse(localStorage.getItem("chat_blocked") || "[]")); } catch (e) { state.blockedUsers = new Set(); }
}
export function saveBlockedUsers() {
  localStorage.setItem("chat_blocked", JSON.stringify([...state.blockedUsers]));
}
loadBlockedUsers();
window.addEventListener("storage", (e) => { if (e.key === "chat_blocked") loadBlockedUsers(); });

// Toast 通知系统 — 内联以避免独立模块的 CDN 缓存问题
let _toastContainer = null;
function _ensureToastContainer() {
  if (!_toastContainer || !document.body.contains(_toastContainer)) {
    _toastContainer = document.getElementById("toast-container");
    if (!_toastContainer) {
      _toastContainer = document.createElement("div");
      _toastContainer.id = "toast-container";
      document.body.appendChild(_toastContainer);
    }
  }
  return _toastContainer;
}
function _removeToast(toast) {
  if (toast.classList.contains("removing")) return;
  toast.classList.add("removing");
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
}
export function showToast(text, type, duration) {
  type = type || "info"; duration = duration || 3000;
  _ensureToastContainer();
  let toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  let icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  let iconSpan = document.createElement("span"); iconSpan.className = "toast-icon"; iconSpan.textContent = icons[type] || icons.info;
  toast.appendChild(iconSpan);
  let textSpan = document.createElement("span"); textSpan.className = "toast-text"; textSpan.textContent = text;
  toast.appendChild(textSpan);
  let close = document.createElement("span"); close.className = "toast-close"; close.textContent = "×";
  close.addEventListener("click", () => _removeToast(toast)); toast.appendChild(close);
  _toastContainer.appendChild(toast);
  if (duration > 0) setTimeout(() => _removeToast(toast), duration);
  return toast;
}
export function showSuccess(text, duration) { return showToast(text, "success", duration); }
export function showError(text, duration) { return showToast(text, "error", duration || 4000); }
export function showWarning(text, duration) { return showToast(text, "warning", duration || 4000); }
export function showInfo(text, duration) { return showToast(text, "info", duration); }

// Toast 通知系统
let container = null;

function ensureContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
  }
  return container;
}

export function showToast(text, type, duration) {
  type = type || "info";
  duration = duration || 3000;
  ensureContainer();

  let toast = document.createElement("div");
  toast.className = "toast toast-" + type;

  let icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  let iconSpan = document.createElement("span");
  iconSpan.className = "toast-icon";
  iconSpan.textContent = icons[type] || icons.info;
  toast.appendChild(iconSpan);

  let textSpan = document.createElement("span");
  textSpan.className = "toast-text";
  textSpan.textContent = text;
  toast.appendChild(textSpan);

  let close = document.createElement("span");
  close.className = "toast-close";
  close.textContent = "×";
  close.addEventListener("click", () => removeToast(toast));
  toast.appendChild(close);

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  if (toast.classList.contains("removing")) return;
  toast.classList.add("removing");
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 200);
}

export function showSuccess(text, duration) { return showToast(text, "success", duration); }
export function showError(text, duration) { return showToast(text, "error", duration || 4000); }
export function showWarning(text, duration) { return showToast(text, "warning", duration || 4000); }
export function showInfo(text, duration) { return showToast(text, "info", duration); }

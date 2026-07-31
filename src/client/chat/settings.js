// 设置面板 — 背景透明度等偏好
const BG_TINT_KEY = "bgTint";

// 应用背景磨砂层透明度（0~1）
export function applyBgTint(value) {
  let v = Math.max(0, Math.min(1, Number(value) || 1));
  document.documentElement.style.setProperty("--bg-tint", String(v));
  const valEl = document.getElementById("bg-opacity-value");
  const sliderEl = document.getElementById("bg-opacity-slider");
  if (valEl) valEl.textContent = Math.round(v * 100) + "%";
  if (sliderEl) sliderEl.value = Math.round(v * 100);
  return v;
}

// 启动时恢复保存的透明度
export function initSettings() {
  const saved = localStorage.getItem(BG_TINT_KEY);
  applyBgTint(saved === null ? 1 : saved);

  const slider = document.getElementById("bg-opacity-slider");
  if (slider) {
    slider.addEventListener("input", (e) => {
      const v = applyBgTint(e.target.value / 100);
      localStorage.setItem(BG_TINT_KEY, String(v));
    });
  }
}

export function openSettings() {
  document.getElementById("settings-overlay").classList.add("show");
  // 打开时同步当前值到滑块
  const cur = getComputedStyle(document.documentElement).getPropertyValue("--bg-tint").trim();
  applyBgTint(cur === "" ? 1 : parseFloat(cur));
}

export function closeSettings() {
  document.getElementById("settings-overlay").classList.remove("show");
}

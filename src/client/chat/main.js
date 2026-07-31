// 入口模块 — 只导入首屏必需模块，重模块延迟加载
import { state } from './state.js';
import { startNameChooser } from './auth.js';
import { startRoomList } from './rooms.js';
import { cancelReply, hideLightbox, galleryPrev, galleryNext, exportChatLog } from './ui.js';
import { hideUserMenu, handleMenuAction, showUserMenu } from './menu.js';
import { sendDM, closeDM } from './dm.js';
import { toggleSearch, doSearch, searchPrev, searchNext } from './search.js';
import { showHighlightsPanel } from './highlights.js';
import { toggleFavoritesPanel } from './favorites.js';
import { toggleRoomInfo } from './roominfo.js';
import { showSuccess, showInfo, showError } from './state.js';

// Window 兼容 — 重模块用延迟加载存根
function lazyMod(name, fnName) {
  return function(...args) {
    import('./' + name + '.js').then(m => {
      if (m[fnName]) try { m[fnName](...args); } catch(e) { showError("模块错误: " + e.message); }
    }).catch(e => showError("加载模块失败: " + e.message));
  };
}
const lazyMods = {
  openShop: ['shop', 'openShop'], closeShop: ['shop', 'closeShop'],
  switchShopTab: ['shop', 'switchShopTab'], buyItem: ['shop', 'buyItem'],
  equipItem: ['shop', 'equipItem'], unequipItem: ['shop', 'unequipItem'],
  openLottery: ['lottery', 'openLottery'], closeLottery: ['lottery', 'closeLottery'],
  doDraw: ['lottery', 'doDraw'],
  openTasks: ['tasks', 'openTasks'], closeTasks: ['tasks', 'closeTasks'],
  claimTask: ['tasks', 'claimTask'], completeTask: ['tasks', 'completeTask'],
  openGames: ['games', 'openGames'], closeGames: ['games', 'closeGames'],
  switchGame: ['games', 'switchGame'],
};
for (let [k, v] of Object.entries(lazyMods)) window[k] = lazyMod(v[0], v[1]);

window.toggleSearch = toggleSearch;
window.closeDM = closeDM;
window.exportChatLog = exportChatLog;

// 用户菜单
document.getElementById("user-menu").addEventListener("click", (e) => {
  let item = e.target.closest(".user-menu-item");
  if (item) handleMenuAction(item.dataset.action);
});
document.body.addEventListener("click", (e) => {
  if (!e.target.closest("#user-menu")) hideUserMenu();
});

// 回复取消
document.body.addEventListener("click", (e) => {
  if (e.target.closest(".reply-cancel")) cancelReply();
});

// @提及点击
document.body.addEventListener("click", (e) => {
  let mention = e.target.closest(".mention");
  if (mention) { e.preventDefault(); let name = mention.dataset.mention; if (name) showUserMenu(name, e.clientX, e.clientY); }
});

// 代码复制
document.body.addEventListener("click", (e) => {
  let btn = e.target.closest(".code-copy-btn");
  if (!btn) return;
  let code = btn.parentNode.querySelector("code");
  if (code) {
    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = "已复制"; btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("copied"); }, 2000);
    }).catch(() => {});
  }
});

// 收藏 - fav-close still exists, favorites-btn was moved to more-menu
document.getElementById("fav-close")?.addEventListener("click", toggleFavoritesPanel);

// 房间信息 - moved to more-menu
// 精华消息 - moved to more-menu
// 定时消息管理 - moved to more-menu

window._showScheduledList = function(list) {
  if (!list || list.length === 0) { showInfo("当前没有定时消息"); return; }
  let existing = document.getElementById("sched-list-panel");
  if (existing) { existing.remove(); return; }
  let overlay = document.createElement("div");
  overlay.id = "sched-list-panel";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:150;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  let panel = document.createElement("div");
  panel.style.cssText = "background:var(--surface);border-radius:12px;padding:16px;min-width:320px;max-width:420px;max-height:70vh;box-shadow:0 8px 32px rgba(0,0,0,0.2);color:var(--text);font-size:13px;display:flex;flex-direction:column;overflow:hidden;";
  panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="font-size:15px;">⏰ 定时消息 (' + list.length + ')</strong><span style="cursor:pointer;font-size:20px;line-height:1;color:var(--text-secondary);" id="sl-close">&times;</span></div>';
  let listDiv = document.createElement("div");
  listDiv.style.cssText = "flex:1;overflow-y:auto;";
  list.forEach(s => {
    let row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-radius:4px;margin-bottom:3px;background:var(--bg);";
    let timeStr = new Date(s.time).toLocaleString();
    let msgShort = s.message || "";
    row.innerHTML = '<div style="flex:1;overflow:hidden;"><div style="font-size:12px;font-weight:600;">' + s.name + '</div><div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + msgShort + '</div><div style="font-size:10px;color:#888;">' + timeStr + '</div></div>' +
      '<span style="cursor:pointer;color:#e74c3c;font-size:16px;flex-shrink:0;" data-sched-id="' + s.id + '">&times;</span>';
    row.querySelector("[data-sched-id]").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentWebSocket) {
        state.currentWebSocket.send(JSON.stringify({type: "schedule-cancel", id: s.id}));
        row.remove();
        if (listDiv.children.length === 0) { overlay.remove(); showSuccess("所有定时消息已取消"); }
      }
    });
    listDiv.appendChild(row);
  });
  panel.appendChild(listDiv);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.getElementById("sl-close").onclick = () => overlay.remove();
};

// 搜索
document.getElementById("search-toggle").addEventListener("click", toggleSearch);
document.getElementById("search-input").addEventListener("input", doSearch);
document.getElementById("search-prev").addEventListener("click", searchPrev);
document.getElementById("search-next").addEventListener("click", searchNext);
document.getElementById("search-close").addEventListener("click", toggleSearch);
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); if (e.shiftKey) searchPrev(); else searchNext(); }
  if (e.key === "Escape") toggleSearch();
});

// Lightbox
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target === e.currentTarget || e.target.classList.contains("lb-close")) hideLightbox();
});
document.getElementById("gallery-prev").addEventListener("click", (e) => { e.stopPropagation(); galleryPrev(); });
document.getElementById("gallery-next").addEventListener("click", (e) => { e.stopPropagation(); galleryNext(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideLightbox();
  if (e.key === "ArrowLeft") galleryPrev();
  if (e.key === "ArrowRight") galleryNext();
});

// 声音切换
document.getElementById("sound-toggle").addEventListener("click", () => {
  state.soundMuted = !state.soundMuted;
  document.getElementById("sound-toggle").textContent = state.soundMuted ? "🔇" : "🔊";
  document.getElementById("sound-toggle").classList.toggle("muted", state.soundMuted);
});

// 暗色模式 - 优先 localStorage，其次跟随系统设置
let savedDark = localStorage.getItem("darkMode");
if (savedDark === "1") {
  document.body.classList.add("dark");
  document.getElementById("dark-toggle").textContent = "☀️";
} else if (savedDark === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add("dark");
  document.getElementById("dark-toggle").textContent = "☀️";
  localStorage.setItem("darkMode", "1");
}
document.getElementById("dark-toggle").addEventListener("click", () => {
  let on = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", on ? "1" : "0");
  document.getElementById("dark-toggle").textContent = on ? "☀️" : "🌙";
});

// 主题切换 - 支持经典和亚克力主题
const THEMES = {
  classic: { name: '经典主题', file: '/static/styles/all-styles.css', icon: '🎨' },
  acrylic: { name: '亚克力主题', file: '/static/styles/acrylic-theme.css', icon: '✨' }
};

let currentTheme = localStorage.getItem('cloudchat-theme') || 'classic';

// 如果保存的是亚克力主题，加载它
if (currentTheme === 'acrylic') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = THEMES.acrylic.file;
  link.id = 'acrylic-theme-link';
  document.head.appendChild(link);
}

// 初始化主题按钮
function initThemeButtons() {
  const themeToggle = document.getElementById("theme-toggle");
  const mbbTheme = document.querySelector("#mbb-theme");

  if (themeToggle) {
    themeToggle.textContent = THEMES[currentTheme].icon;

    // 移除旧的事件监听器（如果存在）
    themeToggle.replaceWith(themeToggle.cloneNode(true));
    const newThemeToggle = document.getElementById("theme-toggle");

    // 添加新的事件监听器
    newThemeToggle.addEventListener("click", handleThemeToggle);
  }

  if (mbbTheme) {
    mbbTheme.textContent = THEMES[currentTheme].icon;

    // 为移动端按钮也添加直接的事件监听器
    mbbTheme.replaceWith(mbbTheme.cloneNode(true));
    const newMbbTheme = document.querySelector("#mbb-theme");
    if (newMbbTheme) {
      newMbbTheme.addEventListener("click", handleThemeToggle);
    }
  }
}

// 主题切换处理函数
function handleThemeToggle() {
  const nextTheme = currentTheme === 'classic' ? 'acrylic' : 'classic';
  const themeConfig = THEMES[nextTheme];

  // 移除旧主题
  const oldLink = document.getElementById('acrylic-theme-link');
  if (oldLink) oldLink.remove();

  // 如果切换到亚克力主题，加载CSS
  if (nextTheme === 'acrylic') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = themeConfig.file;
    link.id = 'acrylic-theme-link';
    document.head.appendChild(link);
  }

  // 更新状态
  currentTheme = nextTheme;
  localStorage.setItem('cloudchat-theme', nextTheme);

  // 更新按钮图标
  const themeToggle = document.getElementById("theme-toggle");
  const mbbTheme = document.querySelector("#mbb-theme");
  if (themeToggle) themeToggle.textContent = themeConfig.icon;
  if (mbbTheme) mbbTheme.textContent = themeConfig.icon;

  // 显示通知
  showInfo(`已切换到${themeConfig.name}`);
}

// 延迟初始化，确保DOM已加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeButtons);
} else {
  initThemeButtons();
}

// 背景图片切换
const BG_IMAGE_API = "https://api.elaina.cat/random/pc/";
const BG_STORAGE_KEY = "cloudchat-bg-image";

function applyBgImage(url) {
  if (url) {
    document.body.style.backgroundImage = `url("${url}")`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundAttachment = "fixed";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundRepeat = "";
    document.body.style.backgroundAttachment = "";
  }
}

function initBgImage() {
  const saved = localStorage.getItem(BG_STORAGE_KEY);
  if (saved) applyBgImage(saved);
}

async function changeBgImage() {
  const btn = document.getElementById("bg-image-toggle");
  const mbbBtn = document.getElementById("mbb-bg-image");
  try {
    if (btn) btn.style.opacity = "0.5";
    if (mbbBtn) mbbBtn.style.opacity = "0.5";
    const resp = await fetch(BG_IMAGE_API + "?_=" + Date.now());
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    applyBgImage(url);
    localStorage.setItem(BG_STORAGE_KEY, url);
    showInfo("背景图片已更新");
  } catch (e) {
    showError("背景图片加载失败: " + e.message);
  } finally {
    if (btn) btn.style.opacity = "";
    if (mbbBtn) mbbBtn.style.opacity = "";
  }
}

function resetBgImage() {
  applyBgImage(null);
  localStorage.removeItem(BG_STORAGE_KEY);
  showInfo("背景图片已清除");
}

function initBgImageButtons() {
  const bgToggle = document.getElementById("bg-image-toggle");
  const mbbBg = document.getElementById("mbb-bg-image");
  if (bgToggle) {
    bgToggle.addEventListener("click", changeBgImage);
    bgToggle.addEventListener("contextmenu", (e) => { e.preventDefault(); resetBgImage(); });
  }
  if (mbbBg) {
    mbbBg.addEventListener("click", changeBgImage);
    mbbBg.addEventListener("contextmenu", (e) => { e.preventDefault(); resetBgImage(); });
  }
  initBgImage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBgImageButtons);
} else {
  initBgImageButtons();
}

// Service Worker
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

// 可见性变化 - 未读计数重置
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { state.unreadCount = 0; document.title = state.originalDocTitle; }
});

// 私信回车发送
document.addEventListener("keydown", function(e) {
  if (e.target && e.target.id === "dm-input" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDM(); }
});

// 全局 Escape
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeShop(); closeTasks(); closeGames(); } });

// 启动登录界面
startNameChooser();

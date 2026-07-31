// 音乐播放器 — 基于网易云音乐 API (https://github.com/TH911/NeteaseCloudMusicApi)
import { showError, showInfo } from './state.js';

const API_KEY = "musicApiBase";
let apiBase = localStorage.getItem(API_KEY) || "";
let queue = [];      // 播放队列
let currentIndex = -1;
let audio = null;
let seeking = false;

// ---- 工具 ----
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.addEventListener("timeupdate", () => {
    if (seeking) return;
    const bar = document.getElementById("music-progress-bar");
    const cur = document.getElementById("music-time-current");
    if (bar && audio.duration) bar.value = (audio.currentTime / audio.duration) * 100;
    if (cur) cur.textContent = fmtTime(audio.currentTime);
  });
  audio.addEventListener("loadedmetadata", () => {
    const total = document.getElementById("music-time-total");
    if (total) total.textContent = fmtTime(audio.duration);
  });
  audio.addEventListener("ended", () => next());
  audio.addEventListener("play", () => {
    const btn = document.getElementById("music-play");
    if (btn) btn.textContent = "⏸";
  });
  audio.addEventListener("pause", () => {
    const btn = document.getElementById("music-play");
    if (btn) btn.textContent = "▶";
  });
  audio.addEventListener("error", () => {
    showError("播放失败，可能无版权或需要登录");
  });
  return audio;
}

// ---- API 调用 ----
async function apiGet(path, params) {
  if (!apiBase) { showError("请先填写 API 地址"); throw new Error("no api base"); }
  const base = apiBase.replace(/\/+$/, "");
  const qs = new URLSearchParams(params).toString();
  const url = base + path + (qs ? "?" + qs : "");
  const res = await fetch(url);
  if (!res.ok) throw new Error("API 请求失败: " + res.status);
  return res.json();
}

// ---- 搜索 ----
export async function searchMusic(keywords) {
  if (!keywords || !keywords.trim()) { showInfo("请输入搜索内容"); return; }
  if (!apiBase) { showError("请先填写 API 地址"); return; }
  const container = document.getElementById("music-results");
  container.innerHTML = '<div class="music-empty">搜索中...</div>';
  try {
    const data = await apiGet("/search", { keywords: keywords.trim(), limit: 30 });
    const songs = (data && data.result && data.result.songs) || [];
    if (!songs.length) { container.innerHTML = '<div class="music-empty">未找到相关歌曲</div>'; return; }
    queue = songs.map(s => ({
      id: s.id,
      name: s.name,
      artist: (s.artists || []).map(a => a.name).join(" / "),
      album: (s.album && s.album.name) || ""
    }));
    renderResults();
  } catch (e) {
    container.innerHTML = '<div class="music-empty">搜索失败：' + escapeHtml(e.message) + '</div>';
  }
}

function renderResults() {
  const container = document.getElementById("music-results");
  container.innerHTML = queue.map((s, i) => `
    <div class="music-item ${i === currentIndex ? 'playing' : ''}" data-idx="${i}">
      <div class="music-item-info">
        <div class="music-item-name">${escapeHtml(s.name)}</div>
        <div class="music-item-artist">${escapeHtml(s.artist)}${s.album ? ' · ' + escapeHtml(s.album) : ''}</div>
      </div>
      <button class="music-item-play" data-idx="${i}" title="播放">${i === currentIndex ? '⏸' : '▶'}</button>
    </div>
  `).join("");
  // 绑定点击
  container.querySelectorAll(".music-item").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.idx, 10);
      if (idx === currentIndex && audio && !audio.paused) pause();
      else playIndex(idx);
    });
  });
}

// ---- 播放 ----
export async function playIndex(idx) {
  if (idx < 0 || idx >= queue.length) return;
  currentIndex = idx;
  const song = queue[idx];
  const player = document.getElementById("music-player");
  player.style.display = "";
  document.getElementById("music-now-name").textContent = song.name;
  document.getElementById("music-now-artist").textContent = song.artist;
  document.getElementById("music-cover").style.visibility = "hidden";
  document.getElementById("music-cover").src = "";
  document.getElementById("music-time-current").textContent = "0:00";
  document.getElementById("music-time-total").textContent = "0:00";
  document.getElementById("music-progress-bar").value = 0;
  renderResults();

  const a = ensureAudio();
  a.src = "";
  a.pause();
  try {
    // 获取播放链接
    const urlData = await apiGet("/song/url", { id: song.id });
    const d = (urlData && urlData.data && urlData.data[0]);
    if (!d || !d.url) { showError("无法获取播放链接（可能无版权）"); return; }
    a.src = d.url;
    a.play().catch(() => showError("自动播放被浏览器拦截，请点击播放按钮"));
    // 获取封面
    fetchCover(song.id);
  } catch (e) {
    showError("播放失败：" + e.message);
  }
}

async function fetchCover(id) {
  try {
    const data = await apiGet("/song/detail", { ids: id });
    const s = (data && data.songs && data.songs[0]);
    const pic = s && s.al && s.al.picUrl;
    if (pic) {
      const img = document.getElementById("music-cover");
      img.src = pic;
      img.style.visibility = "visible";
    }
  } catch (e) { /* 封面非必需，忽略 */ }
}

export function togglePlay() {
  const a = ensureAudio();
  if (!a.src) { if (queue.length) playIndex(currentIndex < 0 ? 0 : currentIndex); return; }
  if (a.paused) a.play(); else a.pause();
}

export function pause() {
  const a = ensureAudio();
  if (a.src && !a.paused) a.pause();
}

export function next() {
  if (!queue.length) return;
  playIndex((currentIndex + 1) % queue.length);
}

export function prev() {
  if (!queue.length) return;
  playIndex((currentIndex - 1 + queue.length) % queue.length);
}

// ---- 面板开闭 ----
export function openMusic() {
  document.getElementById("music-overlay").classList.add("show");
  document.getElementById("music-api-input").value = apiBase;
  const input = document.getElementById("music-search-input");
  if (input) input.focus();
}

export function closeMusic() {
  document.getElementById("music-overlay").classList.remove("show");
}

export function saveApiBase() {
  const val = document.getElementById("music-api-input").value.trim();
  if (!val) { showError("请输入 API 地址"); return; }
  apiBase = val;
  localStorage.setItem(API_KEY, val);
  showInfo("API 地址已保存");
}

// ---- 初始化事件 ----
export function initMusic() {
  document.getElementById("music-toggle").addEventListener("click", openMusic);
  document.getElementById("music-search-btn").addEventListener("click", () => {
    searchMusic(document.getElementById("music-search-input").value);
  });
  document.getElementById("music-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchMusic(e.target.value);
  });
  document.getElementById("music-api-save").addEventListener("click", saveApiBase);
  document.getElementById("music-play").addEventListener("click", togglePlay);
  document.getElementById("music-next").addEventListener("click", next);
  document.getElementById("music-prev").addEventListener("click", prev);
  const bar = document.getElementById("music-progress-bar");
  bar.addEventListener("input", () => { seeking = true; });
  bar.addEventListener("change", () => {
    const a = ensureAudio();
    if (a.duration) a.currentTime = (bar.value / 100) * a.duration;
    seeking = false;
  });
}

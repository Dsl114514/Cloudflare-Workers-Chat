// 发送消息页面
import { state } from './state.js';

export async function loadSendMessageSection() {
  let sel = document.getElementById("sm-room");
  if (!sel) return;
  if (sel.options.length > 1) return;
  try {
    let r = await fetch("/api/rooms/list");
    let rooms = await r.json();
    sel.innerHTML = '<option value="">选择房间...</option>';
    Object.keys(rooms).forEach(name => {
      let opt = document.createElement("option");
      opt.value = name;
      opt.textContent = '#' + name + ' (' + rooms[name] + ' 在线)';
      sel.appendChild(opt);
    });
  } catch (e) {
    sel.innerHTML = '<option value="">加载房间列表失败</option>';
  }
}

export async function sendMessage() {
  let room = document.getElementById("sm-room").value;
  let sender = document.getElementById("sm-sender").value.trim() || "系统公告";
  let text = document.getElementById("sm-text").value.trim();
  let statusEl = document.getElementById("sm-status");
  if (!room) { statusEl.textContent = "请选择目标房间"; return; }
  if (!text) { statusEl.textContent = "请输入消息内容"; return; }
  let btn = document.getElementById("sm-send-btn");
  btn.disabled = true;
  btn.textContent = "发送中...";
  statusEl.textContent = "";
  try {
    let r = await fetch("/api/admin/send-message/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(state.adminKey) + "&text=" + encodeURIComponent(text) + "&sender=" + encodeURIComponent(sender));
    let result = await r.text();
    statusEl.textContent = r.ok ? "✓ " + result : "✗ " + result;
    if (r.ok) document.getElementById("sm-text").value = "";
  } catch (e) {
    statusEl.textContent = "发送失败: " + e.message;
  }
  btn.disabled = false;
  btn.textContent = "发送";
}

export async function quickSendMessage(room) {
  let input = document.getElementById("qmsg-input-" + room.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!input) return;
  let text = input.value.trim();
  if (!text) { alert("请输入消息内容"); return; }
  try {
    let r = await fetch("/api/admin/send-message/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(state.adminKey) + "&text=" + encodeURIComponent(text) + "&sender=系统通知");
    let result = await r.text();
    if (r.ok) { input.value = ""; alert(result); }
    else alert(result);
  } catch (e) {
    alert("发送失败: " + e.message);
  }
}

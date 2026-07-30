// 踢出保护管理 — ES Module
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export async function loadKickProtected() {
  let list = document.querySelector("#kp-list");
  if (!list) return;
  try {
    let r = await fetch("/api/admin/kick-protect/list?key=" + encodeURIComponent(state.adminKey));
    let data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = '<div style="color:#888;padding:8px 0">暂无受保护的用户</div>';
      return;
    }
    let html = '';
    data.forEach(name => {
      html += '<div class="banned-user-item">' +
        '<span class="name">' + escapeHtml(name) + '</span>' +
        '<button onclick="kickProtectRemove(\'' + name.replace(/'/g, "\\'") + '\')" style="padding:4px 10px;border:1px solid #e88;color:#c00;background:#fff;border-radius:4px;cursor:pointer;font-size:85%">移除保护</button>' +
        '</div>';
    });
    list.innerHTML = html;
  } catch(e) {
    list.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败</div>';
  }
}

export async function kickProtectAdd() {
  let name = document.querySelector("#kp-input").value.trim();
  if (!name) { alert("请输入用户名"); return; }
  try {
    let r = await fetch("/api/admin/kick-protect/add?key=" + encodeURIComponent(state.adminKey) + "&name=" + encodeURIComponent(name));
    let text = await r.text();
    alert(text);
    document.querySelector("#kp-input").value = "";
    loadKickProtected();
  } catch(e) { alert("操作失败: " + e.message); }
}

export async function kickProtectRemove(name) {
  if (!confirm("确定移除 " + name + " 的踢出保护？")) return;
  try {
    let r = await fetch("/api/admin/kick-protect/remove?key=" + encodeURIComponent(state.adminKey) + "&name=" + encodeURIComponent(name));
    let text = await r.text();
    alert(text);
    loadKickProtected();
  } catch(e) { alert("操作失败: " + e.message); }
}

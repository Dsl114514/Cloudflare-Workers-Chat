// 机器人命令管理
import { state } from './state.js';

function escapeHtml(s) {
  let d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

export async function loadBotSection() {
  let list = document.getElementById("bot-list");
  if (!list) return;
  list.innerHTML = '<div style="color:#888;text-align:center;padding:20px">加载中...</div>';
  try {
    let r = await fetch("/api/admin/bot?action=list&key=" + encodeURIComponent(state.adminKey));
    let cmds = await r.json();
    if (!Array.isArray(cmds) || cmds.length === 0) {
      list.innerHTML = '<div style="color:#888;text-align:center;padding:20px">暂无命令，添加一个新命令吧</div>';
      return;
    }
    list.innerHTML = "";
    cmds.forEach(cmd => {
      let row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;";
      let enabled = cmd.enabled !== false;
      row.innerHTML =
        '<span style="font-weight:bold;min-width:80px">' + escapeHtml(cmd.keyword) + '</span>' +
        '<span style="flex:1;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(cmd.response || "") + '</span>' +
        '<span style="font-size:12px;padding:2px 8px;border-radius:4px;background:' + (enabled ? "#e8f5e9" : "#fde8e8") + ';color:' + (enabled ? "#2e7d32" : "#c62828") + '">' + (enabled ? "启用" : "禁用") + '</span>' +
        '<button onclick="toggleBot(\'' + cmd.keyword.replace(/'/g, "\\'") + '\')" style="padding:4px 8px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:80%">' + (enabled ? "禁用" : "启用") + '</button>' +
        '<button onclick="deleteBot(\'' + cmd.keyword.replace(/'/g, "\\'") + '\')" style="padding:4px 8px;border:1px solid #e88;color:#c00;background:#fff;border-radius:4px;cursor:pointer;font-size:80%">删除</button>';
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = '<div style="color:#c00;text-align:center;padding:20px">加载失败</div>';
  }
}

export async function addBot() {
  let keyword = document.getElementById("bot-keyword").value.trim();
  let response = document.getElementById("bot-response").value.trim();
  if (!keyword) { alert("请输入命令关键词"); return; }
  if (!response) { alert("请输入回复内容"); return; }
  try {
    let r = await fetch("/api/admin/bot?action=add&key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({keyword, response})
    });
    let data = await r.json();
    if (data.ok) {
      document.getElementById("bot-keyword").value = "";
      document.getElementById("bot-response").value = "";
      loadBotSection();
    } else {
      alert("添加失败: " + (data.error || "未知错误"));
    }
  } catch (e) {
    alert("添加失败: " + e.message);
  }
}

export async function toggleBot(keyword) {
  try {
    let r = await fetch("/api/admin/bot?action=get&keyword=" + encodeURIComponent(keyword) + "&key=" + encodeURIComponent(state.adminKey));
    let cmd = await r.json();
    let newEnabled = cmd.enabled === false;
    await fetch("/api/admin/bot?action=update&key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({keyword, response: cmd.response || "", enabled: newEnabled})
    });
    loadBotSection();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

export async function deleteBot(keyword) {
  if (!confirm("确定删除命令 /" + keyword + " ？")) return;
  try {
    await fetch("/api/admin/bot?action=delete&keyword=" + encodeURIComponent(keyword) + "&key=" + encodeURIComponent(state.adminKey));
    loadBotSection();
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

// 兑换码管理 — ES Module
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export async function loadRedeemSection() {
  let list = document.querySelector("#rc-list");
  let stats = document.querySelector("#rc-stats");
  if (!list) return;
  try {
    let r = await fetch("/api/admin/redeem/list?key=" + encodeURIComponent(state.adminKey));
    let data = await r.json();
    let entries = Object.entries(data);
    if (entries.length === 0) {
      list.innerHTML = '<div style="color:#888;text-align:center;padding:30px;font-size:13px">暂无兑换码</div>';
      stats.textContent = "共 0 个兑换码";
      return;
    }
    let used = entries.filter(([, info]) => info.usedBy).length;
    stats.textContent = "共 " + entries.length + " 个兑换码，已使用 " + used + " 个";
    let html = '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="background:#f8f9fa;text-align:left">' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">兑换码</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">积分</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">状态</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">创建人</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">创建时间</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">使用人</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">操作</th>' +
      '</tr></thead><tbody>';
    entries.sort((a, b) => {
      // 未使用的排在前面
      let aUsed = a[1].usedBy ? 1 : 0;
      let bUsed = b[1].usedBy ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return (b[1].createdAt || 0) - (a[1].createdAt || 0);
    });
    for (let [code, info] of entries) {
      let usedBy = info.usedBy || "";
      let usedAt = info.usedAt ? new Date(info.usedAt).toLocaleString() : "";
      let createdAt = info.createdAt ? new Date(info.createdAt).toLocaleString() : "-";
      let statusHtml = usedBy
        ? '<span style="color:#999">已使用</span>'
        : '<span style="color:#27ae60;font-weight:600">未使用</span>';
      let delBtn = usedBy ? ""
        : '<button onclick="deleteRedeemCode(\'' + code.replace(/'/g, "\\'") + '\')" style="padding:2px 8px;border:1px solid #e88;color:#c00;background:#fff;border-radius:4px;cursor:pointer;font-size:11px">删除</button>';
      html += '<tr style="border-bottom:1px solid #f0f0f0">' +
        '<td style="padding:8px 10px;font-family:monospace;font-weight:700">' + escapeHtml(code) + '</td>' +
        '<td style="padding:8px 10px;color:#f39c12;font-weight:700">' + Number(info.points).toLocaleString() + '</td>' +
        '<td style="padding:8px 10px">' + statusHtml + '</td>' +
        '<td style="padding:8px 10px;color:#888">' + escapeHtml(info.createdBy || "-") + '</td>' +
        '<td style="padding:8px 10px;color:#888;font-size:12px">' + createdAt + '</td>' +
        '<td style="padding:8px 10px;color:#888">' + (usedBy ? escapeHtml(usedBy) + '<br><span style="font-size:11px;color:#bbb">' + usedAt + '</span>' : '-') + '</td>' +
        '<td style="padding:8px 10px">' + delBtn + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div style="color:#c00;text-align:center;padding:30px;font-size:13px">加载失败</div>';
  }
}

export async function generateRedeemCodes() {
  let points = document.querySelector("#rc-points").value;
  let count = document.querySelector("#rc-count").value;
  let prefix = document.querySelector("#rc-prefix").value.trim().toUpperCase();
  let statusEl = document.querySelector("#rc-gen-status");
  if (!points || parseInt(points) <= 0) { alert("请输入有效积分"); return; }
  if (!count || parseInt(count) <= 0) { alert("请输入有效数量"); return; }
  if (parseInt(count) > 100) { alert("单次最多生成100个"); return; }
  statusEl.textContent = "生成中...";
  try {
    let r = await fetch("/api/admin/redeem/generate?key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({points: String(points), count: parseInt(count), prefix, createdBy: "admin"})
    });
    let data = await r.json();
    if (data.ok && data.codes) {
      statusEl.textContent = "✓ 已生成 " + data.count + " 个兑换码";
      loadRedeemSection();
      alert("已生成 " + data.count + " 个兑换码:\n" + data.codes.join("\n"));
    } else {
      alert("生成失败: " + (data.error || "未知错误"));
      statusEl.textContent = "";
    }
  } catch(e) {
    alert("生成失败: " + e.message);
    statusEl.textContent = "";
  }
}

export async function addRedeemCode() {
  let code = document.querySelector("#rc-custom-code").value.trim().toUpperCase();
  let points = document.querySelector("#rc-custom-points").value;
  let statusEl = document.querySelector("#rc-add-status");
  if (!code) { alert("请输入兑换码"); return; }
  if (!points || parseInt(points) <= 0) { alert("请输入有效积分"); return; }
  if (code.length < 4) { alert("兑换码至少4位字符"); return; }
  statusEl.textContent = "添加中...";
  try {
    let r = await fetch("/api/admin/redeem/add?key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({code, points: String(points), createdBy: "admin"})
    });
    let data = await r.json();
    if (data.ok) {
      document.querySelector("#rc-custom-code").value = "";
      statusEl.textContent = "✓ 已添加";
      loadRedeemSection();
    } else {
      alert("添加失败: " + (data.error || "未知错误"));
      statusEl.textContent = "";
    }
  } catch(e) {
    alert("添加失败: " + e.message);
    statusEl.textContent = "";
  }
}

export async function deleteRedeemCode(code) {
  if (!confirm("确定删除兑换码 " + code + " ？")) return;
  try {
    let r = await fetch("/api/admin/redeem/delete?key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({code})
    });
    let data = await r.json();
    if (data.ok) {
      loadRedeemSection();
    } else {
      alert("删除失败: " + (data.error || "未知错误"));
    }
  } catch(e) {
    alert("删除失败: " + e.message);
  }
}

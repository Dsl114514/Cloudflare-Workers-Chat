// 积分管理
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export async function loadPointsSection() {
  try {
    let r = await fetch("/api/admin/points/all?key=" + encodeURIComponent(state.adminKey));
    let data = await r.json();
    renderPointsTable(data);
    updatePointsStats(data);
  } catch (e) {
    document.querySelector("#pts-tbody").innerHTML = '<tr><td colspan="4" style="color:#c00;text-align:center;padding:20px">加载失败</td></tr>';
  }
}

function renderPointsTable(data) {
  let tbody = document.querySelector("#pts-tbody");
  let empty = document.querySelector("#pts-empty");
  let entries = Object.entries(data);
  if (entries.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  entries.sort((a, b) => {
    let bi = 0n, ai = 0n;
    try { bi = BigInt(String(b[1])); } catch {}
    try { ai = BigInt(String(a[1])); } catch {}
    return bi < ai ? -1 : bi > ai ? 1 : 0;
  });
  let html = '';
  entries.forEach(([user, pts]) => {
    let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
    let highlight = state.ptsSelectedUser === user ? ' class="pts-highlight"' : '';
    let escUser = user.replace(/'/g, "\\'");
    let checked = (state.ptsCheckedUsers.has(user)) ? ' checked' : '';
    html += '<tr' + highlight + '>' +
      '<td><input type="checkbox" class="pts-cb-row" value="' + escUser + '" onchange="updateSelectedCount()"' + checked + '></td>' +
      '<td class="p-name">' + escapeHtml(user) + '</td>' +
      '<td class="p-points">' + pts + '</td>' +
      '<td class="p-actions">' +
        '<input type="number" id="pts-inline-' + safeId + '" placeholder="值" value="' + pts + '">' +
        '<button class="btn-set" onclick="setPtsInline(\'' + escUser + '\')">设置</button>' +
        '<button class="btn-add" onclick="addPtsInline(\'' + escUser + '\')">+增加</button>' +
        '<button class="btn-deduct" onclick="deductPtsInline(\'' + escUser + '\')">-扣除</button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

function updatePointsStats(data) {
  let entries = Object.entries(data);
  let total = 0n;
  for (let [, p] of entries) {
    try { total += BigInt(String(p)); } catch {}
  }
  document.querySelector("#pts-stats").textContent = '共 ' + entries.length + ' 人，总积分 ' + String(total);
}

export function searchPointsUser() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  if (!name) return;
  selectPointsUser(name);
}

function selectPointsUser(name) {
  state.ptsSelectedUser = name;
  let infoDiv = document.querySelector("#pts-user-info");
  infoDiv.style.display = 'flex';
  document.querySelector("#pts-info-user").textContent = name;
  let rows = document.querySelector("#pts-tbody").querySelectorAll("tr");
  let found = false;
  rows.forEach(row => {
    let firstTd = row.querySelector("td");
    if (firstTd && firstTd.textContent === name) {
      let pointsTd = row.querySelector(".p-points");
      if (pointsTd) {
        document.querySelector("#pts-info-pts").textContent = pointsTd.textContent;
        found = true;
      }
    }
  });
  if (!found) {
    document.querySelector("#pts-info-pts").textContent = '0（暂无积分记录）';
  }
  document.querySelector("#pts-tb-user").value = name;
  loadPointsSection();
}

export async function setPtsToolbar() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  let raw = document.querySelector("#pts-tb-amt").value;
  if (!name) { alert("请输入用户名"); return; }
  if (!raw || isNaN(Number(raw))) { alert("请输入有效积分值"); return; }
  await callPointsApi('set', name, raw);
}

export async function addPtsToolbar() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  let raw = document.querySelector("#pts-tb-amt").value;
  if (!name) { alert("请输入用户名"); return; }
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) { alert("请输入有效的增加数量"); return; }
  await callPointsApi('add', name, raw);
}

export async function deductPtsToolbar() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  let raw = document.querySelector("#pts-tb-amt").value;
  if (!name) { alert("请输入用户名"); return; }
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) { alert("请输入有效的扣除数量"); return; }
  await callPointsApi('add', name, '-' + raw);
}

export async function setPtsInline(user) {
  let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
  let input = document.querySelector("#pts-inline-" + safeId);
  if (!input) return;
  let raw = input.value;
  if (!raw || isNaN(Number(raw))) { alert("请输入有效积分值"); return; }
  await callPointsApi('set', user, raw);
}

export async function addPtsInline(user) {
  let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
  let input = document.querySelector("#pts-inline-" + safeId);
  if (!input) return;
  let raw = input.value;
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) { alert("请输入有效的增加数量"); return; }
  await callPointsApi('add', user, raw);
}

export async function deductPtsInline(user) {
  let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
  let input = document.querySelector("#pts-inline-" + safeId);
  if (!input) return;
  let raw = input.value;
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) { alert("请输入有效的扣除数量"); return; }
  await callPointsApi('add', user, '-' + raw);
}

async function callPointsApi(action, name, amount) {
  try {
    let r = await fetch("/api/admin/points/" + action + "?key=" + encodeURIComponent(state.adminKey) + "&name=" + encodeURIComponent(name) + "&amount=" + encodeURIComponent(String(amount)));
    let t = await r.text();
    alert(t);
    state.ptsSelectedUser = name;

    let newPoints = null;
    let m = t.match(/当前\s*(-?\d+)/);
    if (m) {
      newPoints = m[1];
    } else if (action === 'set') {
      newPoints = String(amount);
    }

    if (newPoints !== null) {
      updatePointsRowLocal(name, newPoints);
    } else {
      await loadPointsSection();
    }
    selectPointsUser(name);
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

function updatePointsRowLocal(name, newPts) {
  let rows = document.querySelector("#pts-tbody").querySelectorAll("tr");
  let oldPts = "0";
  let found = false;
  for (let row of rows) {
    let nameTd = row.querySelector(".p-name");
    if (nameTd && nameTd.textContent === name) {
      let ptsTd = row.querySelector(".p-points");
      if (ptsTd) {
        oldPts = ptsTd.textContent || "0";
        ptsTd.textContent = newPts;
      }
      let inlineInput = row.querySelector("input[id^='pts-inline-']");
      if (inlineInput) inlineInput.value = newPts;
      found = true;
      break;
    }
  }

  if (!found) { loadPointsSection(); return; }

  document.querySelector("#pts-info-pts").textContent = newPts;

  let statsEl = document.querySelector("#pts-stats");
  let totalMatch = statsEl.textContent.match(/总积分\s*(-?\d+)/);
  if (totalMatch) {
    let total = BigInt(totalMatch[1]);
    let diff = BigInt(newPts) - BigInt(oldPts);
    statsEl.textContent = statsEl.textContent.replace(/总积分\s*(-?\d+)/, '总积分 ' + String(total + diff));
  }
}

export function toggleAllCheckboxes() {
  let headCb = document.querySelector("#pts-cb-all-head");
  let barCb = document.querySelector("#pts-cb-all");
  let checked = headCb ? headCb.checked : (barCb ? barCb.checked : false);
  if (headCb) headCb.checked = checked;
  if (barCb) barCb.checked = checked;
  document.querySelectorAll(".pts-cb-row").forEach(cb => cb.checked = checked);
  updateSelectedCount();
}

export function updateSelectedCount() {
  let checkboxes = document.querySelectorAll(".pts-cb-row:checked");
  checkboxes.forEach(cb => {
    state.ptsCheckedUsers.add(cb.value);
  });
  document.querySelectorAll(".pts-cb-row:not(:checked)").forEach(cb => {
    state.ptsCheckedUsers.delete(cb.value);
  });
  document.querySelector("#pts-sel-count").textContent = checkboxes.length;
}

export async function batchAdd() {
  let raw = document.querySelector("#pts-batch-amt").value;
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) { alert("请输入有效的增加数量"); return; }
  await doBatch(raw);
}

export async function batchDeduct() {
  let raw = document.querySelector("#pts-batch-amt").value;
  if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) { alert("请输入有效的扣除数量"); return; }
  await doBatch('-' + raw);
}

async function doBatch(amount) {
  let checkboxes = document.querySelectorAll(".pts-cb-row:checked");
  if (checkboxes.length === 0) { alert("请先勾选要操作的用户"); return; }
  let names = [];
  checkboxes.forEach(cb => names.push(cb.value));
  if (!confirm("确定为 " + names.length + " 个用户" + (amount >= 0 ? "增加" : "扣除") + " " + Math.abs(amount) + " 积分吗？")) return;
  try {
    let r = await fetch("/api/admin/points/batch?key=" + encodeURIComponent(state.adminKey) + "&names=" + encodeURIComponent(names.join(",")) + "&amount=" + amount + "&action=add");
    let t = await r.text();
    alert(t);
    loadPointsSection();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

export function exportPointsCSV() {
  let table = document.querySelector("#pts-tbody");
  if (!table) { alert("请先打开积分管理页面"); return; }
  let rows = table.querySelectorAll("tr");
  if (rows.length === 0) { alert("暂无积分数据可导出"); return; }
  let csv = "﻿用户名,积分\n";
  rows.forEach(row => {
    let nameTd = row.querySelector(".p-name");
    let ptsTd = row.querySelector(".p-points");
    if (nameTd && ptsTd) {
      let name = nameTd.textContent.trim();
      let pts = ptsTd.textContent.trim();
      csv += name + "," + pts + "\n";
    }
  });
  let blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = "积分数据_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 工具栏 Enter 键支持
(function() {
  function initPtsEvents() {
    var userInput = document.querySelector("#pts-tb-user");
    var amtInput = document.querySelector("#pts-tb-amt");
    if (userInput) {
      userInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") searchPointsUser();
      });
    }
    if (amtInput) {
      amtInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") setPtsToolbar();
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPtsEvents);
  } else {
    initPtsEvents();
  }
})();

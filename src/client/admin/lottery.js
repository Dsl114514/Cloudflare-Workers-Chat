// 抽奖管理
import { state } from './state.js';
import { TAG_COLORS, escapeHtml } from './utils.js';

export async function loadLotteryPools() {
  let container = document.getElementById("lottery-pools-container");
  if (!container) return;
  try {
    let r = await fetch("/api/admin/lottery/pools?key=" + encodeURIComponent(state.adminKey));
    let data = await r.json();
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#888;padding:20px">暂无奖池</div>';
      return;
    }
    container.innerHTML = data.map(function(pool) {
      return '<div class="lottery-pool-card" style="border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:12px;background:var(--card-bg,#fff)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        + '<div><strong>' + escapeHtml(pool.name) + '</strong> <span style="color:#888;font-size:90%">(' + (pool.enabled ? "启用" : "禁用") + ')</span></div>'
        + '<div style="display:flex;gap:4px">'
        + '<button class="btn-primary" onclick="showEditPoolForm(\'' + pool.id + '\',\'' + (pool.name||"").replace(/'/g,"") + '\',\'' + (pool.description||"").replace(/'/g,"") + '\',' + pool.cost + ')" style="padding:4px 10px;font-size:12px">编辑</button>'
        + '<button class="btn-primary" onclick="toggleLotteryPool(\'' + pool.id + '\')" style="padding:4px 10px;font-size:12px">' + (pool.enabled ? "禁用" : "启用") + '</button>'
        + '<button class="btn-danger" onclick="deleteLotteryPool(\'' + pool.id + '\')" style="padding:4px 10px;font-size:12px">删除</button>'
        + '</div></div>'
        + '<div style="font-size:13px;color:#666;margin-bottom:6px">' + escapeHtml(pool.description || "") + ' | 每次 ' + pool.cost + ' 积分</div>'
        + '<div style="font-size:13px;margin-bottom:6px">奖品: </div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">'
        + (pool.prizes || []).map(function(pr) {
            return '<span style="display:inline-block;background:#f0f0f0;border-radius:4px;padding:2px 8px;font-size:12px">' + escapeHtml(pr.name) + ' (' + pr.stock + '/' + pr.initialStock + ') '
              + '<a href="#" onclick="deletePrize(\'' + pool.id + '\',\'' + pr.id + '\');return false" style="color:#c00;text-decoration:none">x</a>'
              + '<a href="#" onclick="restockPrize(\'' + pool.id + '\',\'' + pr.id + '\');return false" style="color:#28a745;text-decoration:none;margin-left:4px">补</a>'
              + '</span>';
          }).join("")
        + '<button class="btn-primary" onclick="showAddPrizeForm(\'' + pool.id + '\')" style="padding:2px 8px;font-size:11px">+ 添加奖品</button>'
        + '</div></div>';
    }).join("");
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;color:#c00;padding:20px">加载失败</div>';
  }
}

export function showAddPoolForm() {
  document.getElementById("lottery-pool-modal-title").textContent = "新建奖池";
  document.getElementById("lp-name").value = "";
  document.getElementById("lp-desc").value = "";
  document.getElementById("lp-cost").value = "100";
  document.getElementById("lp-edit-id").value = "";
  document.getElementById("lottery-pool-modal").style.display = "block";
}

export function showEditPoolForm(id, name, desc, cost) {
  document.getElementById("lottery-pool-modal-title").textContent = "编辑奖池";
  document.getElementById("lp-name").value = name;
  document.getElementById("lp-desc").value = desc;
  document.getElementById("lp-cost").value = cost;
  document.getElementById("lp-edit-id").value = id;
  document.getElementById("lottery-pool-modal").style.display = "block";
}

export function closeLotteryPoolModal() {
  document.getElementById("lottery-pool-modal").style.display = "none";
}

export async function saveLotteryPool() {
  let id = document.getElementById("lp-edit-id").value;
  let name = document.getElementById("lp-name").value.trim();
  if (!name) { alert("请输入奖池名称"); return; }
  let desc = document.getElementById("lp-desc").value.trim();
  let cost = document.getElementById("lp-cost").value;
  let url = id
    ? "/api/admin/lottery/pool/update?key=" + encodeURIComponent(state.adminKey)
    : "/api/admin/lottery/pool/create?key=" + encodeURIComponent(state.adminKey);
  let body = id ? {id, name, description: desc, cost: parseInt(cost)} : {name, description: desc, cost: parseInt(cost)};
  try {
    let r = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    let data = await r.json();
    if (data.ok) {
      closeLotteryPoolModal();
      loadLotteryPools();
    } else {
      alert("保存失败: " + (data.error || "未知错误"));
    }
  } catch (e) {
    alert("保存失败: " + e.message);
  }
}

export async function toggleLotteryPool(id) {
  try {
    let r = await fetch("/api/admin/lottery/pool/toggle?key=" + encodeURIComponent(state.adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("操作失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

export async function deleteLotteryPool(id) {
  if (!confirm("确定删除此奖池？")) return;
  try {
    let r = await fetch("/api/admin/lottery/pool/delete?key=" + encodeURIComponent(state.adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("删除失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

export function showAddPrizeForm(poolId) {
  document.getElementById("lottery-prize-modal-title").textContent = "管理奖品";
  document.getElementById("lpr-name").value = "";
  document.getElementById("lpr-prob").value = "10";
  document.getElementById("lpr-stock").value = "10";
  document.getElementById("lpr-tag").value = "";
  document.getElementById("lpr-color").value = "";
  document.getElementById("lpr-pool-id").value = poolId;
  document.getElementById("lottery-prize-modal").style.display = "block";
}

export function closeLotteryPrizeModal() {
  document.getElementById("lottery-prize-modal").style.display = "none";
}

export async function addLotteryPrize() {
  let poolId = document.getElementById("lpr-pool-id").value;
  let name = document.getElementById("lpr-name").value.trim();
  if (!name) { alert("请输入奖品名称"); return; }
  let probability = parseFloat(document.getElementById("lpr-prob").value) || 0;
  let stock = parseInt(document.getElementById("lpr-stock").value) || 0;
  let tag = document.getElementById("lpr-tag").value.trim();
  let color = document.getElementById("lpr-color").value.trim();
  try {
    let r = await fetch("/api/admin/lottery/prize/create?key=" + encodeURIComponent(state.adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({poolId, name, probability, stock, tag, color})});
    let data = await r.json();
    if (data.ok) {
      document.getElementById("lpr-name").value = "";
      loadLotteryPools();
    } else {
      alert("添加失败: " + (data.error || "未知错误"));
    }
  } catch (e) {
    alert("添加失败: " + e.message);
  }
}

export async function deletePrize(poolId, prizeId) {
  if (!confirm("确定删除此奖品？")) return;
  try {
    let r = await fetch("/api/admin/lottery/prize/delete?key=" + encodeURIComponent(state.adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({poolId, prizeId})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("删除失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

export async function restockPrize(poolId, prizeId) {
  try {
    let r = await fetch("/api/admin/lottery/prize/restock?key=" + encodeURIComponent(state.adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({poolId, prizeId})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("补货失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("补货失败: " + e.message);
  }
}

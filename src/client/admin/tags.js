// 标签管理
import { state } from './state.js';
import { TAG_COLORS, escapeHtml } from './utils.js';
import { loadGlobalUsers } from './users.js';
import { loadHistoryUsers } from './history.js';

export async function setTag(btn, user) {
  let container = btn.parentNode;
  let input = container.querySelector('.tag-input');
  if (!input) return;
  let tag = input.value.trim();
  if (!tag) { alert("请输入标签"); return; }
  let colorSelect = container.querySelector('.tag-color-select');
  let color = colorSelect ? colorSelect.value : "";
  let borderSelect = container.querySelector('.tag-border-select');
  let border = borderSelect ? borderSelect.value : "";
  let r = await fetch("/api/admin/tag/set?key=" + encodeURIComponent(state.adminKey) + "&name=" + encodeURIComponent(user) + "&tag=" + encodeURIComponent(tag) + "&color=" + encodeURIComponent(color) + "&border=" + encodeURIComponent(border));
  try {
    let text = await r.text();
    alert(text);
    loadGlobalUsers();
    loadHistoryUsers();
  } catch (e) {
    alert("操作失败");
  }
}

export async function removeTag(user) {
  try {
    let r = await fetch("/api/admin/tag/remove?key=" + encodeURIComponent(state.adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    loadGlobalUsers();
    loadHistoryUsers();
  } catch (e) {
    alert("操作失败");
  }
}

export async function loadUserTags() {
  let tbody = document.querySelector("#ut-tbody");
  let stats = document.querySelector("#ut-stats");
  let empty = document.querySelector("#ut-empty");
  let search = document.querySelector("#ut-search").value.toLowerCase().trim();
  if (!tbody) return;
  try {
    let r = await fetch("/api/admin/user-tags?key=" + encodeURIComponent(state.adminKey));
    let data = await r.json();
    if (!data || data.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = "block";
      stats.textContent = "无数据";
      return;
    }
    if (empty) empty.style.display = "none";
    let filtered = data;
    if (search) filtered = data.filter(u => u.username.toLowerCase().includes(search));
    stats.textContent = "共 " + filtered.length + " 人拥有商品";
    tbody.innerHTML = filtered.map(u => {
      let equipped = u.items.find(i => i.equipped);
      let tagDisplay = equipped
        ? '<span class="shop-tag-badge" style="background:' + (TAG_COLORS[equipped.color] || '#888') + '">' + escapeHtml(equipped.tag) + '</span>'
        : '<span style="color:#999">-</span>';
      let itemsList = u.items.map(i => {
        let c = TAG_COLORS[i.color] || '#888';
        return '<span class="shop-tag-badge" style="background:' + c + ';margin:1px 2px;font-size:11px">' + escapeHtml(i.tag || i.itemName) + '</span>';
      }).join('');
      let equipInfo = equipped
        ? '<span style="color:' + (TAG_COLORS[equipped.color] || '#888') + '">' + escapeHtml(equipped.itemName) + '</span>'
        : '<span style="color:#999">-</span>';
      return '<tr><td>' + escapeHtml(u.username) + '</td><td>' + tagDisplay + '</td><td>' + (equipped ? escapeHtml(equipped.color) : '-') + '</td><td>' + equipInfo + '</td><td>' + (itemsList || '-') + '</td></tr>';
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#c00;padding:20px">加载失败</td></tr>';
  }
}

// 商店管理
import { state } from './state.js';
import { TAG_COLORS, escapeHtml } from './utils.js';

export async function loadShopSection() {
  try {
    let r = await fetch("/api/admin/shop/items?key=" + encodeURIComponent(state.adminKey));
    let items = await r.json();
    let tbody = document.getElementById("shop-tbody");
    let empty = document.getElementById("shop-empty");
    if (!items || items.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      document.getElementById("shop-stats").textContent = "0 件商品";
      return;
    }
    empty.style.display = "none";
    let html = "";
    let enabledCount = 0;
    for (let item of items) {
      if (item.enabled) enabledCount++;
      let colorPreview = item.color ? '<span class="s-color-preview" style="background:' + (TAG_COLORS[item.color] || item.color) + '"></span>' : '-';
      let statusHtml = item.enabled ? '<span class="shop-enabled">已上架</span>' : '<span class="shop-disabled">已下架</span>';
      let tagBadge = '<span class="shop-tag-badge" style="background:' + (TAG_COLORS[item.color] || "#95a5a6") + '">' + escapeHtml(item.tag) + '</span>';
      html += "<tr>" +
        '<td class="s-name">' + escapeHtml(item.name) + '</td>' +
        "<td>" + escapeHtml(item.description || "") + '</td>' +
        "<td>" + tagBadge + '</td>' +
        "<td>" + colorPreview + '</td>' +
        "<td>" + item.price + '</td>' +
        "<td>" + statusHtml + '</td>' +
        '<td class="s-actions">' +
        '<button class="' + (item.enabled ? 'btn-toggle-off' : 'btn-toggle-on') + '" onclick="toggleShopItem(\'' + item.id + '\')">' + (item.enabled ? '下架' : '上架') + '</button>' +
        '<button class="btn-del" onclick="deleteShopItem(\'' + item.id + '\')">删除</button>' +
        "</td></tr>";
    }
    tbody.innerHTML = html;
    document.getElementById("shop-stats").textContent = enabledCount + "/" + items.length + " 件上架";
  } catch (e) {
    document.getElementById("shop-tbody").innerHTML = '<tr><td colspan="7" style="color:#c00;text-align:center">加载失败</td></tr>';
  }
}

export async function addShopItem() {
  let name = document.getElementById("shop-tb-name").value.trim();
  let desc = document.getElementById("shop-tb-desc").value.trim();
  let price = document.getElementById("shop-tb-price").value;
  let tag = document.getElementById("shop-tb-tag").value.trim();
  let color = document.getElementById("shop-tb-color").value;
  let border = document.getElementById("shop-tb-border").value;
  if (!name || !price || !tag) { alert("请至少填写商品名称、价格和标签"); return; }
  try {
    let r = await fetch("/api/admin/shop/item/add?key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name, description: desc, price: parseInt(price), tag, color, border})
    });
    let data = await r.json();
    if (data.error) { alert(data.error); return; }
    document.getElementById("shop-tb-name").value = "";
    document.getElementById("shop-tb-desc").value = "";
    document.getElementById("shop-tb-price").value = "";
    document.getElementById("shop-tb-tag").value = "";
    loadShopSection();
  } catch (e) {
    alert("添加失败: " + e.message);
  }
}

export async function toggleShopItem(itemId) {
  try {
    let r = await fetch("/api/admin/shop/item/toggle?key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({itemId})
    });
    let data = await r.json();
    if (data.error) { alert(data.error); return; }
    loadShopSection();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

export async function deleteShopItem(itemId) {
  if (!confirm("确定删除此商品？")) return;
  try {
    let r = await fetch("/api/admin/shop/item/delete?key=" + encodeURIComponent(state.adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({itemId})
    });
    let data = await r.json();
    if (data.error) { alert(data.error); return; }
    loadShopSection();
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

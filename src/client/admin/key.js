// 管理员密钥管理
import { state } from './state.js';

export async function loadAdminKeyInfo() {
  let display = document.querySelector("#admin-key-display");
  try {
    let r = await fetch("/api/admin/admin-key/get?key=" + encodeURIComponent(state.adminKey));
    let data = await r.json();
    if (data.key) {
      let masked = data.key.length > 4 ? data.key.slice(0, 4) + "****" : "****";
      display.textContent = "当前密钥: " + masked;
    }
  } catch (e) {
    display.textContent = "加载失败";
  }
}

export async function changeAdminKey() {
  let input = document.querySelector("#new-admin-key-input");
  let newKey = input.value.trim();
  if (!newKey) { alert("请输入新密钥"); return; }
  if (newKey.length < 3) { alert("密钥长度至少3位"); return; }
  try {
    let r = await fetch("/api/admin/admin-key/set?key=" + encodeURIComponent(state.adminKey) + "&newkey=" + encodeURIComponent(newKey));
    let text = await r.text();
    alert(text);
    input.value = "";
    loadAdminKeyInfo();
  } catch (e) {
    alert("操作失败");
  }
}

export async function resetAdminKey() {
  if (!confirm("确定将管理员密钥重置为默认值吗？")) return;
  try {
    let r = await fetch("/api/admin/admin-key/reset?key=" + encodeURIComponent(state.adminKey));
    let text = await r.text();
    alert(text);
    loadAdminKeyInfo();
  } catch (e) {
    alert("操作失败");
  }
}

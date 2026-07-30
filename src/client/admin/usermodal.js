// 用户详情弹窗 + 快速搜索
import { state } from './state.js';
import { TAG_COLORS, escapeHtml } from './utils.js';

export function quickSearch() {
  let q = document.querySelector("#quick-search").value.trim();
  if (!q) return;
  showUserDetail(q);
}

export async function showUserDetail(username) {
  let overlay = document.querySelector("#user-modal-overlay");
  overlay.classList.add("open");
  document.querySelector("#um-username").textContent = username;
  document.querySelector("#um-body").innerHTML = '<div style="text-align:center;color:#888;padding:20px">加载中...</div>';

  try {
    let [pointsRes, tagsRes, ipsRes, onlineRes, bannedRes] = await Promise.all([
      fetch("/api/admin/points/get?key=" + encodeURIComponent(state.adminKey) + "&name=" + encodeURIComponent(username)),
      fetch("/api/admin/tag/list?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/ban/list?key=" + encodeURIComponent(state.adminKey))
    ]);
    let pointsData = await pointsRes.json();
    let tagsData = await tagsRes.json();
    let ipsData = await ipsRes.json();
    let onlineData = await onlineRes.json();
    let bannedList = await bannedRes.json();

    let pts = pointsData.points !== undefined ? pointsData.points : 0;
    let tagInfo = tagsData[username] || null;
    let userIp = ipsData[username] || "未知";
    let isBanned = Array.isArray(bannedList) && bannedList.includes(username);

    let userRooms = [];
    for (let [room, users] of Object.entries(onlineData)) {
      if (users.includes(username)) userRooms.push(room);
    }
    let isOnline = userRooms.length > 0;

    let tagHtml = tagInfo ? '<span class="tag-badge" style="background:' + (TAG_COLORS[tagInfo.color] || "#888") + '">' + escapeHtml(tagInfo.tag || "") + "</span>" : "无";
    let statusHtml = isOnline ? '<span class="online">● 在线</span>' : '<span class="offline">○ 离线</span>';
    let roomHtml = userRooms.length > 0 ? userRooms.map(r => "#" + r).join(", ") : "无";
    let banHtml = isBanned ? '<span style="color:#c00;font-weight:bold">已封禁</span>' : '<span style="color:#27ae60">正常</span>';

    let escUser = username.replace(/'/g, "\\'");
    let actionsHtml = '';
    actionsHtml += '<button class="btn-p" onclick="closeUserModal();navigateTo(\'/admin/points/\');setTimeout(function(){document.querySelector(\'#pts-tb-user\').value=\'' + escUser + '\';searchPointsUser()},200)">管理积分</button>';
    if (isOnline) {
      actionsHtml += '<button class="btn-danger" onclick="closeUserModal();globalKick(\'' + escUser + '\')">全局踢出</button>';
    }
    if (!isBanned) {
      actionsHtml += '<button class="btn-danger" onclick="closeUserModal();banUser(\'' + escUser + '\')">封禁</button>';
    } else {
      actionsHtml += '<button class="btn-success" onclick="closeUserModal();unbanUser(\'' + escUser + '\')">解封</button>';
    }
    if (userIp && userIp !== "未知") {
      actionsHtml += '<button class="btn-danger" onclick="closeUserModal();banIp(\'' + userIp.replace(/'/g, "\\'") + '\')">封禁IP</button>';
      actionsHtml += '<button class="btn-p" onclick="closeUserModal();navigateTo(\'/admin/ip-group/\');setTimeout(function(){document.querySelector(\'#ipg-search\').value=\'' + userIp.replace(/'/g, "\\'") + '\';loadIpGroup()},200)">同IP用户</button>';
    }
    actionsHtml += '<button class="btn-danger" onclick="closeUserModal();deleteUser(\'' + escUser + '\')" style="background:#8e44ad;color:#fff">🗑️ 删除用户</button>';

    document.querySelector("#um-body").innerHTML =
      '<div class="modal-field"><span class="mf-label">用户名</span><span class="mf-value">' + escapeHtml(username) + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">状态</span><span class="mf-value ' + (isOnline ? 'online' : 'offline') + '">' + statusHtml + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">积分</span><span class="mf-value" style="color:#e67e22;font-weight:bold">' + pts + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">标签</span><span class="mf-value">' + tagHtml + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">IP地址</span><span class="mf-value" style="color:#999;font-family:monospace;font-size:95%">' + escapeHtml(userIp) + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">所在房间</span><span class="mf-value">' + roomHtml + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">封禁状态</span><span class="mf-value">' + banHtml + '</span></div>' +
      '<div class="modal-actions">' + actionsHtml + '</div>';

    overlay.onclick = function(e) { if (e.target === this) closeUserModal(); };
  } catch (e) {
    document.querySelector("#um-body").innerHTML = '<div style="color:#c00;text-align:center;padding:20px">加载失败</div>';
  }
}

export function closeUserModal() {
  document.querySelector("#user-modal-overlay").classList.remove("open");
}

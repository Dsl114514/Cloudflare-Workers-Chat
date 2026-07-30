// 历史用户
import { state } from './state.js';
import { TAG_COLORS, escapeHtml, addBorderSelects } from './utils.js';

export async function loadHistoryUsers() {
  let container = document.querySelector("#history-users-list");
  try {
    let [historyRes, onlineRes] = await Promise.all([
      fetch("/api/admin/users/history?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(state.adminKey))
    ]);
    let allUsers = await historyRes.json();
    let onlineData = await onlineRes.json();
    let onlineSet = new Set();
    for (let users of Object.values(onlineData)) users.forEach(u => onlineSet.add(u));
    let tagMap = {};
    try { let tr = await fetch("/api/admin/tag/list?key=" + encodeURIComponent(state.adminKey)); tagMap = await tr.json(); } catch (e) {}
    let bannedList = [];
    try { let br = await fetch("/api/admin/ban/list?key=" + encodeURIComponent(state.adminKey)); bannedList = await br.json(); } catch (e) {}
    let userIpMap = {};
    try { let ipr = await fetch("/api/admin/user-ips?key=" + encodeURIComponent(state.adminKey)); userIpMap = await ipr.json(); } catch (e) {}
    if (!Array.isArray(allUsers) || allUsers.length === 0) { container.innerHTML = '<div style="color:#888;padding:8px 0">暂无历史用户</div>'; return; }
    let html = '';
    allUsers.forEach(user => {
      let isOnline = onlineSet.has(user);
      let statusHtml = isOnline ? '<span class="online">● 在线</span>' : '<span class="offline">○ 离线</span>';
      let userTag = tagMap[user] || '';
      let tagText = userTag.tag || '', tagColor = userTag.color || '';
      let tagStyle = tagColor && TAG_COLORS[tagColor] ? 'style="background:' + TAG_COLORS[tagColor] + '"' : '';
      let userIp = userIpMap[user] || '';
      let ipHtml = userIp ? ' <span style="color:#999;font-size:85%">(' + escapeHtml(userIp) + ')</span>' : '';
      let escUser = user.replace(/'/g, "\\'");
      let tagHtml = tagText
        ? '<span class="tag-badge" ' + tagStyle + '>' + escapeHtml(tagText) + '</span><button class="tag-remove-btn" onclick="removeTag(\'' + escUser + '\')">✕</button>'
        : '<input class="tag-input" placeholder="标签" maxlength="10"><select class="tag-color-select">'
            + Object.keys(TAG_COLORS).map(c => '<option value="' + c + '">' + c + '</option>').join('')
            + '</select><button class="tag-set-btn" onclick="setTag(this,\'' + escUser + '\')">设置</button>';
      let isBanned = bannedList.includes(user);
      html += '<div class="history-user-item"><span><span class="name">' + escapeHtml(user) + ipHtml + '</span>' + tagHtml + ' ' + statusHtml + '</span>' +
        '<span class="actions">';
      if (!isOnline) html += '<button class="btn-danger" onclick="globalKick(\'' + escUser + '\')">踢出</button>';
      if (!isBanned) html += '<button class="btn-danger" onclick="banUser(\'' + escUser + '\')">封禁</button>';
      else html += '<button onclick="unbanUser(\'' + escUser + '\')">解封</button>';
      html += '<button class="btn-danger" onclick="blacklistUser(\'' + escUser + '\')">拉黑</button>';
      html += '</span></div>';
    });
    container.innerHTML = html;
    addBorderSelects();
  } catch (e) { container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败</div>'; }
}

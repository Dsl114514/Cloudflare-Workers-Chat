// 系统概览仪表盘
import { state } from './state.js';
import { TAG_COLORS, escapeHtml } from './utils.js';

export async function loadDashboard() {
  try {
    let [roomsRes, onlineRes, pointsRes, bannedRes, historyRes, ipBannedRes, ipsRes] = await Promise.all([
      fetch("/api/rooms/list"),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/points/all?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/ban/list?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/users/history?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/ip-ban/list?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(state.adminKey))
    ]);
    let rooms = await roomsRes.json();
    let onlineData = await onlineRes.json();
    let pointsData = await pointsRes.json();
    let bannedList = await bannedRes.json();
    let historyList = await historyRes.json();
    let ipBannedList = await ipBannedRes.json();
    let ipsData = await ipsRes.json();

    let onlineSet = new Set();
    for (let users of Object.values(onlineData)) {
      users.forEach(u => onlineSet.add(u));
    }
    let roomCount = Object.keys(rooms).length;
    let onlineCount = onlineSet.size;
    let historyCount = Array.isArray(historyList) ? historyList.length : 0;
    let bannedCount = Array.isArray(bannedList) ? bannedList.length : 0;

    let totalPoints = 0;
    let pointsEntries = Object.entries(pointsData);
    pointsEntries.forEach(([, p]) => totalPoints += p);

    document.querySelector("#dash-rooms").textContent = roomCount;
    document.querySelector("#dash-online").textContent = onlineCount;
    document.querySelector("#dash-users").textContent = historyCount;
    document.querySelector("#dash-banned").textContent = bannedCount + (ipBannedList.length > 0 ? " (+" + ipBannedList.length + " IP)" : "");
    document.querySelector("#dash-ipbanned").textContent = ipBannedList.length;
    document.querySelector("#dash-points").textContent = totalPoints;

    let ipToUsers = {};
    for (let [user, ip] of Object.entries(ipsData)) {
      if (!ip) continue;
      if (!ipToUsers[ip]) ipToUsers[ip] = [];
      ipToUsers[ip].push(user);
    }
    let multiUserIps = Object.values(ipToUsers).filter(u => u.length > 1).length;
    document.querySelector("#dash-ipgroups").textContent = multiUserIps;

    let topContainer = document.querySelector("#dash-top-points");
    if (pointsEntries.length === 0) {
      topContainer.innerHTML = '<div style="color:#888;font-size:90%">暂无积分数据</div>';
      return;
    }
    pointsEntries.sort((a, b) => b[1] - a[1]);
    let top10 = pointsEntries.slice(0, 10);
    let html = '<table class="dash-top-table"><thead><tr><th></th><th>用户名</th><th>积分</th></tr></thead><tbody>';
    top10.forEach(([user, pts], i) => {
      let rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      html += '<tr><td class="rank ' + rankClass + '">#' + (i + 1) + '</td>' +
        '<td class="p-name"><a href="javascript:void(0)" onclick="showUserDetail(\'' + user.replace(/'/g, "\\'") + '\')">' + escapeHtml(user) + '</a></td>' +
        '<td class="p-pts">' + pts + '</td></tr>';
    });
    html += '</tbody></table>';
    topContainer.innerHTML = html;
  } catch (e) {
    document.querySelector("#dash-rooms").textContent = "err";
    document.querySelector("#dash-online").textContent = "err";
  }
}

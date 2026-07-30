// 同IP检测
import { state } from './state.js';
import { TAG_COLORS, escapeHtml } from './utils.js';

export async function loadIpGroup() {
  let container = document.querySelector("#ipg-list");
  let q = document.querySelector("#ipg-search").value.trim().toLowerCase();
  try {
    let [ipsRes, pointsRes, onlineRes, tagsRes, bannedRes] = await Promise.all([
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/points/all?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/tag/list?key=" + encodeURIComponent(state.adminKey)),
      fetch("/api/admin/ban/list?key=" + encodeURIComponent(state.adminKey))
    ]);
    let ipsData = await ipsRes.json();
    let pointsData = await pointsRes.json();
    let onlineData = await onlineRes.json();
    let tagsData = await tagsRes.json();
    let bannedList = await bannedRes.json();

    let onlineSet = new Set();
    for (let users of Object.values(onlineData)) {
      users.forEach(u => onlineSet.add(u));
    }

    let ipToUsers = {};
    for (let [user, ip] of Object.entries(ipsData)) {
      if (!ip) continue;
      if (!ipToUsers[ip]) ipToUsers[ip] = [];
      ipToUsers[ip].push(user);
    }

    let entries = Object.entries(ipToUsers).sort((a, b) => b[1].length - a[1].length);

    if (entries.length === 0) {
      container.innerHTML = '<div class="ipg-empty">暂无IP数据</div>';
      document.querySelector("#ipg-count").textContent = "";
      return;
    }

    let multiCount = entries.filter(([, users]) => users.length > 1).length;
    document.querySelector("#ipg-count").textContent = "共 " + entries.length + " 个IP，其中 " + multiCount + " 个IP有多个用户";

    let html = '';
    entries.forEach(([ip, users]) => {
      if (q && !ip.includes(q) && !users.some(u => u.toLowerCase().includes(q))) {
        return;
      }

      let totalPts = 0;
      let onlineCount = 0;
      users.forEach(u => {
        totalPts += pointsData[u] || 0;
        if (onlineSet.has(u)) onlineCount++;
      });

      let isOpen = state.ipgExpanded === ip;
      html += '<div class="ipg-ip-group">' +
        '<div class="ipg-ip-header" onclick="toggleIpGroup(\'' + ip.replace(/'/g, "\\'") + '\')">' +
          '<span class="ipg-ip">' + escapeHtml(ip) + '</span>' +
          '<span><span class="ipg-ip-count">' + users.length + ' 人  ·  ' + onlineCount + ' 在线  ·  ' + totalPts + ' 积分</span><span class="ipg-arrow' + (isOpen ? ' open' : '') + '">&#9654;</span></span>' +
        '</div>' +
        '<div class="ipg-users"' + (isOpen ? '' : ' style="display:none"') + '>';

      users.forEach(u => {
        let isOnline = onlineSet.has(u);
        let pts = pointsData[u] || 0;
        let tagInfo = tagsData[u] || null;
        let tagHtml = tagInfo ? '<span class="tag-badge" style="background:' + (TAG_COLORS[tagInfo.color] || "#888") + ';font-size:75%">' + escapeHtml(tagInfo.tag || "") + '</span>' : '';
        let isBanned = Array.isArray(bannedList) && bannedList.includes(u);
        let statusDot = isOnline ? '<span style="color:#27ae60">●</span>' : '<span style="color:#bbb">○</span>';
        let escUser = u.replace(/'/g, "\\'");

        html += '<div class="ipg-user">' +
          '<span><span class="ipg-uname">' + statusDot + ' ' + escapeHtml(u) + '</span> ' + tagHtml + '</span>' +
          '<span class="ipg-pts">' + pts + '</span>' +
          '<span class="ipg-actions">' +
            '<button onclick="showUserDetail(\'' + escUser + '\')">详情</button>' +
            (isOnline ? '<button class="btn-sm-danger" onclick="globalKick(\'' + escUser + '\')">踢出</button>' : '') +
            (isBanned ? '<button onclick="unbanUser(\'' + escUser + '\')">解封</button>' : '<button class="btn-sm-danger" onclick="banUser(\'' + escUser + '\')">封禁</button>') +
          '</span>' +
        '</div>';
      });

      html += '</div></div>';
    });

    container.innerHTML = html || '<div class="ipg-empty">未找到匹配的IP或用户</div>';
  } catch (e) {
    container.innerHTML = '<div class="ipg-empty" style="color:#c00">加载失败</div>';
  }
}

export function toggleIpGroup(ip) {
  let headers = document.querySelectorAll(".ipg-ip-header");
  headers.forEach(h => {
    let ipSpan = h.querySelector(".ipg-ip");
    if (ipSpan && ipSpan.textContent === ip) {
      let usersDiv = h.nextElementSibling;
      let arrow = h.querySelector(".ipg-arrow");
      if (usersDiv) {
        let isNowOpen = usersDiv.style.display !== 'none';
        usersDiv.style.display = isNowOpen ? 'none' : 'block';
        if (arrow) arrow.classList.toggle('open', !isNowOpen);
        state.ipgExpanded = isNowOpen ? null : ip;
      }
    }
  });
}


let adminKey = localStorage.getItem("admin_key") || "";
let refreshInterval = null;

if (adminKey) {
  document.querySelector("#login-form").style.display = "none";
  document.querySelector("#admin-panel").style.display = "block";
  loadRooms();
  loadGlobalUsers();
  loadBannedList();
  loadHistoryUsers();
  startAutoRefresh();
}

document.querySelector("#login-btn").addEventListener("click", () => {
  adminKey = document.querySelector("#admin-key").value;
  if (!adminKey) return;
  // 验证密钥（通过调用一个需要密钥的 API 来测试）
  fetch("/api/admin/clear-rate-limits?key=" + encodeURIComponent(adminKey) + "&ip=0.0.0.0")
    .then(r => {
      if (r.status === 401) throw new Error("密钥错误");
      localStorage.setItem("admin_key", adminKey);
      document.querySelector("#login-form").style.display = "none";
      document.querySelector("#admin-panel").style.display = "block";
      loadRooms();
      loadGlobalUsers();
      loadBannedList();
      loadHistoryUsers();
      startAutoRefresh();
    })
    .catch(e => {
      document.querySelector("#login-error").style.display = "block";
    });
});

document.querySelector("#admin-key").addEventListener("keydown", e => {
  if (e.key === "Enter") document.querySelector("#login-btn").click();
});

document.querySelector("#logout-btn").addEventListener("click", () => {
  stopAutoRefresh();
  localStorage.removeItem("admin_key");
  adminKey = "";
  document.querySelector("#admin-panel").style.display = "none";
  document.querySelector("#login-form").style.display = "block";
  document.querySelector("#admin-key").value = "";
  document.querySelector("#admin-key").focus();
});

async function loadRooms() {
  let container = document.querySelector("#room-list-container");
  container.innerHTML = '<div id="loading">加载中...</div>';
  try {
    let r = await fetch("/api/rooms/list");
    let rooms = await r.json();
    container.innerHTML = "";
    let entries = Object.entries(rooms);
    if (entries.length === 0) {
      container.innerHTML = '<div id="loading">暂无房间</div>';
      return;
    }
    entries.forEach(([name, count]) => {
      let card = document.createElement("div");
      card.className = "room-card";
      card.dataset.room = name;
      card.innerHTML =
        '<div class="room-header">' +
          '<span class="room-name">#' + name + '</span>' +
          '<span><span class="room-meta">&#128101; ' + count + ' 在线</span><span class="arrow">&#9654;</span></span>' +
        '</div>' +
        '<div class="room-detail"></div>';
      card.querySelector(".room-header").addEventListener("click", () => toggleRoom(card, name));
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = '<div id="loading">加载失败: ' + e.message + '</div>';
  }
}

async function loadGlobalUsers() {
  let container = document.querySelector("#global-users-list");
  try {
    let r = await fetch("/api/admin/all-users?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    // data 格式: { roomName: [user1, user2, ...], ... }

    // 构建用户 -> 房间列表的映射
    let userRooms = {};
    for (let [room, users] of Object.entries(data)) {
      users.forEach(u => {
        if (!userRooms[u]) userRooms[u] = [];
        userRooms[u].push(room);
      });
    }

    // 获取标签列表
    let tagMap = {};
    try {
      let tr = await fetch("/api/admin/tag/list?key=" + encodeURIComponent(adminKey));
      tagMap = await tr.json();
    } catch (e) { /* 忽略 */ }

    let entries = Object.entries(userRooms);
    if (entries.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:8px 0">暂无在线用户</div>';
      return;
    }

    let html = '';
    entries.forEach(([user, rooms]) => {
      let userTag = tagMap[user] || '';
      let tagHtml = userTag
        ? '<span class="tag-badge">' + escapeHtml(userTag) + '</span>'
            + '<button class="tag-remove-btn" onclick="removeTag(\'' + user.replace(/'/g, "\\'") + '\')">✕</button>'
        : '<input class="tag-input" id="tag-input-' + user.replace(/[^a-zA-Z0-9_-]/g, '_') + '" placeholder="标签" maxlength="10">'
            + '<button class="tag-set-btn" onclick="setTag(\'' + user.replace(/'/g, "\\'") + '\')">设置</button>';
      html += '<div class="global-user-item">' +
        '<span class="name">' + escapeHtml(user) + tagHtml + '</span>' +
        '<span class="rooms">房间: ' + rooms.map(r => '#' + r).join(', ') + '</span>' +
        '<span>' +
        '<button class="kick-btn" onclick="globalKick(\'' + user.replace(/'/g, "\\'") + '\')">全局踢出</button>' +
        '<button class="ban-btn" onclick="banUser(\'' + user.replace(/'/g, "\\'") + '\')">封禁</button>' +
        '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败: ' + e.message + '</div>';
  }
}

async function globalKick(user) {
  if (!confirm("确定将 " + user + " 从所有房间踢出吗？")) return;
  try {
    let r = await fetch("/api/admin/global-kick?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let data = await r.json();
    alert("已从 " + data.kickedFrom.length + " 个房间踢出 " + user);
    loadGlobalUsers();
    loadRooms();
  } catch (e) {
    alert("操作失败");
  }
}

async function banUser(user) {
  if (!confirm("确定封禁 " + user + " 吗？封禁后该用户无法加入任何聊天室。")) return;
  try {
    // 先全局踢出，再封禁
    await fetch("/api/admin/global-kick?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let r = await fetch("/api/admin/ban/add?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    loadBannedList();
    loadGlobalUsers();
    loadRooms();
  } catch (e) {
    alert("操作失败");
  }
}

async function unbanUser(user) {
  if (!confirm("确定解封 " + user + " 吗？")) return;
  try {
    let r = await fetch("/api/admin/ban/remove?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    loadBannedList();
  } catch (e) {
    alert("操作失败");
  }
}

async function loadBannedList() {
  let container = document.querySelector("#banned-users-list");
  try {
    let r = await fetch("/api/admin/ban/list?key=" + encodeURIComponent(adminKey));
    let banned = await r.json();
    if (!Array.isArray(banned) || banned.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:8px 0">暂无被封禁用户</div>';
      return;
    }
    let html = '';
    banned.forEach(user => {
      html += '<div class="banned-user-item">' +
        '<span class="name">' + escapeHtml(user) + '</span>' +
        '<button class="unban-btn" onclick="unbanUser(\'' + user.replace(/'/g, "\\'") + '\')">解封</button>' +
        '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败: ' + e.message + '</div>';
  }
}

async function loadHistoryUsers() {
  let container = document.querySelector("#history-users-list");
  try {
    let [historyRes, onlineRes] = await Promise.all([
      fetch("/api/admin/users/history?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(adminKey))
    ]);
    let allUsers = await historyRes.json();
    let onlineData = await onlineRes.json();

    // 构建在线用户集合
    let onlineSet = new Set();
    for (let users of Object.values(onlineData)) {
      users.forEach(u => onlineSet.add(u));
    }

    // 获取标签
    let tagMap = {};
    try {
      let tr = await fetch("/api/admin/tag/list?key=" + encodeURIComponent(adminKey));
      tagMap = await tr.json();
    } catch (e) { /* 忽略 */ }

    // 获取封禁列表
    let bannedList = [];
    try {
      let br = await fetch("/api/admin/ban/list?key=" + encodeURIComponent(adminKey));
      bannedList = await br.json();
    } catch (e) { /* 忽略 */ }

    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:8px 0">暂无历史用户</div>';
      return;
    }

    let html = '';
    allUsers.forEach(user => {
      let isOnline = onlineSet.has(user);
      let statusHtml = isOnline
        ? '<span class="online">● 在线</span>'
        : '<span class="offline">○ 离线</span>';
      let userTag = tagMap[user] || '';
      let tagHtml = userTag
        ? '<span class="tag-badge">' + escapeHtml(userTag) + '</span>'
            + '<button class="tag-remove-btn" onclick="removeTag(\'' + user.replace(/'/g, "\\'") + '\')">✕</button>'
        : '<input class="tag-input" id="tag-input-' + user.replace(/[^a-zA-Z0-9_-]/g, '_') + '" placeholder="标签" maxlength="10">'
            + '<button class="tag-set-btn" onclick="setTag(\'' + user.replace(/'/g, "\\'") + '\')">设置</button>';
      let isBanned = bannedList.includes(user);

      html += '<div class="history-user-item">' +
        '<span><span class="name">' + escapeHtml(user) + '</span>' + tagHtml + ' ' + statusHtml + '</span>' +
        '<span class="actions">';
      if (!isOnline) {
        html += '<button class="btn-danger" onclick="globalKick(\'' + user.replace(/'/g, "\\'") + '\')">踢出</button>';
      }
      if (!isBanned) {
        html += '<button class="btn-danger" onclick="banUser(\'' + user.replace(/'/g, "\\'") + '\')">封禁</button>';
      } else {
        html += '<button onclick="unbanUser(\'' + user.replace(/'/g, "\\'") + '\')">解封</button>';
      }
      html += '</span></div>';
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败: ' + e.message + '</div>';
  }
}

let expandedRoom = null;

async function setTag(user) {
  let input = document.querySelector('#tag-input-' + user.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!input) return;
  let tag = input.value.trim();
  if (!tag) { alert("请输入标签"); return; }
  try {
    let r = await fetch("/api/admin/tag/set?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user) + "&tag=" + encodeURIComponent(tag));
    let text = await r.text();
    alert(text);
    loadGlobalUsers();
  } catch (e) {
    alert("操作失败");
  }
}

async function removeTag(user) {
  try {
    let r = await fetch("/api/admin/tag/remove?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    loadGlobalUsers();
  } catch (e) {
    alert("操作失败");
  }
}

async function toggleRoom(card, name) {
  let detail = card.querySelector(".room-detail");
  let arrow = card.querySelector(".arrow");

  if (detail.classList.contains("open")) {
    detail.classList.remove("open");
    arrow.classList.remove("open");
    if (expandedRoom === name) expandedRoom = null;
    return;
  }

  // 收起其他
  document.querySelectorAll(".room-detail.open").forEach(d => d.classList.remove("open"));
  document.querySelectorAll(".arrow.open").forEach(a => a.classList.remove("open"));

  detail.classList.add("open");
  arrow.classList.add("open");
  expandedRoom = name;

  detail.innerHTML = '<div id="loading">加载中...</div>';
  await loadRoomDetail(detail, name);
}

async function loadRoomDetail(detail, name) {
  try {
    let [users, blacklist] = await Promise.all([
      fetch("/api/admin/room-users/" + encodeURIComponent(name) + "?key=" + encodeURIComponent(adminKey)).then(r => r.json()),
      fetch("/api/admin/blacklist/list/" + encodeURIComponent(name) + "?key=" + encodeURIComponent(adminKey)).then(r => r.json())
    ]);

    let html = '<div class="room-actions">';
    html += '<button class="btn-danger" onclick="clearRoom(\'' + name.replace(/'/g, "\\'") + '\')">清空聊天记录</button>';
    html += '</div>';

    // 用户列表
    html += '<div class="user-list">';
    if (users.length === 0) {
      html += '<div style="color:#888;font-size:90%">暂无在线用户</div>';
    } else {
      users.forEach(u => {
        html += '<div class="user-item">' +
          '<span class="name">' + escapeHtml(u) + '</span>' +
          '<span>' +
            '<button class="kick-btn" onclick="kickUser(\'' + name.replace(/'/g, "\\'") + '\', \'' + u.replace(/'/g, "\\'") + '\')">踢出</button>';
        if (blacklist.includes(u)) {
          html += '<button onclick="removeBlacklist(\'' + name.replace(/'/g, "\\'") + '\', \'' + u.replace(/'/g, "\\'") + '\')">移出黑名单</button>';
        } else {
          html += '<button onclick="addBlacklist(\'' + name.replace(/'/g, "\\'") + '\', \'' + u.replace(/'/g, "\\'") + '\')">拉黑</button>';
        }
        html += '<button class="ban-btn" onclick="banUser(\'' + u.replace(/'/g, "\\'") + '\')">封禁</button>';
        html += '</span></div>';
      });
    }
    html += '</div>';

    // 黑名单列表
    if (blacklist.length > 0) {
      html += '<div class="blacklist-section"><h4>黑名单</h4>';
      blacklist.forEach(b => {
        html += '<span class="blacklist-item"><button onclick="removeBlacklist(\'' + name.replace(/'/g, "\\'") + '\', \'' + b.replace(/'/g, "\\'") + '\')">' + escapeHtml(b) + ' ✕</button></span>';
      });
      html += '</div>';
    }

    detail.innerHTML = html;
  } catch (e) {
    detail.innerHTML = '<div style="color:#c00">加载失败</div>';
  }
}

function escapeHtml(s) {
  let div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function kickUser(room, user) {
  if (!confirm("确定踢出 " + user + " 吗？")) return;
  try {
    let r = await fetch("/api/admin/kick-user/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    // 刷新详情
    let card = document.querySelector('.room-card[data-room="' + room.replace(/"/g, '') + '"]');
    if (card) {
      let detail = card.querySelector(".room-detail");
      await loadRoomDetail(detail, room);
    }
  } catch (e) {
    alert("操作失败");
  }
}

async function addBlacklist(room, user) {
  try {
    let r = await fetch("/api/admin/blacklist/add/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    let card = document.querySelector('.room-card[data-room="' + room.replace(/"/g, '') + '"]');
    if (card) {
      let detail = card.querySelector(".room-detail");
      await loadRoomDetail(detail, room);
    }
  } catch (e) {
    alert("操作失败");
  }
}

async function removeBlacklist(room, user) {
  try {
    let r = await fetch("/api/admin/blacklist/remove/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    let card = document.querySelector('.room-card[data-room="' + room.replace(/"/g, '') + '"]');
    if (card) {
      let detail = card.querySelector(".room-detail");
      await loadRoomDetail(detail, room);
    }
  } catch (e) {
    alert("操作失败");
  }
}

async function clearRoom(room) {
  if (!confirm("确定清空 " + room + " 的聊天记录吗？此操作不可撤销！")) return;
  try {
    let r = await fetch("/api/admin/clear-room/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey));
    let text = await r.text();
    alert(text);
  } catch (e) {
    alert("操作失败");
  }
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    let expanded = expandedRoom;
    await loadRooms();
    // 恢复之前展开的房间
    if (expanded) {
      let card = document.querySelector('.room-card[data-room="' + expanded.replace(/"/g, '') + '"]');
      if (card) {
        let detail = card.querySelector(".room-detail");
        let arrow = card.querySelector(".arrow");
        detail.classList.add("open");
        arrow.classList.add("open");
        await loadRoomDetail(detail, expanded);
      }
    }
    loadGlobalUsers();
    loadBannedList();
    loadHistoryUsers();
  }, 10000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

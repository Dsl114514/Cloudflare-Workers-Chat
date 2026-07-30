const TAG_COLORS = {
  red: "#e74c3c", blue: "#3498db", green: "#2ecc71",
  purple: "#9b59b6", pink: "#e91e63", cyan: "#00bcd4",
  gray: "#95a5a6", orange: "#e67e22",
  yellow: "#ffc107", teal: "#009688", indigo: "#3f51b5",
  brown: "#795548", lime: "#cddc39", deeporange: "#ff5722",
  rose: "#ff80ab", crimson: "#dc143c", coral: "#ff7043",
  gold: "#ffd700", amber: "#ffbf00", forest: "#228b22",
  seagreen: "#2e8b57", turquoise: "#40e0d0", steel: "#4682b4",
  royalblue: "#4169e1", mediumpurple: "#9370db", darkviolet: "#9400d3",
  chocolate: "#d2691e", olive: "#808000", firebrick: "#b22222",
  slateblue: "#6a5acd", darkcyan: "#008b8b", mediumseagreen: "#3cb371",
  indianred: "#cd5c5c", cadetblue: "#5f9ea0"
};

let adminKey = localStorage.getItem("admin_key") || "";
let adminLevel = null; // "super" 或 "admin"
let refreshInterval = null;

function isSuper() { return adminLevel === "super"; }
function isAdmin() { return adminLevel === "admin"; }

function showSuperSections(show) {
  // 控制超级管理员专属导航项的显示
  document.querySelectorAll(".nav-super").forEach(el => {
    el.style.display = show ? "block" : "none";
  });
  // 如果当前路由对应的导航项被隐藏了，跳转到默认页
  if (!show) {
    let activeNav = document.querySelector(".nav-item.active");
    if (activeNav && activeNav.classList.contains("nav-super")) {
      navigateTo("/admin/rooms/");
    }
  }
}

async function checkAuthAndLoad() {
  try {
    let r = await fetch("/api/admin/auth-check?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    if (!data.level) { localStorage.removeItem("admin_key"); return false; }
    adminLevel = data.level;
    document.querySelector("#login-form").style.display = "none";
    document.querySelector("#admin-panel").style.display = "block";
    showSuperSections(isSuper());
    loadRooms();
    loadGlobalBlacklist();
    if (isSuper()) {
      loadGlobalUsers();
      loadBannedList();
      loadIpBannedList();
      loadHistoryUsers();
      loadAdminKeyInfo();
      loadPointsSection();
    }
    startAutoRefresh();
    // 路由导航
    navigateTo(getCurrentRoute(), false);
    return true;
  } catch (e) {
    return false;
  }
}

if (adminKey) {
  checkAuthAndLoad();
}

document.querySelector("#login-btn").addEventListener("click", async () => {
  adminKey = document.querySelector("#admin-key").value;
  if (!adminKey) return;
  try {
    let r = await fetch("/api/admin/auth-check?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    if (!data.level) throw new Error("密钥错误");
    localStorage.setItem("admin_key", adminKey);
    adminLevel = data.level;
    document.querySelector("#login-form").style.display = "none";
    document.querySelector("#admin-panel").style.display = "block";
    showSuperSections(isSuper());
    loadRooms();
    loadGlobalBlacklist();
    if (isSuper()) {
      loadGlobalUsers();
      loadBannedList();
      loadIpBannedList();
      loadHistoryUsers();
      loadAdminKeyInfo();
      loadPointsSection();
    }
    startAutoRefresh();
    navigateTo(getCurrentRoute(), false);
  } catch (e) {
    document.querySelector("#login-error").style.display = "block";
  }
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

document.querySelector("#ban-ip-btn").addEventListener("click", banIpByInput);
document.querySelector("#ban-ip-input").addEventListener("keydown", e => {
  if (e.key === "Enter") banIpByInput();
});

document.querySelector("#set-admin-key-btn").addEventListener("click", changeAdminKey);
document.querySelector("#reset-admin-key-btn").addEventListener("click", resetAdminKey);
document.querySelector("#new-admin-key-input").addEventListener("keydown", e => {
  if (e.key === "Enter") changeAdminKey();
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

    // 获取用户IP
    let userIpMap = {};
    try {
      let ipr = await fetch("/api/admin/user-ips?key=" + encodeURIComponent(adminKey));
      userIpMap = await ipr.json();
    } catch (e) { /* 忽略 */ }

    let entries = Object.entries(userRooms);
    if (entries.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:8px 0">暂无在线用户</div>';
      return;
    }

    // 获取积分
    let pointsMap = {};
    try {
      let pr = await fetch("/api/admin/points/all?key=" + encodeURIComponent(adminKey));
      pointsMap = await pr.json();
    } catch (e) {}

    let html = '';
    entries.forEach(([user, rooms]) => {
      let userTag = tagMap[user] || '';
      let tagText = userTag.tag || '';
      let tagColor = userTag.color || '';
      let tagStyle = tagColor && TAG_COLORS[tagColor] ? 'style="background:' + TAG_COLORS[tagColor] + '"' : '';
      let userIp = userIpMap[user] || '';
      let ipHtml = userIp ? ' <span style="color:#999;font-size:85%">(' + escapeHtml(userIp) + ')</span>' : '';
      let userPoints = pointsMap[user] || 0;
      let tagHtml = tagText
        ? '<span class="tag-badge" ' + tagStyle + '>' + escapeHtml(tagText) + '</span>'
            + '<button class="tag-remove-btn" onclick="removeTag(\'' + user.replace(/'/g, "\\'") + '\')">✕</button>'
        : '<input class="tag-input" placeholder="标签" maxlength="10">'
            + '<select class="tag-color-select">'
            + '<option value="">默认</option>'
            + '<option value="red" style="background:#e74c3c;color:#fff">红色</option>'
            + '<option value="blue" style="background:#3498db;color:#fff">蓝色</option>'
            + '<option value="green" style="background:#2ecc71;color:#fff">绿色</option>'
            + '<option value="purple" style="background:#9b59b6;color:#fff">紫色</option>'
            + '<option value="pink" style="background:#e91e63;color:#fff">粉色</option>'
            + '<option value="cyan" style="background:#00bcd4;color:#fff">青色</option>'
            + '<option value="gray" style="background:#95a5a6;color:#333">灰色</option>'
            + '<option value="orange" style="background:#e67e22;color:#fff">橙色</option>'
            + '<option value="yellow" style="background:#ffc107;color:#333">黄色</option>'
            + '<option value="teal" style="background:#009688;color:#fff">青绿</option>'
            + '<option value="indigo" style="background:#3f51b5;color:#fff">靛蓝</option>'
            + '<option value="brown" style="background:#795548;color:#fff">棕色</option>'
            + '<option value="lime" style="background:#cddc39;color:#333">酸橙</option>'
            + '<option value="deeporange" style="background:#ff5722;color:#fff">深橙色</option>'
            + '<option value="cadetblue" style="background:#5f9ea0;color:#fff">军蓝<\/option>'
            + '<option value="indianred" style="background:#cd5c5c;color:#fff">印度红<\/option>'
            + '<option value="mediumseagreen" style="background:#3cb371;color:#fff">中绿<\/option>'
            + '<option value="darkcyan" style="background:#008b8b;color:#fff">暗青<\/option>'
            + '<option value="slateblue" style="background:#6a5acd;color:#fff">灰蓝<\/option>'
            + '<option value="firebrick" style="background:#b22222;color:#fff">砖红<\/option>'
            + '<option value="olive" style="background:#808000;color:#fff">橄榄<\/option>'
            + '<option value="chocolate" style="background:#d2691e;color:#fff">巧克力<\/option>'
            + '<option value="darkviolet" style="background:#9400d3;color:#fff">暗紫<\/option>'
            + '<option value="mediumpurple" style="background:#9370db;color:#fff">中紫<\/option>'
            + '<option value="royalblue" style="background:#4169e1;color:#fff">宝蓝<\/option>'
            + '<option value="steel" style="background:#4682b4;color:#fff">钢蓝<\/option>'
            + '<option value="turquoise" style="background:#40e0d0;color:#333">碧绿<\/option>'
            + '<option value="seagreen" style="background:#2e8b57;color:#fff">海绿<\/option>'
            + '<option value="forest" style="background:#228b22;color:#fff">森林<\/option>'
            + '<option value="amber" style="background:#ffbf00;color:#333">琥珀<\/option>'
            + '<option value="gold" style="background:#ffd700;color:#333">金色<\/option>'
            + '<option value="coral" style="background:#ff7043;color:#fff">珊瑚<\/option>'
            + '<option value="crimson" style="background:#dc143c;color:#fff">深红<\/option>'
            + '<option value="rose" style="background:#ff80ab;color:#333">玫红<\/option>'
            + '</select>'
            + '<button class="tag-set-btn" onclick="setTag(this, \'' + user.replace(/'/g, "\\'") + '\')">设置</button>';
      html += '<div class="global-user-item">' +
        '<span class="name">' + escapeHtml(user) + ipHtml + tagHtml + '</span>' +
        '<span class="rooms">房间: ' + rooms.map(r => '#' + r).join(', ') + '</span>' +
        '<span style="display:flex;align-items:center;gap:4px">' +
        '<span class="points-badge" style="color:#e67e22;font-weight:bold">' + userPoints + '</span>' +
        '<input class="tag-input" placeholder="积分" id="pts-input-' + user.replace(/[^a-zA-Z0-9]/g, '_') + '" style="width:50px">' +
        '<button class="tag-set-btn" onclick="setPoints(\'' + user.replace(/'/g, "\\'") + '\')">设置</button>' +
        '<button class="kick-btn" onclick="globalKick(\'' + user.replace(/'/g, "\\'") + '\')">全局踢出</button>' +
        '<button class="ban-btn" onclick="banUser(\'' + user.replace(/'/g, "\\'") + '\')">封禁</button>' +
        '<button class="ban-btn" onclick="blacklistUser(\'' + user.replace(/'/g, "\\'") + '\')">拉黑</button>' +
        '</span>' +
        '</div>';
    });
    container.innerHTML = html;
    addBorderSelects();
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

async function loadIpBannedList() {
  let container = document.querySelector("#ip-banned-list");
  try {
    let r = await fetch("/api/admin/ip-ban/list?key=" + encodeURIComponent(adminKey));
    let banned = await r.json();
    if (!Array.isArray(banned) || banned.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:8px 0">暂无被封禁IP</div>';
      return;
    }
    let html = '';
    banned.forEach(ip => {
      html += '<div class="banned-user-item">' +
        '<span class="name">' + escapeHtml(ip) + '</span>' +
        '<button class="unban-btn" onclick="unbanIp(\'' + ip.replace(/'/g, "\\'") + '\')">解封</button>' +
        '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败: ' + e.message + '</div>';
  }
}

function banIpByInput() {
  let input = document.querySelector("#ban-ip-input");
  let ip = input.value.trim();
  if (!ip) { alert("请输入IP地址"); return; }
  banIp(ip);
  input.value = "";
}

async function banIp(ip) {
  if (!confirm("确定封禁IP " + ip + " 吗？")) return;
  try {
    let r = await fetch("/api/admin/ip-ban/add?key=" + encodeURIComponent(adminKey) + "&ip=" + encodeURIComponent(ip));
    let text = await r.text();
    alert(text);
    loadIpBannedList();
  } catch (e) {
    alert("操作失败");
  }
}

async function unbanIp(ip) {
  if (!confirm("确定解封IP " + ip + " 吗？")) return;
  try {
    let r = await fetch("/api/admin/ip-ban/remove?key=" + encodeURIComponent(adminKey) + "&ip=" + encodeURIComponent(ip));
    let text = await r.text();
    alert(text);
    loadIpBannedList();
  } catch (e) {
    alert("操作失败");
  }
}

async function loadGlobalBlacklist() {
  let container = document.querySelector("#global-blacklist-list");
  try {
    let r = await fetch("/api/admin/global-blacklist/list?key=" + encodeURIComponent(adminKey));
    let list = await r.json();
    if (!Array.isArray(list) || list.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:8px 0">暂无被拉黑的用户</div>';
      return;
    }
    let html = '';
    list.forEach(user => {
      html += '<div class="banned-user-item">' +
        '<span class="name">' + escapeHtml(user) + '</span>' +
        '<button onclick="unblacklistUser(\'' + user.replace(/'/g, "\\'") + '\')" style="padding:4px 10px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:85%">移出黑名单</button>' +
        '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败: ' + e.message + '</div>';
  }
}

async function setPoints(user) {
  let input = document.querySelector("#pts-input-" + user.replace(/[^a-zA-Z0-9]/g, '_'));
  if (!input) return;
  let amount = parseInt(input.value, 10);
  if (isNaN(amount)) { alert("请输入有效积分数量"); return; }
  try {
    let r = await fetch("/api/admin/points/set?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user) + "&amount=" + amount);
    let t = await r.text();
    alert(t);
    loadGlobalUsers();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

async function blacklistUser(user) {
  if (!confirm("确定将 " + user + " 加入全局黑名单吗？加入后该用户无法在其他踢人。")) return;
  try {
    let r = await fetch("/api/admin/global-blacklist/add?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    loadGlobalBlacklist();
    loadGlobalUsers();
  } catch (e) {
    alert("操作失败");
  }
}

async function unblacklistUser(user) {
  if (!confirm("确定将 " + user + " 移出全局黑名单吗？")) return;
  try {
    let r = await fetch("/api/admin/global-blacklist/remove?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user));
    let text = await r.text();
    alert(text);
    loadGlobalBlacklist();
    loadGlobalUsers();
  } catch (e) {
    alert("操作失败");
  }
}

async function loadAdminKeyInfo() {
  let display = document.querySelector("#admin-key-display");
  try {
    let r = await fetch("/api/admin/admin-key/get?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    if (data.key) {
      // 只显示前4位+掩码，安全显示
      let masked = data.key.length > 4 ? data.key.slice(0, 4) + "****" : "****";
      display.textContent = "当前密钥: " + masked;
    }
  } catch (e) {
    display.textContent = "加载失败";
  }
}


async function loadUserTags() {
  let tbody = document.querySelector("#ut-tbody");
  let stats = document.querySelector("#ut-stats");
  let empty = document.querySelector("#ut-empty");
  let search = document.querySelector("#ut-search").value.toLowerCase().trim();
  if (!tbody) return;
  try {
    let r = await fetch("/api/admin/user-tags?key=" + encodeURIComponent(adminKey));
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
        ? '<span class="shop-tag-badge" style="background:' + (TAG_COLORS[equipped.color] || '#888') + '">' + equipped.tag + '</span>'
        : '<span style="color:#999">-</span>';
      let itemsList = u.items.map(i => {
        let c = TAG_COLORS[i.color] || '#888';
        return '<span class="shop-tag-badge" style="background:' + c + ';margin:1px 2px;font-size:11px">' + (i.tag || i.itemName) + '</span>';
      }).join('');
      let equipInfo = equipped
        ? '<span style="color:' + (TAG_COLORS[equipped.color] || '#888') + '">' + equipped.itemName + '</span>'
        : '<span style="color:#999">-</span>';
      return '<tr><td>' + u.username + '</td><td>' + tagDisplay + '</td><td>' + (equipped ? equipped.color : '-') + '</td><td>' + equipInfo + '</td><td>' + (itemsList || '-') + '</td></tr>';
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#c00;padding:20px">加载失败: ' + e.message + '</td></tr>';
  }
}

async function changeAdminKey() {
  let input = document.querySelector("#new-admin-key-input");
  let newKey = input.value.trim();
  if (!newKey) { alert("请输入新密钥"); return; }
  if (newKey.length < 3) { alert("密钥长度至少3位"); return; }
  try {
    let r = await fetch("/api/admin/admin-key/set?key=" + encodeURIComponent(adminKey) + "&newkey=" + encodeURIComponent(newKey));
    let text = await r.text();
    alert(text);
    input.value = "";
    loadAdminKeyInfo();
  } catch (e) {
    alert("操作失败");
  }
}

async function resetAdminKey() {
  if (!confirm("确定将管理员密钥重置为默认值吗？")) return;
  try {
    let r = await fetch("/api/admin/admin-key/reset?key=" + encodeURIComponent(adminKey));
    let text = await r.text();
    alert(text);
    loadAdminKeyInfo();
  } catch (e) {
    alert("操作失败");
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

    // 获取用户IP
    let userIpMap = {};
    try {
      let ipr = await fetch("/api/admin/user-ips?key=" + encodeURIComponent(adminKey));
      userIpMap = await ipr.json();
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
      let tagText = userTag.tag || '';
      let tagColor = userTag.color || '';
      let tagStyle = tagColor && TAG_COLORS[tagColor] ? 'style="background:' + TAG_COLORS[tagColor] + '"' : '';
      let userIp = userIpMap[user] || '';
      let ipHtml = userIp ? ' <span style="color:#999;font-size:85%">(' + escapeHtml(userIp) + ')</span>' : '';
      let tagHtml = tagText
        ? '<span class="tag-badge" ' + tagStyle + '>' + escapeHtml(tagText) + '</span>'
            + '<button class="tag-remove-btn" onclick="removeTag(\'' + user.replace(/'/g, "\\'") + '\')">✕</button>'
        : '<input class="tag-input" placeholder="标签" maxlength="10">'
            + '<select class="tag-color-select">'
            + '<option value="">默认</option>'
            + '<option value="red" style="background:#e74c3c;color:#fff">红色</option>'
            + '<option value="blue" style="background:#3498db;color:#fff">蓝色</option>'
            + '<option value="green" style="background:#2ecc71;color:#fff">绿色</option>'
            + '<option value="purple" style="background:#9b59b6;color:#fff">紫色</option>'
            + '<option value="pink" style="background:#e91e63;color:#fff">粉色</option>'
            + '<option value="cyan" style="background:#00bcd4;color:#fff">青色</option>'
            + '<option value="gray" style="background:#95a5a6;color:#333">灰色</option>'
            + '<option value="orange" style="background:#e67e22;color:#fff">橙色</option>'
            + '<option value="yellow" style="background:#ffc107;color:#333">黄色</option>'
            + '<option value="teal" style="background:#009688;color:#fff">青绿</option>'
            + '<option value="indigo" style="background:#3f51b5;color:#fff">靛蓝</option>'
            + '<option value="brown" style="background:#795548;color:#fff">棕色</option>'
            + '<option value="lime" style="background:#cddc39;color:#333">酸橙</option>'
            + '<option value="deeporange" style="background:#ff5722;color:#fff">深橙色</option>'
            + '<option value="cadetblue" style="background:#5f9ea0;color:#fff">军蓝<\/option>'
            + '<option value="indianred" style="background:#cd5c5c;color:#fff">印度红<\/option>'
            + '<option value="mediumseagreen" style="background:#3cb371;color:#fff">中绿<\/option>'
            + '<option value="darkcyan" style="background:#008b8b;color:#fff">暗青<\/option>'
            + '<option value="slateblue" style="background:#6a5acd;color:#fff">灰蓝<\/option>'
            + '<option value="firebrick" style="background:#b22222;color:#fff">砖红<\/option>'
            + '<option value="olive" style="background:#808000;color:#fff">橄榄<\/option>'
            + '<option value="chocolate" style="background:#d2691e;color:#fff">巧克力<\/option>'
            + '<option value="darkviolet" style="background:#9400d3;color:#fff">暗紫<\/option>'
            + '<option value="mediumpurple" style="background:#9370db;color:#fff">中紫<\/option>'
            + '<option value="royalblue" style="background:#4169e1;color:#fff">宝蓝<\/option>'
            + '<option value="steel" style="background:#4682b4;color:#fff">钢蓝<\/option>'
            + '<option value="turquoise" style="background:#40e0d0;color:#333">碧绿<\/option>'
            + '<option value="seagreen" style="background:#2e8b57;color:#fff">海绿<\/option>'
            + '<option value="forest" style="background:#228b22;color:#fff">森林<\/option>'
            + '<option value="amber" style="background:#ffbf00;color:#333">琥珀<\/option>'
            + '<option value="gold" style="background:#ffd700;color:#333">金色<\/option>'
            + '<option value="coral" style="background:#ff7043;color:#fff">珊瑚<\/option>'
            + '<option value="crimson" style="background:#dc143c;color:#fff">深红<\/option>'
            + '<option value="rose" style="background:#ff80ab;color:#333">玫红<\/option>'
            + '</select>'
            + '<button class="tag-set-btn" onclick="setTag(this, \'' + user.replace(/'/g, "\\'") + '\')">设置</button>';
      let isBanned = bannedList.includes(user);

      html += '<div class="history-user-item">' +
        '<span><span class="name">' + escapeHtml(user) + ipHtml + '</span>' + tagHtml + ' ' + statusHtml + '</span>' +
        '<span class="actions">';
      if (!isOnline) {
        html += '<button class="btn-danger" onclick="globalKick(\'' + user.replace(/'/g, "\\'") + '\')">踢出</button>';
      }
      if (!isBanned) {
        html += '<button class="btn-danger" onclick="banUser(\'' + user.replace(/'/g, "\\'") + '\')">封禁</button>';
      } else {
        html += '<button onclick="unbanUser(\'' + user.replace(/'/g, "\\'") + '\')">解封</button>';
      }
      html += '<button class="btn-danger" onclick="blacklistUser(\'' + user.replace(/'/g, "\\'") + '\')">拉黑</button>';
      html += '</span></div>';
    });
    container.innerHTML = html;
    addBorderSelects();
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:8px 0">加载失败: ' + e.message + '</div>';
  }
}

let expandedRoom = null;

async function setTag(btn, user) {
  let container = btn.parentNode;
  let input = container.querySelector('.tag-input');
  if (!input) return;
  let tag = input.value.trim();
  if (!tag) { alert("请输入标签"); return; }
  let colorSelect = container.querySelector('.tag-color-select');
  let color = colorSelect ? colorSelect.value : "";
	  let borderSelect = container.querySelector('.tag-border-select');
	  let border = borderSelect ? borderSelect.value : "";
	  let r = await fetch("/api/admin/tag/set?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(user) + "&tag=" + encodeURIComponent(tag) + "&color=" + encodeURIComponent(color) + "&border=" + encodeURIComponent(border));
  try {
    let text = await r.text();
    alert(text);
    loadGlobalUsers();
    loadHistoryUsers();
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
    loadHistoryUsers();
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
    let [users, blacklist, userDetails, files] = await Promise.all([
      fetch("/api/admin/room-users/" + encodeURIComponent(name) + "?key=" + encodeURIComponent(adminKey)).then(r => r.json()),
      fetch("/api/admin/blacklist/list/" + encodeURIComponent(name) + "?key=" + encodeURIComponent(adminKey)).then(r => r.json()),
      fetch("/api/admin/room-users-detail/" + encodeURIComponent(name) + "?key=" + encodeURIComponent(adminKey)).then(r => r.json()),
      fetch("/api/admin/room-files/" + encodeURIComponent(name) + "?key=" + encodeURIComponent(adminKey)).then(r => r.json()).catch(() => [])
    ]);

    // 构建 IP 映射
    let ipMap = {};
    if (Array.isArray(userDetails)) {
      userDetails.forEach(u => { if (u.name) ipMap[u.name] = u.ip || ""; });
    }

    let html = '<div class="room-actions">';
    html += '<button class="btn-danger" onclick="clearRoom(\'' + name.replace(/'/g, "\\'") + '\')">清空聊天记录</button>';
    html += '<button class="btn-primary" onclick="toggleRoomMessages(this, \'' + name.replace(/'/g, "\\'") + '\')">查看消息</button>';
    html += '</div>';

    // 公告设置
    html += '<div class="announcement-section" style="margin:8px 0;padding:8px;background:#f9f9f9;border-radius:6px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">📢 房间公告</div>';
    html += '<div style="display:flex;gap:6px;">';
    html += '<input type="text" id="ann-input-' + name.replace(/[^a-zA-Z0-9_-]/g, '_') + '" placeholder="输入公告内容（留空清除）" style="flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;">';
    html += '<button onclick="setAnnouncement(\'' + name.replace(/'/g, "\\'") + '\')" style="padding:4px 12px;background:#4a90d9;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">设置</button>';
    html += '</div></div>';

    // 快捷发送消息
    let safeRoom = name.replace(/'/g, "\\'");
    html += '<div class="announcement-section" style="margin:8px 0;padding:8px;background:#f9f9f9;border-radius:6px;">';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">✉️ 发送消息</div>';
    html += '<div style="display:flex;gap:6px;">';
    html += '<input type="text" id="qmsg-input-' + name.replace(/[^a-zA-Z0-9_-]/g, '_') + '" placeholder="输入消息并发送至房间" style="flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;">';
    html += '<button onclick="quickSendMessage(\'' + safeRoom + '\')" style="padding:4px 12px;background:#4a90d9;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">发送</button>';
    html += '</div></div>';

    // 用户列表
    html += '<div class="user-list">';
    if (users.length === 0) {
      html += '<div style="color:#888;font-size:90%">暂无在线用户</div>';
    } else {
      users.forEach(u => {
        let userIp = isSuper() ? (ipMap[u] || "") : "";
        let ipBadge = userIp ? ' <span style="color:#999;font-size:85%">(' + escapeHtml(userIp) + ')</span>' : '';
        html += '<div class="user-item">' +
          '<span class="name">' + escapeHtml(u) + ipBadge + '</span>' +
          '<span>' +
            '<button class="kick-btn" onclick="kickUser(\'' + name.replace(/'/g, "\\'") + '\', \'' + u.replace(/'/g, "\\'") + '\')">踢出</button>' +
            '<button class="ban-btn" onclick="blacklistUser(\'' + u.replace(/'/g, "\\'") + '\')">拉黑</button>';
        if (isSuper()) {
          if (blacklist.includes(u)) {
            html += '<button onclick="removeBlacklist(\'' + name.replace(/'/g, "\\'") + '\', \'' + u.replace(/'/g, "\\'") + '\')">移出黑名单</button>';
          } else {
            html += '<button onclick="addBlacklist(\'' + name.replace(/'/g, "\\'") + '\', \'' + u.replace(/'/g, "\\'") + '\')">禁止踢人</button>';
          }
          if (userIp) {
            html += '<button class="ban-btn" onclick="banIp(\'' + userIp.replace(/'/g, "\\'") + '\')">封禁IP</button>';
          }
          html += '<button class="ban-btn" onclick="banUser(\'' + u.replace(/'/g, "\\'") + '\')">封禁</button>';
        }
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

    // 文件列表
    html += '<div class="file-list-section"><h4>📎 文件</h4>';
    if (files.length === 0) {
      html += '<div class="file-empty">暂无文件</div>';
    } else {
      files.forEach(f => {
        let sz = f.fileSize || 0;
        let sizeStr = sz < 1024 ? sz + ' B' : sz < 1024 * 1024 ? (sz / 1024).toFixed(1) + ' KB' : (sz / (1024 * 1024)).toFixed(1) + ' MB';
        let fileName = escapeHtml(f.fileName || "unknown");
        let sender = escapeHtml(f.name || "unknown");
        html += '<div class="file-item">' +
          '<span class="file-info"><strong>' + fileName + '</strong> <span class="file-sender">(' + sender + ')</span></span>' +
          '<span>' +
            '<span class="file-size">' + sizeStr + '</span>' +
            '<a class="file-download" href="/api/admin/room-file-data/' + encodeURIComponent(name) + '?key=' + encodeURIComponent(adminKey) + '&timestamp=' + f.timestamp + '" target="_blank" rel="noopener noreferrer">下载</a>' +
          '</span>' +
          '</div>';
      });
    }
    html += '</div>';

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

// ========== 积分管理 ==========
let ptsSelectedUser = null;

async function loadPointsSection() {
  try {
    let r = await fetch("/api/admin/points/all?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    renderPointsTable(data);
    updatePointsStats(data);
  } catch (e) {
    document.querySelector("#pts-tbody").innerHTML = '<tr><td colspan="4" style="color:#c00;text-align:center;padding:20px">加载失败: ' + e.message + '</td></tr>';
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
  entries.sort((a, b) => b[1] - a[1]);
  let html = '';
  entries.forEach(([user, pts]) => {
    let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
    let highlight = ptsSelectedUser === user ? ' class="pts-highlight"' : '';
    let escUser = user.replace(/'/g, "\\'");
    let checked = (ptsCheckedUsers.has(user)) ? ' checked' : '';
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
  let total = entries.reduce((sum, [, p]) => sum + p, 0);
  document.querySelector("#pts-stats").textContent = '共 ' + entries.length + ' 人，总积分 ' + total;
}

function searchPointsUser() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  if (!name) return;
  selectPointsUser(name);
}

function selectPointsUser(name) {
  ptsSelectedUser = name;
  let infoDiv = document.querySelector("#pts-user-info");
  infoDiv.style.display = 'flex';
  document.querySelector("#pts-info-user").textContent = name;
  // 获取当前积分
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

async function setPtsToolbar() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  let amount = parseInt(document.querySelector("#pts-tb-amt").value, 10);
  if (!name) { alert("请输入用户名"); return; }
  if (isNaN(amount)) { alert("请输入有效积分值"); return; }
  await callPointsApi('set', name, amount);
}

async function addPtsToolbar() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  let amount = parseInt(document.querySelector("#pts-tb-amt").value, 10);
  if (!name) { alert("请输入用户名"); return; }
  if (isNaN(amount) || amount <= 0) { alert("请输入有效的增加数量"); return; }
  await callPointsApi('add', name, amount);
}

async function deductPtsToolbar() {
  let name = document.querySelector("#pts-tb-user").value.trim();
  let amount = parseInt(document.querySelector("#pts-tb-amt").value, 10);
  if (!name) { alert("请输入用户名"); return; }
  if (isNaN(amount) || amount <= 0) { alert("请输入有效的扣除数量"); return; }
  await callPointsApi('add', name, -amount);
}

async function setPtsInline(user) {
  let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
  let input = document.querySelector("#pts-inline-" + safeId);
  if (!input) return;
  let amount = parseInt(input.value, 10);
  if (isNaN(amount)) { alert("请输入有效积分值"); return; }
  await callPointsApi('set', user, amount);
}

async function addPtsInline(user) {
  let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
  let input = document.querySelector("#pts-inline-" + safeId);
  if (!input) return;
  let amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount <= 0) { alert("请输入有效的增加数量"); return; }
  await callPointsApi('add', user, amount);
}

async function deductPtsInline(user) {
  let safeId = user.replace(/[^a-zA-Z0-9]/g, '_');
  let input = document.querySelector("#pts-inline-" + safeId);
  if (!input) return;
  let amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount <= 0) { alert("请输入有效的扣除数量"); return; }
  await callPointsApi('add', user, -amount);
}

async function callPointsApi(action, name, amount) {
  try {
    let r = await fetch("/api/admin/points/" + action + "?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(name) + "&amount=" + amount);
    let t = await r.text();
    alert(t);
    ptsSelectedUser = name;

    // 从响应文本解析新积分值，避免重新加载全部数据
    let newPoints = null;
    let m = t.match(/当前\s*(-?\d+)/);
    if (m) {
      newPoints = parseInt(m[1], 10);
    } else if (action === 'set') {
      newPoints = amount;
    }

    if (newPoints !== null) {
      updatePointsRowLocal(name, newPoints);
    } else {
      // 解析失败时回退到全量刷新
      await loadPointsSection();
    }
    selectPointsUser(name);
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

function updatePointsRowLocal(name, newPts) {
  let rows = document.querySelector("#pts-tbody").querySelectorAll("tr");
  let oldPts = 0;
  let found = false;
  for (let row of rows) {
    let nameTd = row.querySelector(".p-name");
    if (nameTd && nameTd.textContent === name) {
      let ptsTd = row.querySelector(".p-points");
      if (ptsTd) {
        oldPts = parseInt(ptsTd.textContent, 10) || 0;
        ptsTd.textContent = newPts;
      }
      let inlineInput = row.querySelector("input[id^='pts-inline-']");
      if (inlineInput) inlineInput.value = newPts;
      found = true;
      break;
    }
  }

  // 未找到该行（可能是新用户），回退全量刷新
  if (!found) { loadPointsSection(); return; }

  document.querySelector("#pts-info-pts").textContent = newPts;

  // 更新统计信息中的总积分
  let statsEl = document.querySelector("#pts-stats");
  let totalMatch = statsEl.textContent.match(/总积分\s*(-?\d+)/);
  if (totalMatch) {
    let total = parseInt(totalMatch[1], 10);
    let diff = newPts - oldPts;
    statsEl.textContent = statsEl.textContent.replace(/总积分\s*(-?\d+)/, '总积分 ' + (total + diff));
  }
}


// 批量选择
let ptsCheckedUsers = new Set();

function toggleAllCheckboxes() {
  let headCb = document.querySelector("#pts-cb-all-head");
  let barCb = document.querySelector("#pts-cb-all");
  let checked = headCb ? headCb.checked : (barCb ? barCb.checked : false);
  if (headCb) headCb.checked = checked;
  if (barCb) barCb.checked = checked;
  document.querySelectorAll(".pts-cb-row").forEach(cb => cb.checked = checked);
  updateSelectedCount();
}

function updateSelectedCount() {
  let checkboxes = document.querySelectorAll(".pts-cb-row:checked");
  let names = [];
  checkboxes.forEach(cb => {
    let user = cb.value;
    ptsCheckedUsers.add(user);
    names.push(user);
  });
  // Also remove unchecked from the set
  document.querySelectorAll(".pts-cb-row:not(:checked)").forEach(cb => {
    ptsCheckedUsers.delete(cb.value);
  });
  document.querySelector("#pts-sel-count").textContent = checkboxes.length;
}

async function batchAdd() {
  let amount = parseInt(document.querySelector("#pts-batch-amt").value, 10);
  if (isNaN(amount) || amount <= 0) { alert("请输入有效的增加数量"); return; }
  await doBatch(amount);
}

async function batchDeduct() {
  let amount = parseInt(document.querySelector("#pts-batch-amt").value, 10);
  if (isNaN(amount) || amount <= 0) { alert("请输入有效的扣除数量"); return; }
  await doBatch(-amount);
}

async function doBatch(amount) {
  let checkboxes = document.querySelectorAll(".pts-cb-row:checked");
  if (checkboxes.length === 0) { alert("请先勾选要操作的用户"); return; }
  let names = [];
  checkboxes.forEach(cb => names.push(cb.value));
  if (!confirm("确定为 " + names.length + " 个用户" + (amount >= 0 ? "增加" : "扣除") + " " + Math.abs(amount) + " 积分吗？")) return;
  try {
    let r = await fetch("/api/admin/points/batch?key=" + encodeURIComponent(adminKey) + "&names=" + encodeURIComponent(names.join(",")) + "&amount=" + amount + "&action=add");
    let t = await r.text();
    alert(t);
    loadPointsSection();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
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


// ========== 商店管理 ==========
async function loadShopSection() {
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/shop/items?key=" + encodeURIComponent(adminKey));
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
    document.getElementById("shop-tbody").innerHTML = '<tr><td colspan="7" style="color:#c00;text-align:center">加载失败: ' + e.message + '</td></tr>';
  }
}

async function addShopItem() {
  let name = document.getElementById("shop-tb-name").value.trim();
  let desc = document.getElementById("shop-tb-desc").value.trim();
  let price = document.getElementById("shop-tb-price").value;
  let tag = document.getElementById("shop-tb-tag").value.trim();
  let color = document.getElementById("shop-tb-color").value;
  let border = document.getElementById("shop-tb-border").value;
  if (!name || !price || !tag) { alert("请至少填写商品名称、价格和标签"); return; }
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/shop/item/add?key=" + encodeURIComponent(adminKey), {
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

async function toggleShopItem(itemId) {
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/shop/item/toggle?key=" + encodeURIComponent(adminKey), {
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

async function deleteShopItem(itemId) {
  if (!confirm("确定删除此商品？")) return;
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/shop/item/delete?key=" + encodeURIComponent(adminKey), {
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

// ========== 任务管理 ==========
async function loadTaskSection() {
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/tasks/list?key=" + encodeURIComponent(adminKey));
    let tasks = await r.json();
    let tbody = document.getElementById("task-tbody");
    let empty = document.getElementById("task-empty");
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      document.getElementById("task-stats").textContent = "0 个任务";
      return;
    }
    empty.style.display = "none";
    let html = "";
    let enabledCount = 0;
    for (let task of tasks) {
      if (task.enabled) enabledCount++;
      let statusHtml = task.enabled ? '<span class="task-enabled">启用</span>' : '<span class="task-disabled">禁用</span>';
      html += "<tr>" +
        '<td class="t-name">' + escapeHtml(task.name) + '</td>' +
        "<td>" + escapeHtml(task.description || "") + '</td>' +
        "<td>" + task.reward + '</td>' +
        "<td>" + task.completedCount + '</td>' +
        "<td>" + statusHtml + '</td>' +
        '<td class="t-actions">' +
        '<button class="' + (task.enabled ? 'btn-toggle-off' : 'btn-toggle-on') + '" onclick="toggleTaskItem(\'' + task.id + '\')">' + (task.enabled ? '禁用' : '启用') + '</button>' +
        '<button class="btn-del" onclick="deleteTaskItem(\'' + task.id + '\')">删除</button>' +
        "</td></tr>";
    }
    tbody.innerHTML = html;
    document.getElementById("task-stats").textContent = enabledCount + "/" + tasks.length + " 个启用";
  } catch (e) {
    document.getElementById("task-tbody").innerHTML = '<tr><td colspan="7" style="color:#c00;text-align:center">加载失败: ' + e.message + '</td></tr>';
  }
}

async function addTaskItem() {
  let name = document.getElementById("task-tb-name").value.trim();
  let desc = document.getElementById("task-tb-desc").value.trim();
  let reward = document.getElementById("task-tb-reward").value;
  if (!name || !reward) { alert("请至少填写任务名称和奖励积分"); return; }
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/tasks/task/add?key=" + encodeURIComponent(adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name, description: desc, reward: parseInt(reward)})
    });
    let data = await r.json();
    if (data.error) { alert(data.error); return; }
    document.getElementById("task-tb-name").value = "";
    document.getElementById("task-tb-desc").value = "";
    document.getElementById("task-tb-reward").value = "";
    loadTaskSection();
  } catch (e) {
    alert("添加失败: " + e.message);
  }
}

async function toggleTaskItem(taskId) {
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/tasks/task/toggle?key=" + encodeURIComponent(adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({taskId})
    });
    let data = await r.json();
    if (data.error) { alert(data.error); return; }
    loadTaskSection();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

async function deleteTaskItem(taskId) {
  if (!confirm("确定删除此任务？")) return;
  try {
    let adminKey = localStorage.getItem("admin_key");
    let r = await fetch("/api/admin/tasks/task/delete?key=" + encodeURIComponent(adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({taskId})
    });
    let data = await r.json();
    if (data.error) { alert(data.error); return; }
    loadTaskSection();
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

// ========== 路由导航 ==========
const routeToSection = {
  '/admin/': 'dashboard-section',
  '/admin/dashboard/': 'dashboard-section',
  '/admin/rooms/': 'room-list-container',
  '/admin/users/': 'global-users-section',
  '/admin/bans/': 'banned-users-section',
  '/admin/ip-bans/': 'ip-banned-section',
  '/admin/history/': 'history-users-section',
  '/admin/blacklist/': 'global-blacklist-section',
  '/admin/points/': 'points-section',
  '/admin/shop/': 'shop-section',
  '/admin/task/': 'task-section',
  '/admin/ip-group/': 'ip-group-section',
  '/admin/admin-key/': 'admin-key-section',
    '/admin/user-tags/': 'user-tags-section',
    '/admin/lottery/': 'lottery-section',
    '/admin/send-message/': 'send-message-section',
    '/admin/bot/': 'bot-section',
    '/admin/emoji/': 'emoji-section',
};

function getCurrentRoute() {
  let p = location.pathname;
  // 确保以 / 结尾
  if (!p.endsWith('/')) p += '/';
  // 匹配已知路由
  if (routeToSection[p]) return p;
  // 尝试更长的匹配（如 /admin/rooms/xxx/ 匹配 /admin/rooms/）
  for (let r of Object.keys(routeToSection)) {
    if (r !== '/admin/' && p.startsWith(r)) return r;
  }
  return '/admin/dashboard/';
}

function navigateTo(path, pushHistory) {
  if (pushHistory !== false) {
    history.pushState({}, '', path);
  }
  // 隐藏所有页面，显示目标页
  let targetId = routeToSection[path] || 'room-list-container';
  document.querySelectorAll('.page-section').forEach(el => {
    el.classList.remove('active');
  });
  let target = document.getElementById(targetId);
  if (target) target.classList.add('active');

  // 更新导航高亮
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  let navItem = document.querySelector('.nav-item[data-route="' + path + '"]');
  if (navItem) navItem.classList.add('active');

  // 延迟加载数据
  setTimeout(() => loadSectionData(targetId), 50);
}

function loadSectionData(sectionId) {
  switch (sectionId) {
    case 'dashboard-section': loadDashboard(); break;
    case 'room-list-container': loadRooms(); break;
    case 'global-users-section': loadGlobalUsers(); break;
    case 'banned-users-section': loadBannedList(); break;
    case 'ip-banned-section': loadIpBannedList(); break;
    case 'history-users-section': loadHistoryUsers(); break;
    case 'global-blacklist-section': loadGlobalBlacklist(); break;
    case 'points-section': loadPointsSection(); break;
    case 'shop-section': loadShopSection(); break;
    case 'task-section': loadTaskSection(); break;
    case 'ip-group-section': loadIpGroup(); break;
    case 'admin-key-section': loadAdminKeyInfo(); break;
        case 'user-tags-section': loadUserTags(); break;
        case 'lottery-section': loadLotteryPools(); break;
        case 'send-message-section': loadSendMessageSection(); break;
        case 'bot-section': loadBotSection(); break;
        case 'emoji-section': loadEmojiSection(); break;
  }
}

// ========== 发送消息 ==========
async function loadSendMessageSection() {
  let sel = document.getElementById("sm-room");
  if (!sel) return;
  if (sel.options.length > 1) return; // 已经加载过
  try {
    let r = await fetch("/api/rooms/list");
    let rooms = await r.json();
    sel.innerHTML = '<option value="">选择房间...</option>';
    Object.keys(rooms).forEach(name => {
      let opt = document.createElement("option");
      opt.value = name;
      opt.textContent = '#' + name + ' (' + rooms[name] + ' 在线)';
      sel.appendChild(opt);
    });
  } catch (e) {
    sel.innerHTML = '<option value="">加载房间列表失败</option>';
  }
}

async function sendMessage() {
  let room = document.getElementById("sm-room").value;
  let sender = document.getElementById("sm-sender").value.trim() || "系统公告";
  let text = document.getElementById("sm-text").value.trim();
  let statusEl = document.getElementById("sm-status");
  if (!room) { statusEl.textContent = "请选择目标房间"; return; }
  if (!text) { statusEl.textContent = "请输入消息内容"; return; }
  let btn = document.getElementById("sm-send-btn");
  btn.disabled = true;
  btn.textContent = "发送中...";
  statusEl.textContent = "";
  try {
    let r = await fetch("/api/admin/send-message/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&text=" + encodeURIComponent(text) + "&sender=" + encodeURIComponent(sender));
    let result = await r.text();
    statusEl.textContent = r.ok ? "✓ " + result : "✗ " + result;
    if (r.ok) document.getElementById("sm-text").value = "";
  } catch (e) {
    statusEl.textContent = "发送失败: " + e.message;
  }
  btn.disabled = false;
  btn.textContent = "发送";
}
window.sendMessage = sendMessage;

async function quickSendMessage(room) {
  let input = document.getElementById("qmsg-input-" + room.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!input) return;
  let text = input.value.trim();
  if (!text) { alert("请输入消息内容"); return; }
  try {
    let r = await fetch("/api/admin/send-message/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&text=" + encodeURIComponent(text) + "&sender=系统通知");
    let result = await r.text();
    if (r.ok) { input.value = ""; alert(result); }
    else alert(result);
  } catch (e) {
    alert("发送失败: " + e.message);
  }
}
window.quickSendMessage = quickSendMessage;

// ========== 机器人管理 ==========
async function loadBotSection() {
  let list = document.getElementById("bot-list");
  list.innerHTML = '<div style="color:#888;text-align:center;padding:20px">加载中...</div>';
  try {
    let r = await fetch("/api/admin/bot?action=list&key=" + encodeURIComponent(adminKey));
    let cmds = await r.json();
    if (!Array.isArray(cmds) || cmds.length === 0) {
      list.innerHTML = '<div style="color:#888;text-align:center;padding:20px">暂无命令，添加一个新命令吧</div>';
      return;
    }
    list.innerHTML = "";
    cmds.forEach(cmd => {
      let row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;";
      let enabled = cmd.enabled !== false;
      row.innerHTML =
        '<span style="font-weight:bold;min-width:80px">' + cmd.keyword + '</span>' +
        '<span style="flex:1;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(cmd.response || "") + '</span>' +
        '<span style="font-size:12px;padding:2px 8px;border-radius:4px;background:' + (enabled ? "#e8f5e9" : "#fde8e8") + ';color:' + (enabled ? "#2e7d32" : "#c62828") + '">' + (enabled ? "启用" : "禁用") + '</span>' +
        '<button onclick="toggleBot(\'' + cmd.keyword + '\')" style="padding:4px 8px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:80%">' + (enabled ? "禁用" : "启用") + '</button>' +
        '<button onclick="deleteBot(\'' + cmd.keyword + '\')" style="padding:4px 8px;border:1px solid #e88;color:#c00;background:#fff;border-radius:4px;cursor:pointer;font-size:80%">删除</button>';
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = '<div style="color:#c00;text-align:center;padding:20px">加载失败: ' + e.message + '</div>';
  }
}
window.loadBotSection = loadBotSection;

document.addEventListener("keydown", function(e) {
  if (e.target && (e.target.id === "bot-keyword" || e.target.id === "bot-response") && e.key === "Enter") {
    e.preventDefault(); addBot();
  }
});

async function addBot() {
  let keyword = document.getElementById("bot-keyword").value.trim();
  let response = document.getElementById("bot-response").value.trim();
  let statusEl = document.getElementById("bot-add-status");
  if (!keyword) { alert("请输入命令关键词"); return; }
  if (!response) { alert("请输入回复内容"); return; }
  try {
    let r = await fetch("/api/admin/bot?action=add&key=" + encodeURIComponent(adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({keyword, response})
    });
    let data = await r.json();
    if (data.ok) {
      document.getElementById("bot-keyword").value = "";
      document.getElementById("bot-response").value = "";
      loadBotSection();
    } else {
      alert("添加失败: " + (data.error || "未知错误"));
    }
  } catch (e) {
    alert("添加失败: " + e.message);
  }
}
window.addBot = addBot;

async function toggleBot(keyword) {
  try {
    let r = await fetch("/api/admin/bot?action=get&keyword=" + encodeURIComponent(keyword) + "&key=" + encodeURIComponent(adminKey));
    let cmd = await r.json();
    let newEnabled = cmd.enabled === false;
    await fetch("/api/admin/bot?action=update&key=" + encodeURIComponent(adminKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({keyword, response: cmd.response || "", enabled: newEnabled})
    });
    loadBotSection();
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}
window.toggleBot = toggleBot;

async function deleteBot(keyword) {
  if (!confirm("确定删除命令 /" + keyword + " ？")) return;
  try {
    await fetch("/api/admin/bot?action=delete&keyword=" + encodeURIComponent(keyword) + "&key=" + encodeURIComponent(adminKey));
    loadBotSection();
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}
window.deleteBot = deleteBot;

// ========== 表情管理 ==========
async function loadEmojiSection() {
  let list = document.getElementById("emoji-list");
  list.innerHTML = '<div style="color:#888;text-align:center;padding:20px">加载中...</div>';
  try {
    let r = await fetch("/api/admin/emoji/list?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    if (!data.emojis || data.emojis.length === 0) {
      list.innerHTML = '<div style="color:#888;text-align:center;padding:20px">暂无表情，上传一个新表情吧</div>';
      return;
    }
    list.innerHTML = "";
    let names = data.emojis;
    names.forEach(name => {
      let row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;";
      row.innerHTML =
        '<span style="font-weight:bold;min-width:100px">:' + name + ':</span>' +
        '<button onclick="deleteEmoji(\'' + name.replace(/['\\]/g, '') + '\')" style="padding:4px 8px;border:1px solid #e88;color:#c00;background:#fff;border-radius:4px;cursor:pointer;font-size:80%">删除</button>';
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = '<div style="color:#c00;text-align:center;padding:20px">加载失败: ' + e.message + '</div>';
  }
}
window.loadEmojiSection = loadEmojiSection;

async function addEmoji() {
  let name = document.getElementById("emoji-name").value.trim();
  let fileInput = document.getElementById("emoji-file");
  let file = fileInput.files[0];
  let statusEl = document.getElementById("emoji-add-status");
  if (!name) { alert("请输入表情名称"); return; }
  if (!file) { alert("请选择图片文件"); return; }
  if (!/^[a-zA-Z0-9_一-鿿]+$/.test(name)) { alert("表情名称只能包含字母、数字、下划线和中文"); return; }
  if (file.size > 200 * 1024) { alert("图片文件不能超过200KB"); return; }

  let reader = new FileReader();
  reader.onload = async (ev) => {
    let dataUri = ev.target.result;
    try {
      statusEl.textContent = "上传中...";
      let r = await fetch("/api/admin/emoji/add?key=" + encodeURIComponent(adminKey), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, data: dataUri})
      });
      let result = await r.json();
      if (result.ok) {
        document.getElementById("emoji-name").value = "";
        fileInput.value = "";
        statusEl.textContent = "✓ 添加成功";
        loadEmojiSection();
      } else {
        alert("添加失败: " + (result.error || "未知错误"));
        statusEl.textContent = "";
      }
    } catch (e) {
      alert("添加失败: " + e.message);
      statusEl.textContent = "";
    }
  };
  reader.readAsDataURL(file);
}
window.addEmoji = addEmoji;

async function deleteEmoji(name) {
  if (!confirm("确定删除 :" + name + ": ？")) return;
  try {
    let r = await fetch("/api/admin/emoji/remove?name=" + encodeURIComponent(name) + "&key=" + encodeURIComponent(adminKey));
    let result = await r.json();
    if (result.ok) loadEmojiSection();
    else alert("删除失败: " + (result.error || "未知错误"));
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}
window.deleteEmoji = deleteEmoji;

function escapeHtml(str) {
  let d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// 浏览器前进/后退
window.addEventListener('popstate', () => {
  navigateTo(getCurrentRoute(), false);
});


// ========== 系统概览 ==========
async function loadDashboard() {
  try {
    // 并发获取各项数据
    let [roomsRes, onlineRes, pointsRes, bannedRes, historyRes, ipBannedRes, ipsRes] = await Promise.all([
      fetch("/api/rooms/list"),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/points/all?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/ban/list?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/users/history?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/ip-ban/list?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(adminKey))
    ]);
    let rooms = await roomsRes.json();
    let onlineData = await onlineRes.json();
    let pointsData = await pointsRes.json();
    let bannedList = await bannedRes.json();
    let historyList = await historyRes.json();
    let ipBannedList = await ipBannedRes.json();
    let ipsData = await ipsRes.json();

    // 计算在线用户数（去重）
    let onlineSet = new Set();
    for (let users of Object.values(onlineData)) {
      users.forEach(u => onlineSet.add(u));
    }
    let roomCount = Object.keys(rooms).length;
    let onlineCount = onlineSet.size;
    let historyCount = Array.isArray(historyList) ? historyList.length : 0;
    let bannedCount = Array.isArray(bannedList) ? bannedList.length : 0;

    // 总积分
    let totalPoints = 0;
    let pointsEntries = Object.entries(pointsData);
    pointsEntries.forEach(([, p]) => totalPoints += p);

    document.querySelector("#dash-rooms").textContent = roomCount;
    document.querySelector("#dash-online").textContent = onlineCount;
    document.querySelector("#dash-users").textContent = historyCount;
    document.querySelector("#dash-banned").textContent = bannedCount + (ipBannedList.length > 0 ? " (+" + ipBannedList.length + " IP)" : "");
    document.querySelector("#dash-ipbanned").textContent = ipBannedList.length;
    document.querySelector("#dash-points").textContent = totalPoints;

    // 同IP分组统计：找出共用IP的用户
    let ipToUsers = {};
    for (let [user, ip] of Object.entries(ipsData)) {
      if (!ip) continue;
      if (!ipToUsers[ip]) ipToUsers[ip] = [];
      ipToUsers[ip].push(user);
    }
    let multiUserIps = Object.values(ipToUsers).filter(u => u.length > 1).length;
    document.querySelector("#dash-ipgroups").textContent = multiUserIps;

    // 积分排行 TOP 10
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

// ========== 同IP检测 ==========
let ipgExpanded = null;

async function loadIpGroup() {
  let container = document.querySelector("#ipg-list");
  let q = document.querySelector("#ipg-search").value.trim().toLowerCase();
  try {
    let [ipsRes, pointsRes, onlineRes, tagsRes, bannedRes] = await Promise.all([
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/points/all?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/tag/list?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/ban/list?key=" + encodeURIComponent(adminKey))
    ]);
    let ipsData = await ipsRes.json();
    let pointsData = await pointsRes.json();
    let onlineData = await onlineRes.json();
    let tagsData = await tagsRes.json();
    let bannedList = await bannedRes.json();

    // Build online set
    let onlineSet = new Set();
    for (let users of Object.values(onlineData)) {
      users.forEach(u => onlineSet.add(u));
    }

    // Reverse: ip -> [users]
    let ipToUsers = {};
    for (let [user, ip] of Object.entries(ipsData)) {
      if (!ip) continue;
      if (!ipToUsers[ip]) ipToUsers[ip] = [];
      ipToUsers[ip].push(user);
    }

    // Sort IPs by number of users (most shared first)
    let entries = Object.entries(ipToUsers).sort((a, b) => b[1].length - a[1].length);

    if (entries.length === 0) {
      container.innerHTML = '<div class="ipg-empty">暂无IP数据</div>';
      document.querySelector("#ipg-count").textContent = "";
      return;
    }

    // Count IPs with multiple users
    let multiCount = entries.filter(([, users]) => users.length > 1).length;
    document.querySelector("#ipg-count").textContent = "共 " + entries.length + " 个IP，其中 " + multiCount + " 个IP有多个用户";

    let html = '';
    entries.forEach(([ip, users]) => {
      // Filter by search query
      if (q && !ip.includes(q) && !users.some(u => u.toLowerCase().includes(q))) {
        return;
      }

      let totalPts = 0;
      let onlineCount = 0;
      users.forEach(u => {
        totalPts += pointsData[u] || 0;
        if (onlineSet.has(u)) onlineCount++;
      });

      let isOpen = ipgExpanded === ip;
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
    container.innerHTML = '<div class="ipg-empty" style="color:#c00">加载失败: ' + e.message + '</div>';
  }
}

function toggleIpGroup(ip) {
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
        ipgExpanded = isNowOpen ? null : ip;
      }
    }
  });
}

// ========== 房间消息查看 ==========
async function toggleRoomMessages(btn, room) {
  let detail = btn.closest(".room-detail");
  let existing = detail.querySelector(".msg-viewer");
  if (existing) {
    existing.remove();
    btn.textContent = "查看消息";
    return;
  }

  btn.textContent = "加载中...";
  let viewer = document.createElement("div");
  viewer.className = "msg-viewer";
  viewer.innerHTML = '<h4>📝 最近消息</h4><div class="msg-loading">加载中...</div>';
  detail.appendChild(viewer);

  try {
    let r = await fetch("/api/admin/room-messages/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&limit=30");
    let msgs = await r.json();
    if (!Array.isArray(msgs) || msgs.length === 0) {
      viewer.innerHTML = '<h4>📝 最近消息</h4><div style="color:#888;font-size:85%;padding:8px">暂无消息记录</div>';
      btn.textContent = "查看消息";
      return;
    }
    let html = '<h4>📝 最近消息 (' + msgs.length + ' 条)</h4>';
    msgs.forEach(msg => {
      let ts = msg.timestamp ? new Date(msg.timestamp) : null;
      let timeStr = ts ? ("0" + ts.getHours()).slice(-2) + ":" + ("0" + ts.getMinutes()).slice(-2) : "";
      let msgContent = '';
      if (msg.type === "image") {
        msgContent = '<span class="msg-img-placeholder">📷 [图片]</span>';
      } else if (msg.type === "file") {
        msgContent = '<span class="msg-img-placeholder">📎 ' + escapeHtml(msg.fileName || "[文件]") + '</span>';
      } else {
        msgContent = escapeHtml(msg.message || "");
      }
      html += '<div class="msg-item">' +
        '<span class="msg-time">' + timeStr + '</span>' +
        '<span class="msg-name">' + escapeHtml(msg.name || "?") + '</span>' +
        '<span class="msg-text">' + msgContent + '</span>' +
      '</div>';
    });
    viewer.innerHTML = html;
    btn.textContent = "收起消息";
  } catch (e) {
    viewer.innerHTML = '<h4>📝 最近消息</h4><div style="color:#c00;font-size:85%;padding:8px">加载失败: ' + e.message + '</div>';
    btn.textContent = "查看消息";
  }
}

async function setAnnouncement(room) {
  let inputId = 'ann-input-' + room.replace(/[^a-zA-Z0-9_-]/g, '_');
  let text = document.getElementById(inputId).value.trim();
  try {
    let r = await fetch("/api/admin/announcement/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(adminKey) + "&text=" + encodeURIComponent(text));
    let result = await r.text();
    alert(result);
  } catch (e) {
    alert("设置公告失败: " + e.message);
  }
}

// ========== 快速搜索 ==========
function quickSearch() {
  let q = document.querySelector("#quick-search").value.trim();
  if (!q) return;
  showUserDetail(q);
}

// ========== 用户详情弹窗 ==========
async function showUserDetail(username) {
  let overlay = document.querySelector("#user-modal-overlay");
  overlay.classList.add("open");
  document.querySelector("#um-username").textContent = username;
  document.querySelector("#um-body").innerHTML = '<div style="text-align:center;color:#888;padding:20px">加载中...</div>';

  try {
    // 并发获取用户相关数据
    let [pointsRes, tagsRes, ipsRes, onlineRes, bannedRes] = await Promise.all([
      fetch("/api/admin/points/get?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(username)),
      fetch("/api/admin/tag/list?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/all-users?key=" + encodeURIComponent(adminKey)),
      fetch("/api/admin/ban/list?key=" + encodeURIComponent(adminKey))
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

    // 查所在房间
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
    // 根据权限显示操作按钮
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

    document.querySelector("#um-body").innerHTML =
      '<div class="modal-field"><span class="mf-label">用户名</span><span class="mf-value">' + escapeHtml(username) + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">状态</span><span class="mf-value ' + (isOnline ? 'online' : 'offline') + '">' + statusHtml + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">积分</span><span class="mf-value" style="color:#e67e22;font-weight:bold">' + pts + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">标签</span><span class="mf-value">' + tagHtml + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">IP地址</span><span class="mf-value" style="color:#999;font-family:monospace;font-size:95%">' + escapeHtml(userIp) + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">所在房间</span><span class="mf-value">' + roomHtml + '</span></div>' +
      '<div class="modal-field"><span class="mf-label">封禁状态</span><span class="mf-value">' + banHtml + '</span></div>' +
      '<div class="modal-actions">' + actionsHtml + '</div>';

    // 点击外部关闭
    overlay.onclick = function(e) { if (e.target === this) closeUserModal(); };
  } catch (e) {
    document.querySelector("#um-body").innerHTML = '<div style="color:#c00;text-align:center;padding:20px">加载失败: ' + e.message + '</div>';
  }
}

function closeUserModal() {
  document.querySelector("#user-modal-overlay").classList.remove("open");
}

// ========== 导出积分 CSV ==========
function exportPointsCSV() {
  // 从当前已加载的数据生成 CSV
  let table = document.querySelector("#pts-tbody");
  if (!table) { alert("请先打开积分管理页面"); return; }
  let rows = table.querySelectorAll("tr");
  if (rows.length === 0) { alert("暂无积分数据可导出"); return; }
  let csv = "\uFEFF用户名,积分\n";
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
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    let active = document.querySelector('.page-section.active');
    if (!active) return;
    let id = active.id;
    // 只刷新当前可见页面
    switch (id) {
      case 'dashboard-section': loadDashboard(); break;
      case 'room-list-container':
        let expanded = expandedRoom;
        loadRooms().then(() => {
          if (expanded) {
            let card = document.querySelector('.room-card[data-room="' + expanded.replace(/"/g, '') + '"]');
            if (card) {
              let detail = card.querySelector(".room-detail");
              let arrow = card.querySelector(".arrow");
              detail.classList.add("open");
              arrow.classList.add("open");
              loadRoomDetail(detail, expanded);
            }
          }
        });
        break;
      case 'global-users-section': loadGlobalUsers(); break;
      case 'banned-users-section': loadBannedList(); break;
      case 'ip-banned-section': loadIpBannedList(); break;
      case 'history-users-section': loadHistoryUsers(); break;
      case 'global-blacklist-section': loadGlobalBlacklist(); break;
      case 'points-section': loadPointsSection(); break;
      case 'shop-section': loadShopSection(); break;
      case 'task-section': loadTaskSection(); break;
      case 'ip-group-section': loadIpGroup(); break;
    case 'admin-key-section': loadAdminKeyInfo(); break;
      case 'user-tags-section': loadUserTags(); break;
      case 'lottery-section': loadLotteryPools(); break;
      case 'send-message-section': loadSendMessageSection(); break;
    }
  }, 10000);
}

// 抽奖管理函数
async function loadLotteryPools() {
  let container = document.getElementById("lottery-pools-container");
  if (!container) return;
  try {
    let r = await fetch("/api/admin/lottery/pools?key=" + encodeURIComponent(adminKey));
    let data = await r.json();
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#888;padding:20px">暂无奖池</div>';
      return;
    }
    container.innerHTML = data.map(function(pool) {
      return '<div class="lottery-pool-card" style="border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:12px;background:var(--card-bg,#fff)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        + '<div><strong>' + pool.name + '</strong> <span style="color:#888;font-size:90%">(' + (pool.enabled ? "启用" : "禁用") + ')</span></div>'
        + '<div style="display:flex;gap:4px">'
        + '<button class="btn-primary" onclick="showEditPoolForm(\'' + pool.id + '\',\'' + (pool.name||"").replace(/'/g,"") + '\',\'' + (pool.description||"").replace(/'/g,"") + '\',' + pool.cost + ')" style="padding:4px 10px;font-size:12px">编辑</button>'
        + '<button class="btn-primary" onclick="toggleLotteryPool(\'' + pool.id + '\')" style="padding:4px 10px;font-size:12px">' + (pool.enabled ? "禁用" : "启用") + '</button>'
        + '<button class="btn-danger" onclick="deleteLotteryPool(\'' + pool.id + '\')" style="padding:4px 10px;font-size:12px">删除</button>'
        + '</div></div>'
        + '<div style="font-size:13px;color:#666;margin-bottom:6px">' + (pool.description || "") + ' | 每次 ' + pool.cost + ' 积分</div>'
        + '<div style="font-size:13px;margin-bottom:6px">奖品: </div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">'
        + (pool.prizes || []).map(function(pr) {
            return '<span style="display:inline-block;background:#f0f0f0;border-radius:4px;padding:2px 8px;font-size:12px">' + pr.name + ' (' + pr.stock + '/' + pr.initialStock + ') '
              + '<a href="#" onclick="deletePrize(\'' + pool.id + '\',\'' + pr.id + '\');return false" style="color:#c00;text-decoration:none">x</a>'
              + '<a href="#" onclick="restockPrize(\'' + pool.id + '\',\'' + pr.id + '\');return false" style="color:#28a745;text-decoration:none;margin-left:4px">补</a>'
              + '</span>';
          }).join("")
        + '<button class="btn-primary" onclick="showAddPrizeForm(\'' + pool.id + '\')" style="padding:2px 8px;font-size:11px">+ 添加奖品</button>'
        + '</div></div>';
    }).join("");
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;color:#c00;padding:20px">加载失败: ' + e.message + '</div>';
  }
}

function showAddPoolForm() {
  document.getElementById("lottery-pool-modal-title").textContent = "新建奖池";
  document.getElementById("lp-name").value = "";
  document.getElementById("lp-desc").value = "";
  document.getElementById("lp-cost").value = "100";
  document.getElementById("lp-edit-id").value = "";
  document.getElementById("lottery-pool-modal").style.display = "block";
}

function showEditPoolForm(id, name, desc, cost) {
  document.getElementById("lottery-pool-modal-title").textContent = "编辑奖池";
  document.getElementById("lp-name").value = name;
  document.getElementById("lp-desc").value = desc;
  document.getElementById("lp-cost").value = cost;
  document.getElementById("lp-edit-id").value = id;
  document.getElementById("lottery-pool-modal").style.display = "block";
}

function closeLotteryPoolModal() {
  document.getElementById("lottery-pool-modal").style.display = "none";
}

async function saveLotteryPool() {
  let id = document.getElementById("lp-edit-id").value;
  let name = document.getElementById("lp-name").value.trim();
  if (!name) { alert("请输入奖池名称"); return; }
  let desc = document.getElementById("lp-desc").value.trim();
  let cost = document.getElementById("lp-cost").value;
  let url = id
    ? "/api/admin/lottery/pool/update?key=" + encodeURIComponent(adminKey)
    : "/api/admin/lottery/pool/create?key=" + encodeURIComponent(adminKey);
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

async function toggleLotteryPool(id) {
  try {
    let r = await fetch("/api/admin/lottery/pool/toggle?key=" + encodeURIComponent(adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("操作失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

async function deleteLotteryPool(id) {
  if (!confirm("确定删除此奖池？")) return;
  try {
    let r = await fetch("/api/admin/lottery/pool/delete?key=" + encodeURIComponent(adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("删除失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

function showAddPrizeForm(poolId) {
  document.getElementById("lottery-prize-modal-title").textContent = "管理奖品";
  document.getElementById("lpr-name").value = "";
  document.getElementById("lpr-prob").value = "10";
  document.getElementById("lpr-stock").value = "10";
  document.getElementById("lpr-tag").value = "";
  document.getElementById("lpr-color").value = "";
  document.getElementById("lpr-pool-id").value = poolId;
  document.getElementById("lottery-prize-modal").style.display = "block";
}

function closeLotteryPrizeModal() {
  document.getElementById("lottery-prize-modal").style.display = "none";
}

async function addLotteryPrize() {
  let poolId = document.getElementById("lpr-pool-id").value;
  let name = document.getElementById("lpr-name").value.trim();
  if (!name) { alert("请输入奖品名称"); return; }
  let probability = parseFloat(document.getElementById("lpr-prob").value) || 0;
  let stock = parseInt(document.getElementById("lpr-stock").value) || 0;
  let tag = document.getElementById("lpr-tag").value.trim();
  let color = document.getElementById("lpr-color").value.trim();
  try {
    let r = await fetch("/api/admin/lottery/prize/create?key=" + encodeURIComponent(adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({poolId, name, probability, stock, tag, color})});
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

async function deletePrize(poolId, prizeId) {
  if (!confirm("确定删除此奖品？")) return;
  try {
    let r = await fetch("/api/admin/lottery/prize/delete?key=" + encodeURIComponent(adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({poolId, prizeId})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("删除失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

async function restockPrize(poolId, prizeId) {
  try {
    let r = await fetch("/api/admin/lottery/prize/restock?key=" + encodeURIComponent(adminKey), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({poolId, prizeId})});
    let data = await r.json();
    if (data.ok) loadLotteryPools();
    else alert("补货失败: " + (data.error || "未知错误"));
  } catch (e) {
    alert("补货失败: " + e.message);
  }
}

function addBorderSelects() {
  document.querySelectorAll('.tag-color-select').forEach(function(sel) {
    if (sel.nextElementSibling && sel.nextElementSibling.classList.contains('tag-border-select')) return;
    var bs = document.createElement('select');
    bs.className = 'tag-border-select';
    bs.style.cssText = 'width:60px;padding:2px 4px;font-size:80%;border:1px solid #ccc;border-radius:3px;margin-left:2px;vertical-align:middle;';
    var o = document.createElement('option'); o.value = ''; o.textContent = '无'; bs.appendChild(o);
    for (var k in TAG_COLORS) {
      var o2 = document.createElement('option');
      o2.value = k; o2.textContent = k;
      o2.style.background = TAG_COLORS[k];
      o2.style.color = ['yellow','lime','gold','amber','rose','gray','coral','turquoise'].indexOf(k) >= 0 ? '#333' : '#fff';
      bs.appendChild(o2);
    }
    sel.parentNode.insertBefore(bs, sel.nextSibling);
  });
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
// 颜色选择器实时预览
const LIGHT_COLORS = new Set(['yellow','lime','gold','amber','rose','gray','coral','turquoise']);
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('tag-color-select')) {
    const sel = e.target;
    const val = sel.value;
    if (val && TAG_COLORS[val]) {
      sel.style.background = TAG_COLORS[val];
      sel.style.color = LIGHT_COLORS.has(val) ? '#333' : '#fff';
    } else {
      sel.style.background = '';
      sel.style.color = '';
    }
  }
});

// 发送消息
document.addEventListener("click", function(e) {
  if (e.target.id === "sm-send-btn") sendMessage();
});
document.addEventListener("keydown", function(e) {
  if (e.target.id === "sm-text" && e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
  // 房间快捷消息 Enter 发送
  if (e.target.id && e.target.id.startsWith("qmsg-input-") && e.key === "Enter") {
    e.preventDefault();
    let room = e.target.id.replace("qmsg-input-", "");
    quickSendMessage(room);
  }
});

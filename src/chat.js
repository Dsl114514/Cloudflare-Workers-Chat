console.log("[DEBUG] Chat script loaded");
let currentWebSocket = null;
let currentRelayId = null;
let selectedColor = localStorage.getItem("chat_color") || "#000000";

let nameForm = document.querySelector("#name-form");
let roomForm = document.querySelector("#room-form");
let roomNameInput = document.querySelector("#room-name");
let goPublicButton = document.querySelector("#go-public");
let goPrivateButton = document.querySelector("#go-private");
let chatroom = document.querySelector("#chatroom");
let chatlog = document.querySelector("#chatlog");
let chatInput = document.querySelector("#chat-input");
let roster = document.querySelector("#roster");

let isAtBottom = true;

let username;
let roomname;
let roomListInterval = null;

let blockedUsers = new Set();
function loadBlockedUsers() {
  try { blockedUsers = new Set(JSON.parse(localStorage.getItem("chat_blocked") || "[]")); } catch (e) { blockedUsers = new Set(); }
}
function saveBlockedUsers() {
  localStorage.setItem("chat_blocked", JSON.stringify([...blockedUsers]));
}
loadBlockedUsers();
window.addEventListener("storage", (e) => { if (e.key === "chat_blocked") loadBlockedUsers(); });

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

function getVipLevel(tag) {
  if (!tag) return null;
  var m = tag.match(/^[Vv][Ii][Pp](\d+)$/);
  if (m) {
    var n = parseInt(m[1], 10);
    if (n >= 1 && n <= 10) return { id: "vip" + n, tier: n, label: "VIP" + n };
  }
  var lower = tag.toLowerCase();
  if (lower === "vip+") return { id: "vip+", tier: 11, label: "VIP+" };
  if (lower === "mvp")  return { id: "mvp",  tier: 12, label: "MVP" };
  return null;
}
function getVipColor(vip) {
  if (!vip) return null;
  if (vip.tier <= 3) return "#e67e22";
  if (vip.tier <= 6) return "#3498db";
  if (vip.tier <= 9) return "#9b59b6";
  if (vip.tier === 10) return "#e74c3c";
  return "#f1c40f";
}
function createVipBadge(vip) {
  if (!vip) return null;
  var badge = document.createElement("span");
  badge.className = "vip-badge";
  badge.textContent = vip.label;
  var c = getVipColor(vip);
  if (c) badge.style.background = c;
  badge.title = vip.label + " 用户";
  return badge;
}

let hostname = window.location.host;
if (hostname == "") {
  hostname = "edge-chat-demo.cloudflareworkers.com";
}

function startNameChooser() {
  console.log("[DEBUG] startNameChooser() called");
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      let target = tab.dataset.tab;
      document.querySelector("#auth-login").style.display = target === "login" ? "block" : "none";
      document.querySelector("#auth-register").style.display = target === "register" ? "block" : "none";
      document.querySelector("#login-error").textContent = "";
      document.querySelector("#register-error").textContent = "";
    });
  });

  document.querySelector("#login-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("[DEBUG] Login button clicked");
    let name = document.querySelector("#login-name").value.trim();
    let password = document.querySelector("#login-password").value;
    let errEl = document.querySelector("#login-error");
    errEl.textContent = "";
    errEl.style.display = "none";
    if (!name || !password) { errEl.textContent = "请填写用户名和密码"; errEl.style.display = "block"; return; }
    try {
      let r = await fetch("/api/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name, password})});
      let data = await r.json();
      if (data.ok) {
        username = data.name;
        localStorage.setItem("chat_token", data.token);
        localStorage.setItem("chat_user", data.name);
        startRoomList();
      } else {
        errEl.textContent = data.error || "登录失败";
        errEl.style.display = "block";
      }
    } catch (e) {
      errEl.textContent = "网络错误: " + e.message;
      errEl.style.display = "block";
    }
  });

  document.querySelector("#register-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    let name = document.querySelector("#register-name").value.trim();
    let password = document.querySelector("#register-password").value;
    let errEl = document.querySelector("#register-error");
    errEl.textContent = "";
    errEl.style.display = "none";
    if (!name || !password) { errEl.textContent = "请填写用户名和密码"; errEl.style.display = "block"; return; }
    if (password.length < 6) { errEl.textContent = "密码至少6个字符"; errEl.style.display = "block"; return; }
    try {
      let r = await fetch("/api/register", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name, password})});
      let data = await r.json();
      if (data.ok) {
        errEl.textContent = "";
        errEl.style.display = "none";
        let r2 = await fetch("/api/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name, password})});
        let data2 = await r2.json();
        if (data2.ok) {
          username = data2.name;
          localStorage.setItem("chat_token", data2.token);
          localStorage.setItem("chat_user", data2.name);
          startRoomList();
        }
      } else {
        errEl.textContent = data.error || "注册失败";
        errEl.style.display = "block";
      }
    } catch (e) {
      errEl.textContent = "网络错误: " + e.message;
      errEl.style.display = "block";
    }
  });

  document.querySelector("#skip-auth").addEventListener("click", (e) => {
    e.preventDefault();
    let name = document.querySelector("#login-name").value.trim() || "游客" + Math.floor(Math.random() * 10000);
    username = name;
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_user");
    startRoomList();
  });

  document.querySelector("#login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.querySelector("#login-btn").click(); }
  });
  document.querySelector("#login-name").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.querySelector("#login-btn").click(); }
  });

  document.querySelector("#register-password").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.querySelector("#register-btn").click(); }
  });
  document.querySelector("#register-name").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.querySelector("#register-btn").click(); }
  });

  document.querySelector("#login-name").focus();
}

function startRoomList() {
  nameForm.style.display = "none";
  document.querySelector("#room-list-form").style.display = "block";

  let msgRefId = null;
  if (document.location.hash.length > 1) {
    let hashMatch = document.location.hash.match(/^#([^:]+):(\d+)$/);
    if (hashMatch) {
      roomname = hashMatch[1];
      msgRefId = hashMatch[2];
    } else {
      roomname = document.location.hash.slice(1);
    }
    startChat();
    if (msgRefId) {
      let scrollTimer = setInterval(() => {
        let target = chatlog.querySelector('[data-msg-id="' + msgRefId + '"]');
        if (target) {
          target.scrollIntoView({behavior: "smooth", block: "center"});
          target.classList.add("msg-ref-highlight");
          setTimeout(() => target.classList.remove("msg-ref-highlight"), 3000);
          clearInterval(scrollTimer);
        }
      }, 200);
      setTimeout(() => clearInterval(scrollTimer), 15000);
    }
    return;
  }

  roomNameInput.addEventListener("input", event => {
    if (event.currentTarget.value.length > 32) {
      event.currentTarget.value = event.currentTarget.value.slice(0, 32);
    }
  });

  goPublicButton.addEventListener("click", event => {
    roomname = roomNameInput.value;
    if (roomname.length > 0) {
      startChat();
    }
  });

  goPrivateButton.addEventListener("click", async event => {
    roomNameInput.disabled = true;
    goPublicButton.disabled = true;
    event.currentTarget.disabled = true;

    let response = await fetch("https://" + hostname + "/api/room", {method: "POST"});
    if (!response.ok) {
      alert("出现错误");
      document.location.reload();
      return;
    }

    roomname = await response.text();
    startChat();
  });

  roomNameInput.focus();

  roomNameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      roomname = roomNameInput.value;
      if (roomname.length > 0) {
        startChat();
      }
    }
  });

  loadRoomList();
  roomListInterval = setInterval(loadRoomList, 5000);
}

async function loadRoomList() {
  let container = document.querySelector("#room-list");
  container.innerHTML = '<div id="room-list-loading">加载中...</div>';

  try {
    let response = await fetch("/api/rooms/list");
    if (!response.ok) throw new Error("请求失败");
    let rooms = await response.json();
    let entries = Object.entries(rooms);

    if (entries.length === 0) {
      container.innerHTML = '<div id="room-list-empty">暂无公开房间</div>';
      return;
    }

    container.innerHTML = "";
    entries.forEach(([name, count]) => {
      let div = document.createElement("div");
      div.className = "room-item";
      div.innerHTML = '<span class="room-name">#' + name + '</span><span class="room-count">' + count + ' 在线</span>';
      div.addEventListener("click", () => {
        roomname = name;
        startChat();
      });
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<div id="room-list-error">加载房间列表失败</div>';
  }
}

function startChat() {
  if (window._chatStarted) return;
  window._chatStarted = true;

  if (roomListInterval) {
    clearInterval(roomListInterval);
    roomListInterval = null;
  }
  if (roomForm) roomForm.remove();
  document.querySelector("#room-list-form").style.display = "none";

  roomname = roomname.replace(/[^a-zA-Z0-9_-]/g, "").replace(/_/g, "-").toLowerCase();

  if (roomname.length > 32 && !roomname.match(/^[0-9a-f]{64}$/)) {
    addChatMessage("错误", "无效的房间名称。");
    return;
  }

  document.location.hash = "#" + roomname;

  chatInput.addEventListener("keydown", event => {
    let md = document.querySelector("#mention-dropdown");
    if (md && md.classList.contains("show")) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        let items = md.querySelectorAll(".mention-item");
        let active = md.querySelector(".mention-item.active");
        let idx = Array.from(items).indexOf(active);
        if (active) active.classList.remove("active");
        idx = Math.min(idx + 1, items.length - 1);
        if (items[idx]) { items[idx].classList.add("active"); items[idx].scrollIntoView({block: "nearest"}); }
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        let items = md.querySelectorAll(".mention-item");
        let active = md.querySelector(".mention-item.active");
        let idx = Array.from(items).indexOf(active);
        if (active) active.classList.remove("active");
        idx = Math.max(idx - 1, 0);
        if (items[idx]) { items[idx].classList.add("active"); items[idx].scrollIntoView({block: "nearest"}); }
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        let active = md.querySelector(".mention-item.active");
        if (active && active.dataset.name) insertMention(active.dataset.name);
        else hideMentionDropdown();
        return;
      }
      if (event.key === "Escape") {
        hideMentionDropdown();
        event.preventDefault();
        return;
      }
    }
    if (event.keyCode == 38) {
      chatlog.scrollBy(0, -50);
    } else if (event.keyCode == 40) {
      chatlog.scrollBy(0, 50);
    } else if (event.keyCode == 33) {
      chatlog.scrollBy(0, -chatlog.clientHeight + 50);
    } else if (event.keyCode == 34) {
      chatlog.scrollBy(0, chatlog.clientHeight - 50);
    }
  });
  chatInput.addEventListener("input", event => {
    if (event.currentTarget.value.length > 256) {
      event.currentTarget.value = event.currentTarget.value.slice(0, 256);
    }
    if (event.currentTarget.value.trim()) sendTyping();
  });

  chatroom.addEventListener("submit", event => {
    event.preventDefault();

    if (currentWebSocket) {
      let text = chatInput.value;
      chatInput.value = "";

      if (text.startsWith("/")) {
        handleCommand(text);
        return;
      }

      let msg = {message: text, color: selectedColor};
      if (replyTarget) {
        msg.reply = {name: replyTarget, text: replyText || ""};
        cancelReply();
      }
      currentWebSocket.send(JSON.stringify(msg));

      chatlog.scrollBy(0, 1e8);
    }
  });

  document.getElementById("announcement-dismiss").addEventListener("click", () => {
    document.getElementById("announcement-banner").style.display = "none";
  });

  chatlog.addEventListener("scroll", event => {
    isAtBottom = chatlog.scrollTop + chatlog.clientHeight >= chatlog.scrollHeight - 60;
    let sbBtn = document.querySelector("#scroll-bottom-btn");
    if (sbBtn) sbBtn.classList.toggle("show", !isAtBottom);
  });

  document.querySelector("#scroll-bottom-btn").addEventListener("click", () => {
    chatlog.scrollBy(0, 1e8);
  });

  chatInput.focus();
  document.body.addEventListener("click", event => {
    if (window.getSelection().toString() == "") {
      chatInput.focus();
    }
  });

  if('visualViewport' in window) {
    window.visualViewport.addEventListener('resize', function(event) {
      if (isAtBottom) {
        chatlog.scrollBy(0, 1e8);
      }
    });
  }

  let rosterToggle = document.querySelector("#roster-toggle");
  let rosterBackdrop = document.querySelector("#roster-backdrop");
  let rosterPanel = document.querySelector("#roster");
  function hideRoster() {
    rosterPanel.classList.remove("show");
    rosterBackdrop.classList.remove("show");
  }
  rosterToggle.addEventListener("click", event => {
    event.stopPropagation();
    rosterPanel.classList.toggle("show");
    rosterBackdrop.classList.toggle("show");
  });
  rosterBackdrop.addEventListener("click", hideRoster);
  document.body.addEventListener("click", event => {
    if (!rosterPanel.contains(event.target) && !rosterToggle.contains(event.target)) {
      hideRoster();
    }
  });

  async function compressAndSendImage(file) {
    if (!file || !currentWebSocket) return;
    showUploadProgress(0, "正在处理图片...");
    let img = await createImageBitmap(file);
    let maxSize = 800;
    let w = img.width, h = img.height;
    if (w > maxSize || h > maxSize) {
      if (w > h) { h = h * maxSize / w; w = maxSize; }
      else { w = w * maxSize / h; h = maxSize; }
    }
    let canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    let base64 = canvas.toDataURL("image/jpeg", 0.7);
    img.close();
    let imgMsg = {type: "image", data: base64};
    if (replyTarget) {
      imgMsg.reply = {name: replyTarget, text: replyText || ""};
      cancelReply();
    }
    currentWebSocket.send(JSON.stringify(imgMsg));
    hideUploadProgress();
  }

  let imagePicker = document.querySelector("#image-picker");
  document.querySelector("#image-btn").addEventListener("click", () => {
    imagePicker.click();
  });
  imagePicker.addEventListener("change", async () => {
    let file = imagePicker.files[0];
    if (!file || !currentWebSocket) return;
    await compressAndSendImage(file);
    imagePicker.value = "";
  });

  document.querySelector("#schedule-btn").addEventListener("click", () => {
    let msg = prompt("输入定时发送的消息：");
    if (!msg || !msg.trim()) return;
    let minutes = prompt("多少分钟后发送？（1-10080，即7天内）", "5");
    if (!minutes || isNaN(minutes) || minutes < 1 || minutes > 10080) {
      addChatMessage(null, "* 时间范围：1分钟 - 7天");
      return;
    }
    let delayMs = parseInt(minutes) * 60 * 1000;
    let scheduleTime = Date.now() + delayMs;
    if (currentWebSocket) {
      currentWebSocket.send(JSON.stringify({type: "schedule", message: msg.trim(), time: scheduleTime}));
      addChatMessage(null, "* 消息已定时，将在 " + minutes + " 分钟后发送");
    }
  });

  document.querySelector("#poll-btn").addEventListener("click", () => {
    let question = prompt("输入投票问题：");
    if (!question || !question.trim()) return;
    let options = [];
    for (let i = 1; i <= 5; i++) {
      let opt = prompt("选项 " + i + "（留空结束）：");
      if (!opt) break;
      options.push(opt.trim());
    }
    if (options.length < 2) { addChatMessage(null, "* 投票至少需要2个选项"); return; }
    if (currentWebSocket) {
      currentWebSocket.send(JSON.stringify({type: "poll-create", question: question.trim(), options}));
      addChatMessage(null, "* 投票已创建");
    }
  });

  chatInput.addEventListener("paste", async (e) => {
    let items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        let file = item.getAsFile();
        if (file) await compressAndSendImage(file);
        break;
      }
    }
  });

  let filePicker = document.querySelector("#file-picker");
  document.querySelector("#file-btn").addEventListener("click", () => {
    filePicker.click();
  });
  function showUploadProgress(pct, statusText) {
    let bar = document.getElementById("upload-progress");
    let fill = document.getElementById("upload-progress-bar");
    let st = document.getElementById("upload-status");
    bar.style.display = "block";
    fill.style.width = Math.min(100, pct) + "%";
    st.style.display = "block";
    st.textContent = statusText || "";
  }
  function hideUploadProgress() {
    setTimeout(() => {
      document.getElementById("upload-progress").style.display = "none";
      document.getElementById("upload-status").style.display = "none";
    }, 500);
  }
  filePicker.addEventListener("change", async () => {
    let file = filePicker.files[0];
    if (!file || !currentWebSocket) return;

    if (file.size > 15 * 1024 * 1024) {
      addChatMessage(null, "* 文件过大，上限 15MB");
      filePicker.value = "";
      return;
    }

    let reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        let pct = Math.round((e.loaded / e.total) * 100);
        showUploadProgress(pct, "正在读取文件... " + pct + "%");
      }
    };
    reader.onload = () => {
      showUploadProgress(100, "正在上传...");
      let base64 = reader.result;
      let fileMsg = {
        type: "file",
        data: base64,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size
      };
      if (replyTarget) {
        fileMsg.reply = {name: replyTarget, text: replyText || ""};
        cancelReply();
      }
      currentWebSocket.send(JSON.stringify(fileMsg));
      hideUploadProgress();
      filePicker.value = "";
    };
    reader.onerror = () => {
      addChatMessage(null, "* 文件读取失败");
      hideUploadProgress();
      filePicker.value = "";
    };
    reader.readAsDataURL(file);
  });

  let mentionDropdown = document.querySelector("#mention-dropdown");
  let mentionUsers = [];
  let mentionQuery = "";

  function showMentionDropdown(query) {
    mentionQuery = query;
    mentionUsers = [];
    roster.querySelectorAll("[data-name]").forEach(el => {
      let n = el.dataset.name;
      if (n && n.toLowerCase().includes(query.toLowerCase())) mentionUsers.push(n);
    });
    mentionUsers = [...new Set(mentionUsers)].filter(n => n !== username);
    if (mentionUsers.length === 0) { hideMentionDropdown(); return; }

    mentionDropdown.innerHTML = "";
    mentionUsers.forEach((name, i) => {
      let item = document.createElement("div");
      item.className = "mention-item" + (i === 0 ? " active" : "");
      item.dataset.name = name;
      let rosterEl = roster.querySelector('[data-name="' + name.replace(/["\\]/g, '') + '"]');
      let tagSpan = rosterEl ? rosterEl.querySelector(".tag") : null;
      if (tagSpan) {
        let clone = tagSpan.cloneNode(true);
        clone.style.position = "static";
        clone.style.display = "inline-block";
        item.appendChild(clone);
      }
      item.appendChild(document.createTextNode(" " + name));
      item.addEventListener("click", () => insertMention(name));
      item.addEventListener("mouseenter", () => {
        mentionDropdown.querySelectorAll(".active").forEach(a => a.classList.remove("active"));
        item.classList.add("active");
      });
      mentionDropdown.appendChild(item);
    });
    mentionDropdown.classList.add("show");
  }

  function hideMentionDropdown() {
    mentionDropdown.classList.remove("show");
    mentionDropdown.innerHTML = "";
    mentionQuery = "";
  }

  function insertMention(name) {
    let val = chatInput.value;
    let pos = chatInput.selectionStart;
    let textBefore = val.substring(0, pos);
    let atIdx = textBefore.lastIndexOf("@");
    if (atIdx >= 0) {
      let beforeAt = val.substring(0, atIdx);
      let afterAt = val.substring(pos);
      chatInput.value = beforeAt + "@" + name + " " + afterAt;
      let newPos = (beforeAt + "@" + name + " ").length;
      chatInput.setSelectionRange(newPos, newPos);
    }
    hideMentionDropdown();
    chatInput.focus();
  }

  chatInput.addEventListener("input", () => {
    let val = chatInput.value;
    let pos = chatInput.selectionStart;
    let textBefore = val.substring(0, pos);
    let atIdx = textBefore.lastIndexOf("@");
    if (atIdx >= 0) {
      if (atIdx === 0 || /\s/.test(textBefore[atIdx - 1])) {
        let afterAt = textBefore.substring(atIdx + 1);
        if (!/\s/.test(afterAt) && afterAt.length <= 20) {
          showMentionDropdown(afterAt);
          return;
        }
      }
    }
    hideMentionDropdown();
  });

  const EMOJIS = [
    "😀", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😋",
    "😎", "😍", "🥰", "😘", "🤗", "🤩", "🤔", "🤨", "😐", "😑",
    "😶", "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫",
    "😴", "😌", "😛", "😜", "😝", "🤤", "😒", "😓", "😔", "😕",
    "🙃", "🤑", "😲", "☹️", "🙁", "😖", "😞", "😟", "😤", "😢",
    "😭", "😦", "😧", "😨", "😩", "🤯", "😬", "😰", "😱", "🥵",
    "🥶", "😳", "🤪", "😵", "😡", "😠", "🤬",
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "🤚",
    "✋", "🖐️", "🖖", "👏", "🙌", "🤲", "🤝", "🙏", "✍️", "💪",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💕",
    "💞", "💓", "💗", "💖", "💘", "💝", "💋", "👀", "🔥", "⭐",
    "🎉", "🎊", "🎈", "🎁", "✨", "🌟", "💡", "📌", "✅", "❌"
  ];
  let emojiPanel = document.querySelector("#emoji-panel");
  EMOJIS.forEach(e => {
    let span = document.createElement("span");
    span.className = "emoji-item";
    span.textContent = e;
    span.title = e;
    span.addEventListener("click", () => {
      if (currentWebSocket) {
        currentWebSocket.send(JSON.stringify({message: e}));
        chatlog.scrollBy(0, 1e8);
      }
      emojiPanel.classList.remove("show");
    });
    emojiPanel.appendChild(span);
  });
  document.querySelector("#emoji-btn").addEventListener("click", event => {
    event.stopPropagation();
    emojiPanel.classList.toggle("show");
  });
  document.body.addEventListener("click", () => {
    emojiPanel.classList.remove("show");
  }, false);
  emojiPanel.addEventListener("click", event => {
    event.stopPropagation();
  });

  join();
}

let lastSeenTimestamp = 0;
let wroteWelcomeMessages = false;

function join() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
  const wss = document.location.protocol === "http:" ? "ws://" : "wss://";
  let ws = new WebSocket(wss + hostname + "/api/room/" + roomname + "/websocket");
  let rejoined = false;
  let startTime = Date.now();

  let rejoin = async () => {
    if (!rejoined) {
      rejoined = true;
      currentWebSocket = null;

      document.getElementById("reconnect-banner").classList.add("show");

      roster.querySelectorAll('[data-name]').forEach(el => el.remove());
      updateRosterCount();

      let timeSinceLastJoin = Date.now() - startTime;
      if (timeSinceLastJoin < 10000) {
        await new Promise(resolve => setTimeout(resolve, 10000 - timeSinceLastJoin));
      }

      join();
    }
  }

  ws.addEventListener("open", event => {
    currentWebSocket = ws;

    document.getElementById("reconnect-banner").classList.remove("show");

    applyRoomBackground(roomname);

    let msg = {name: username};
    let token = localStorage.getItem("chat_token");
    if (token) msg.token = token;
    ws.send(JSON.stringify(msg));
  });

  ws.addEventListener("message", event => {
    let data = JSON.parse(event.data);

    if (data.error) {
      addChatMessage(null, "* 错误: " + data.error);
    } else if (data.system) {
      addChatMessage(null, "* " + data.system);
    } else if (data.joined) {
      let p = document.createElement("p");
      p.dataset.name = data.joined;
      p.style.cursor = "pointer";
      p.title = "点击操作";
      p.addEventListener("click", (e) => {
        e.stopPropagation();
        showUserMenu(data.joined, e.clientX, e.clientY);
      });
      if (data.tag) {
        let badge = document.createElement("span");
        badge.className = "tag";
        badge.textContent = data.tag;
        if (data.tagColor && TAG_COLORS[data.tagColor]) {
          badge.style.backgroundColor = TAG_COLORS[data.tagColor];
        }
        if (data.tagBorder && TAG_COLORS[data.tagBorder]) {
          badge.style.outline = "2px solid " + TAG_COLORS[data.tagBorder];
          badge.style.outlineOffset = "-1px";
        }
        p.appendChild(badge);
        let vb = createVipBadge(getVipLevel(data.tag));
        if (vb) p.appendChild(vb);
        p.appendChild(document.createTextNode(" " + data.joined));
      } else {
        p.textContent = data.joined;
      }
      roster.appendChild(p);
      if (wroteWelcomeMessages) {
        let joinText = "* " + data.joined + " 进入了聊天室";
        if (data.tag) joinText = "* [" + data.tag + "]" + data.joined + " 进入了聊天室";
        addChatMessage(null, joinText);
      }
      updateRosterCount();
    } else if (data.quit) {
      for (let child of roster.children) {
        if ((child.dataset.name || child.innerText) == data.quit) {
          roster.removeChild(child);
          break;
        }
      }
      updateRosterCount();
    } else if (data.kicked) {
      for (let child of roster.children) {
        if ((child.dataset.name || child.innerText) == data.kicked) {
          roster.removeChild(child);
          break;
        }
      }
      addChatMessage(null, "* " + data.kicked + " 已被踢出房间");
      updateRosterCount();
    } else if (data.ready) {
      if (!wroteWelcomeMessages) {
        wroteWelcomeMessages = true;
        updateRosterCount();
        updatePointsDisplay();
        addChatMessage(null,
            "* 这是一个网页聊天室，无需注册即可畅聊。");
        addChatMessage(null,
            "* 提示: 聊天室参与者是互联网上的匿名用户，"
            + "名称未经认证，任何人都可以使用相同名称，请仔细甄别信息；"
            + "请勿随意相信陌生人的链接或与陌生人交易");
        if (roomname.length == 64) {
          addChatMessage(null,
              "* 这是一个私人房间。你可以通过分享URL邀请他人加入。");
        } else {
          addChatMessage(null,
              "* 欢迎来到 #" + roomname + " 房间！打个招呼吧！");
        }
        chatlog.scrollBy(0, 1e8);
      }
    } else if (data.type === "schedule-confirm") {
      addChatMessage(null, "* 定时消息已设置（ID: " + data.id + "）");
    } else if (data.type === "schedule-cancel-confirm") {
      addChatMessage(null, "* 定时消息已取消");
    } else if (data.type === "poll") {
      renderPoll(data);
    } else if (data.type === "poll-update") {
      let pollEl = chatlog.querySelector('[data-poll-id="' + data.pollId + '"]');
      if (pollEl) {
        let resultsEl = pollEl.querySelector(".poll-results");
        if (resultsEl) {
          let total = data.totalVoters || 1;
          resultsEl.innerHTML = "";
          data.options.forEach(opt => {
            let pct = Math.round((opt.count / total) * 100);
            let row = document.createElement("div");
            row.className = "poll-option";
            row.innerHTML = '<span class="poll-opt-text">' + escapeHtml(opt.text) + '</span>'
              + '<span class="poll-opt-count">' + opt.count + '票</span>'
              + '<div class="poll-opt-bar-wrap"><div class="poll-opt-bar" style="width:' + pct + '%"></div></div>';
            resultsEl.appendChild(row);
          });
        }
      }
    } else if (data.type === "announcement") {
      let banner = document.getElementById("announcement-banner");
      let textEl = document.getElementById("announcement-text");
      if (data.text) {
        textEl.textContent = data.text;
        banner.style.display = "flex";
      } else {
        banner.style.display = "none";
      }
    } else if (data.type === "image") {
      if (blockedUsers.has(data.name)) return;
      if (data.timestamp > lastSeenTimestamp) {
        addChatImage(data.name, data.data, data.tag, data.tagColor, data.timestamp, data.tagBorder, data.reply, data.id);
        lastSeenTimestamp = data.timestamp;
        if (data.name !== username) playMsgSound();
        if (data.name && data.name !== username && document.hidden) { unreadCount++; updateTitleUnread(); }
      }
    } else if (data.type === "file") {
      if (blockedUsers.has(data.name)) return;
      if (data.timestamp > lastSeenTimestamp) {
        addChatFile(data.name, data.data, data.fileName, data.fileSize, data.tag, data.tagColor, data.timestamp, data.tagBorder, data.reply, data.id);
        lastSeenTimestamp = data.timestamp;
        checkAtMention(data.fileName || "", data.name);
        if (data.name !== username) playMsgSound();
        if (data.name && data.name !== username && document.hidden) { unreadCount++; updateTitleUnread(); }
      }
    } else if (data.type === "room-cleared") {
      addChatMessage(null, "* 聊天记录已被管理员清空，即将刷新...");
      setTimeout(() => document.location.reload(), 200);
    } else if (data.type === "recalled") {
      let ts = data.timestamp;
      if (ts) {
        let recalledMsgEl = chatlog.querySelector('[data-timestamp="' + ts + '"]');
        if (recalledMsgEl) {
          let bubble = recalledMsgEl.querySelector(".bubble");
          if (bubble) {
            let isOwn = data.name === username;
            bubble.textContent = isOwn ? "你撤回了一条消息" : "消息已撤回";
          }
          let extraBtns = recalledMsgEl.querySelectorAll(".reply-btn, .recall-btn");
          extraBtns.forEach(b => b.remove());
          recalledMsgEl.classList.add("recalled");
        }
      }
    } else if (data.type === "edit") {
      let editEl = chatlog.querySelector('[data-msg-id="' + data.id + '"]');
      if (editEl && !editEl.classList.contains("recalled")) {
        let bubble = editEl.querySelector(".bubble");
        if (bubble) {
          bubble.innerHTML = markdownToHtml(data.message);
          bubble.querySelectorAll("pre").forEach(pre => {
            let copyBtn = document.createElement("button");
            copyBtn.className = "code-copy-btn";
            copyBtn.textContent = "复制";
            pre.style.position = "relative";
            pre.appendChild(copyBtn);
          });
        }
      }
    } else if (data.type === "typing") {
      if (data.name && data.name !== username) {
        showTyping(data.name);
      }
    } else if (data.type === "relay-new") {
      currentRelayId = data.relayId;
      addChatMessage(null, "* [接龙] 主题: " + data.topic + " (发起: " + data.startedBy + ")");
    } else if (data.type === "relay-update") {
      addChatMessage(null, "* [#" + data.entry.number + "] " + data.entry.user + ": " + data.entry.content);
    } else if (data.type === "relay-ended") {
      addChatMessage(null, "* [接龙结束] 共 " + data.totalCount + " 条，由 " + data.endedBy + " 结束");
      currentRelayId = null;
    } else if (data.type === "relay-list-result") {
      if (data.relays && data.relays.length > 0) {
        addChatMessage(null, "* 当前进行中的接龙:");
        data.relays.forEach(r => {
          addChatMessage(null, "*   [" + r.id.slice(0,8) + "] " + r.topic + " - " + r.entryCount + "条 (发起: " + r.startedBy + ")");
        });
      } else {
        addChatMessage(null, "* 当前没有进行中的接龙");
      }
    } else if (data.type === "zifu") {
      if (data.timestamp > lastSeenTimestamp) {
        let isSelf = false;
        let wrapper = document.createElement("p");
        wrapper.className = "chat-msg other";
        let header = document.createElement("span");
        header.className = "msg-header";
        if (data.tag) {
          let badge = document.createElement("span");
          badge.className = "tag";
          badge.textContent = data.tag;
          if (data.tagColor && TAG_COLORS[data.tagColor]) badge.style.backgroundColor = TAG_COLORS[data.tagColor];
          if (data.tagBorder && TAG_COLORS[data.tagBorder]) { badge.style.outline = "2px solid " + TAG_COLORS[data.tagBorder]; badge.style.outlineOffset = "-1px"; }
          header.appendChild(badge);
        }
        header.appendChild(document.createTextNode(" " + (data.name || "BOT")));
        wrapper.appendChild(header);
        let bubble = document.createElement("span");
        bubble.className = "bubble";
        bubble.style.fontFamily = "'Courier New', Consolas, 'Liberation Mono', monospace";
        bubble.style.fontSize = "11px";
        bubble.style.lineHeight = "1.15";
        bubble.style.whiteSpace = "pre";
        bubble.style.maxWidth = "none";
        bubble.textContent = data.message;
        wrapper.appendChild(bubble);
        if (data.timestamp) {
          let ts = document.createElement("span");
          ts.className = "msg-time";
          ts.textContent = formatTime(data.timestamp);
          wrapper.appendChild(ts);
        }
        chatlog.appendChild(wrapper);
        chatlog.scrollBy(0, 1e8);
        lastSeenTimestamp = data.timestamp;
      }
    } else if (data.type === "tag-update") {
      for (let child of roster.children) {
        if ((child.dataset.name || child.innerText) == data.name) {
          let ptsBadge = child.querySelector(".points-badge");
          let ptsText = ptsBadge ? ptsBadge.textContent : null;
          child.innerHTML = "";
          child.dataset.name = data.name;
          if (data.tag) {
            let badge = document.createElement("span");
            badge.className = "tag";
            badge.textContent = data.tag;
            if (data.tagColor && TAG_COLORS[data.tagColor]) {
              badge.style.backgroundColor = TAG_COLORS[data.tagColor];
            }
            if (data.tagBorder && TAG_COLORS[data.tagBorder]) {
              badge.style.outline = "2px solid " + TAG_COLORS[data.tagBorder];
              badge.style.outlineOffset = "-1px";
            }
            child.appendChild(badge);
            let vb = createVipBadge(getVipLevel(data.tag));
            if (vb) child.appendChild(vb);
            child.appendChild(document.createTextNode(" " + data.name));
          } else {
            child.textContent = data.name;
          }
          if (ptsText !== null) {
            let badge = document.createElement("span");
            badge.className = "points-badge";
            badge.textContent = ptsText;
            child.appendChild(badge);
          }
          break;
        }
      }
    } else if (data.type === "whisper") {
      if (data.to) {
        addChatMessage(null, "* 私聊给 " + data.to + ": " + data.message);
      } else {
        if (blockedUsers.has(data.from)) return;
        addToDMCache(data.from, {from: data.from, message: data.message, timestamp: data.timestamp}, false);
        if (dmTarget !== data.from) {
          dmUnread++;
          if (dmUnreadTimer) clearTimeout(dmUnreadTimer);
          dmUnreadTimer = setTimeout(() => { dmUnreadTimer = null; updateDmBadge(); }, 100);
          updateDmBadge();
          flashTitle("💬 " + data.from + " 发来私信");
        }
        let wrapper = document.createElement("p");
        wrapper.className = "chat-msg other whisper";
        wrapper.innerHTML = '<span class="msg-header"><span class="username" style="cursor:pointer"></span></span><span class="bubble">🔒 </span>';
        wrapper.querySelector(".username").textContent = data.from;
        wrapper.querySelector(".bubble").textContent = "🔒 " + data.message;
        wrapper.querySelector(".username").addEventListener("click", (e) => {
          e.stopPropagation();
          showUserMenu(data.from, e.clientX, e.clientY);
        });
        if (data.timestamp) {
          let ts = document.createElement("span");
          ts.className = "msg-time";
          ts.textContent = formatTime(data.timestamp);
          wrapper.appendChild(ts);
        }
        chatlog.appendChild(wrapper);
        chatlog.scrollBy(0, 1e8);
        playMsgSound();
      }
    } else {
      if (blockedUsers.has(data.name)) return;
      if (data.timestamp > lastSeenTimestamp) {
        addChatMessage(data.name, data.message, data.tag, data.tagColor, data.color, data.timestamp, data.reply, data.tagBorder, data.id);
        lastSeenTimestamp = data.timestamp;
        if (!data.name || data.name !== username) playMsgSound();
        if (data.name && data.name !== username && document.hidden) { unreadCount++; updateTitleUnread(); }
      }
    }
  });

  ws.addEventListener("close", event => {
    console.log("WebSocket连接关闭，正在重新连接:", event.code, event.reason);
    if (event.reason === "kicked") {
      addChatMessage(null, "* 你已被踢出房间，即将刷新页面...");
      setTimeout(() => document.location.reload(), 200);
      return;
    }
    rejoin();
  });
  ws.addEventListener("error", event => {
    console.log("WebSocket错误，正在重新连接:", event);
    if (event.reason === "kicked") {
      addChatMessage(null, "* 你已被踢出房间，即将刷新页面...");
      setTimeout(() => document.location.reload(), 200);
      return;
    }
    rejoin();
  });
}

async function modifyOwnTag(currentTag, currentColor) {
  let adminKey = localStorage.getItem("admin_key");
  if (!adminKey) {
    addChatMessage(null, "* 请先登录管理后台（访问 /admin）才能修改标签");
    return;
  }
  let newTag = prompt("输入新标签（留空取消）:", currentTag || "");
  if (newTag === null || !newTag.trim()) return;
  let colorPrompt = "输入颜色（留空为默认）:\n可选: red, blue, green, purple, pink, cyan, gray, orange, yellow, teal, indigo, brown, lime, deeporange, rose, crimson, coral, gold, amber, forest, seagreen, turquoise, steel, royalblue, mediumpurple, darkviolet, chocolate, olive, firebrick, slateblue, darkcyan, mediumseagreen, indianred, cadetblue";
  let newColor = prompt(colorPrompt, currentColor || "");
  if (newColor === null) newColor = "";
  try {
    let url = "/api/admin/tag/set?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(username) + "&tag=" + encodeURIComponent(newTag.trim());
    if (newColor) url += "&color=" + encodeURIComponent(newColor);
    let r = await fetch(url);
    let t = await r.text();
    addChatMessage(null, "* " + t);
  } catch (e) {
    addChatMessage(null, "* 修改标签失败: " + e.message);
  }
}

function formatTime(ts) {
  if (!ts) return "";
  let d = new Date(ts);
  return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}

function renderPoll(data) {
  if (!data || !data.question) return;
  let wrapper = document.createElement("p");
  wrapper.className = "chat-msg other";
  wrapper.dataset.pollId = data.pollId;
  wrapper.dataset.timestamp = data.timestamp || 0;

  let header = document.createElement("span");
  header.className = "msg-header";
  let creatorBadge = document.createElement("span");
  creatorBadge.className = "tag";
  creatorBadge.textContent = "投票";
  creatorBadge.style.backgroundColor = "#9b59b6";
  header.appendChild(creatorBadge);
  header.appendChild(document.createTextNode(" " + (data.creator || "")));
  wrapper.appendChild(header);

  let question = document.createElement("div");
  question.className = "poll-question";
  question.textContent = data.question;
  wrapper.appendChild(question);

  let results = document.createElement("div");
  results.className = "poll-results";
  data.options.forEach((opt, i) => {
    let row = document.createElement("div");
    row.className = "poll-option";
    row.style.cursor = "pointer";
    row.dataset.pollId = data.pollId;
    row.dataset.optIndex = i;
    row.innerHTML = '<span class="poll-opt-text">' + escapeHtml(opt.text) + '</span>';
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentWebSocket) {
        currentWebSocket.send(JSON.stringify({type: "poll-vote", pollId: data.pollId, optionIndex: i}));
      }
    });
    results.appendChild(row);
  });
  wrapper.appendChild(results);

  if (data.timestamp) {
    let ts = document.createElement("span");
    ts.className = "msg-time";
    ts.textContent = formatTime(data.timestamp);
    wrapper.appendChild(ts);
  }

  chatlog.appendChild(wrapper);
  chatlog.scrollBy(0, 1e8);
}

function markdownToHtml(text) {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(\s|^)\*([^*\s][^*]*?)\*(\s|$)/g, '$1<em>$2</em>$3');
  html = html.replace(/https?:\/\/[^\s<"]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
  html = html.replace(/@([\w一-鿿\-_]+)/g, '<span class="mention" data-mention="$1">@$1</span>');
  return html;
}

let originalDocTitle = document.title;
let unreadCount = 0;
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    unreadCount = 0;
    document.title = originalDocTitle;
  }
});
function updateTitleUnread() {
  if (document.hidden && unreadCount > 0) {
    document.title = "(" + unreadCount + ") " + originalDocTitle;
  }
}

function applyRoomBackground(room) {
  let bg = localStorage.getItem("chat_bg_" + room);
  let chatlog = document.querySelector("#chatlog");
  if (!chatlog) return;
  if (!bg || bg === "default") {
    chatlog.style.background = "";
    chatlog.style.backgroundImage = "";
    chatlog.style.backgroundSize = "";
    chatlog.style.backgroundPosition = "";
    return;
  }
  if (bg.startsWith("#") || bg.startsWith("rgb") || /^[a-zA-Z]+$/.test(bg)) {
    chatlog.style.background = bg;
    chatlog.style.backgroundImage = "none";
  } else {
    chatlog.style.backgroundImage = "url(" + bg + ")";
    chatlog.style.backgroundSize = "cover";
    chatlog.style.backgroundPosition = "center";
    chatlog.style.backgroundRepeat = "no-repeat";
    chatlog.style.background = "";
  }
}

function updateRosterCount() {
  let countEl = document.querySelector("#roster-count");
  if (!countEl) return;
  let count = 0;
  for (let i = 0; i < roster.children.length; i++) {
    let child = roster.children[i];
    if (child.dataset && child.dataset.name) count++;
  }
  countEl.textContent = count;
}

function addChatMessage(name, text, tag, tagColor, msgColor, timestamp, reply, tagBorder, msgId) {
  if (!name) {
    let p = document.createElement("p");
    p.className = "system-msg";
    p.textContent = text;
    chatlog.appendChild(p);
    chatlog.scrollBy(0, 1e8);
    return;
  }
  let isSelf = name === username;
  let wrapper = document.createElement("p");
  wrapper.className = "chat-msg" + (isSelf ? " self" : " other");
  if (timestamp) wrapper.dataset.timestamp = timestamp;
  wrapper.dataset.msgName = name || "";
  if (msgId) wrapper.dataset.msgId = msgId;

  let header = document.createElement("span");
  header.className = "msg-header";
  if (tag) {
    let badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = tag;
    if (tagColor && TAG_COLORS[tagColor]) {
      badge.style.backgroundColor = TAG_COLORS[tagColor];
    }
    if (tagBorder && TAG_COLORS[tagBorder]) {
      badge.style.outline = "2px solid " + TAG_COLORS[tagBorder];
      badge.style.outlineOffset = "-1px";
    }
    if (isSelf) {
      badge.style.cursor = "pointer";
      badge.title = "点击修改标签";
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        modifyOwnTag(tag, tagColor);
      });
    }
    header.appendChild(badge);
    let vb = createVipBadge(getVipLevel(tag));
    if (vb) header.appendChild(vb);
  }
  if (!isSelf) {
    let nameSpan = document.createElement("span");
    nameSpan.className = "username";
    nameSpan.textContent = name;
    nameSpan.style.cursor = "pointer";
    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      showUserMenu(name, e.clientX, e.clientY);
    });
    header.appendChild(nameSpan);
  }
  wrapper.appendChild(header);

  if (reply) {
    let quote = document.createElement("div");
    quote.className = "reply-quote";
    let replyLabel = document.createTextNode("回复 @" + (reply.name || "") + ": ");
    quote.appendChild(replyLabel);
    let replyContent = document.createElement("span");
    replyContent.textContent = reply.text || "";
    quote.appendChild(replyContent);
    wrapper.appendChild(quote);
  }

  let bubble = document.createElement("span");
  bubble.className = "bubble";
  if (msgColor && msgColor !== "#000000") bubble.style.color = msgColor;
  bubble.innerHTML = markdownToHtml(text);
  bubble.querySelectorAll("pre").forEach(pre => {
    let copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.textContent = "复制";
    pre.style.position = "relative";
    pre.appendChild(copyBtn);
  });
  bubble.classList.add("copyable");
  bubble.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      let toast = document.createElement("span");
      toast.className = "copy-toast";
      toast.textContent = "已复制";
      bubble.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 1200);
    }).catch(() => {});
  });
  checkAtMention(text, name);
  wrapper.appendChild(bubble);

  if (!isSelf && name) {
    let replyBtn = document.createElement("span");
    replyBtn.className = "reply-btn";
    replyBtn.textContent = "回复";
    replyBtn.style.cssText = "cursor:pointer;font-size:11px;color:#888;margin-left:8px;vertical-align:middle;";
    replyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startReply(name, text);
    });
    wrapper.appendChild(replyBtn);
  }

  if (msgId) {
    let linkBtn = document.createElement("span");
    linkBtn.className = "link-btn";
    linkBtn.textContent = "🔗";
    linkBtn.title = "复制消息链接";
    linkBtn.style.cssText = "cursor:pointer;font-size:11px;color:#888;margin-left:6px;vertical-align:middle;";
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let link = window.location.origin + window.location.pathname + "#" + roomname + ":" + msgId;
      navigator.clipboard.writeText(link).then(() => {
        addChatMessage(null, "* 消息链接已复制");
      }).catch(() => {});
    });
    wrapper.appendChild(linkBtn);
  }

  if (isSelf && timestamp && Date.now() - timestamp < 120000) {
    let editBtn = document.createElement("span");
    editBtn.className = "edit-btn";
    editBtn.textContent = "编辑";
    editBtn.style.cssText = "cursor:pointer;font-size:11px;color:#999;margin-left:6px;vertical-align:middle;";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let bubble = wrapper.querySelector(".bubble");
      let oldHtml = bubble.innerHTML;
      let originalText = text;
      let input = document.createElement("textarea");
      input.value = originalText;
      input.style.cssText = "width:100%;box-sizing:border-box;padding:4px;border:1px solid #ccc;border-radius:4px;font-family:inherit;font-size:inherit;resize:vertical;min-height:36px;";
      bubble.innerHTML = "";
      bubble.appendChild(input);
      let saveBtn = document.createElement("button");
      saveBtn.textContent = "保存";
      saveBtn.style.cssText = "margin-top:4px;padding:2px 10px;background:var(--primary);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;";
      bubble.appendChild(saveBtn);
      let cancelBtn = document.createElement("button");
      cancelBtn.textContent = "取消";
      cancelBtn.style.cssText = "margin-top:4px;margin-left:4px;padding:2px 10px;background:#888;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;";
      bubble.appendChild(cancelBtn);
      input.focus();
      saveBtn.onclick = () => {
        let newText = input.value.trim();
        if (!newText) return;
        if (currentWebSocket) {
          currentWebSocket.send(JSON.stringify({type: "edit", id: msgId, message: newText, timestamp: timestamp}));
        }
      };
      cancelBtn.onclick = () => { bubble.innerHTML = oldHtml; };
    });
    wrapper.appendChild(editBtn);
    let recallBtn = document.createElement("span");
    recallBtn.className = "recall-btn";
    recallBtn.textContent = "撤回";
    recallBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      recallMessage(timestamp);
    });
    wrapper.appendChild(recallBtn);
  }

  if (timestamp) {
    let timeSpan = document.createElement("span");
    timeSpan.className = "msg-time";
    timeSpan.textContent = formatTime(timestamp);
    wrapper.appendChild(timeSpan);
  }

  chatlog.appendChild(wrapper);
  if (!isSelf && name && timestamp) {
    let prev = wrapper.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains("chat-msg") && prev.dataset.msgName === name) {
      wrapper.classList.add("grouped");
    }
  }
  chatlog.scrollBy(0, 1e8);
}

function addChatImage(name, data, tag, tagColor, timestamp, tagBorder, reply, msgId) {
  if (!name) return;
  let isSelf = name === username;
  let wrapper = document.createElement("p");
  wrapper.className = "chat-msg" + (isSelf ? " self" : " other");
  if (timestamp) wrapper.dataset.timestamp = timestamp;
  wrapper.dataset.msgName = name || "";
  if (msgId) wrapper.dataset.msgId = msgId;

  let header = document.createElement("span");
  header.className = "msg-header";
  if (tag) {
    let badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = tag;
    if (tagColor && TAG_COLORS[tagColor]) {
      badge.style.backgroundColor = TAG_COLORS[tagColor];
    }
    if (tagBorder && TAG_COLORS[tagBorder]) {
      badge.style.outline = "2px solid " + TAG_COLORS[tagBorder];
      badge.style.outlineOffset = "-1px";
    }
    if (isSelf) {
      badge.style.cursor = "pointer";
      badge.title = "点击修改标签";
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        modifyOwnTag(tag, tagColor);
      });
    }
    header.appendChild(badge);
    let vb = createVipBadge(getVipLevel(tag));
    if (vb) header.appendChild(vb);
  }
  if (!isSelf) {
    let nameSpan = document.createElement("span");
    nameSpan.className = "username";
    nameSpan.textContent = name;
    nameSpan.style.cursor = "pointer";
    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      showUserMenu(name, e.clientX, e.clientY);
    });
    header.appendChild(nameSpan);
  }
  wrapper.appendChild(header);

  if (reply) {
    let quote = document.createElement("div");
    quote.className = "reply-quote";
    let replyLabel = document.createTextNode("回复 @" + (reply.name || "") + ": ");
    quote.appendChild(replyLabel);
    let replyContent = document.createElement("span");
    replyContent.textContent = reply.text || "";
    quote.appendChild(replyContent);
    wrapper.appendChild(quote);
  }

  let bubble = document.createElement("span");
  bubble.className = "bubble";
  let img = document.createElement("img");
  img.src = data;
  img.alt = "图片";
  img.style.cursor = "pointer";
  img.addEventListener("click", () => showLightbox(data));
  bubble.appendChild(img);
  wrapper.appendChild(bubble);

  if (!isSelf && name) {
    let replyBtn = document.createElement("span");
    replyBtn.textContent = "回复";
    replyBtn.style.cssText = "cursor:pointer;font-size:11px;color:#888;margin-left:8px;vertical-align:middle;";
    replyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startReply(name, "[图片]");
    });
    wrapper.appendChild(replyBtn);
  }

  if (isSelf && timestamp && Date.now() - timestamp < 120000) {
    let recallBtn = document.createElement("span");
    recallBtn.className = "recall-btn";
    recallBtn.textContent = "撤回";
    recallBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      recallMessage(timestamp);
    });
    wrapper.appendChild(recallBtn);
  }

  if (msgId) {
    let linkBtn = document.createElement("span");
    linkBtn.className = "link-btn";
    linkBtn.textContent = "🔗";
    linkBtn.title = "复制消息链接";
    linkBtn.style.cssText = "cursor:pointer;font-size:11px;color:#888;margin-left:6px;vertical-align:middle;";
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let link = window.location.origin + window.location.pathname + "#" + roomname + ":" + msgId;
      navigator.clipboard.writeText(link).then(() => {
        addChatMessage(null, "* 消息链接已复制");
      }).catch(() => {});
    });
    wrapper.appendChild(linkBtn);
  }

  if (timestamp) {
    let timeSpan = document.createElement("span");
    timeSpan.className = "msg-time";
    timeSpan.textContent = formatTime(timestamp);
    wrapper.appendChild(timeSpan);
  }

  chatlog.appendChild(wrapper);
  chatlog.scrollBy(0, 1e8);
}

function addChatFile(name, data, fileName, fileSize, tag, tagColor, timestamp, tagBorder, reply, msgId) {
  if (!name) return;
  let isSelf = name === username;
  let wrapper = document.createElement("p");
  wrapper.className = "chat-msg" + (isSelf ? " self" : " other");
  if (timestamp) wrapper.dataset.timestamp = timestamp;
  wrapper.dataset.msgName = name || "";
  if (msgId) wrapper.dataset.msgId = msgId;

  let header = document.createElement("span");
  header.className = "msg-header";
  if (tag) {
    let badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = tag;
    if (tagColor && TAG_COLORS[tagColor]) {
      badge.style.backgroundColor = TAG_COLORS[tagColor];
    }
    if (tagBorder && TAG_COLORS[tagBorder]) {
      badge.style.outline = "2px solid " + TAG_COLORS[tagBorder];
      badge.style.outlineOffset = "-1px";
    }
    if (isSelf) {
      badge.style.cursor = "pointer";
      badge.title = "点击修改标签";
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        modifyOwnTag(tag, tagColor);
      });
    }
    header.appendChild(badge);
    let vb = createVipBadge(getVipLevel(tag));
    if (vb) header.appendChild(vb);
  }
  if (!isSelf) {
    let nameSpan = document.createElement("span");
    nameSpan.className = "username";
    nameSpan.textContent = name;
    nameSpan.style.cursor = "pointer";
    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      showUserMenu(name, e.clientX, e.clientY);
    });
    header.appendChild(nameSpan);
  }
  wrapper.appendChild(header);

  if (reply) {
    let quote = document.createElement("div");
    quote.className = "reply-quote";
    let replyLabel = document.createTextNode("回复 @" + (reply.name || "") + ": ");
    quote.appendChild(replyLabel);
    let replyContent = document.createElement("span");
    replyContent.textContent = reply.text || "";
    quote.appendChild(replyContent);
    wrapper.appendChild(quote);
  }

  let bubble = document.createElement("span");
  bubble.className = "bubble";

  let a = document.createElement("a");
  a.className = "file-msg";
  a.href = data;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  let icon = document.createElement("span");
  icon.className = "file-icon";
  icon.textContent = "📎";
  a.appendChild(icon);
  let nameSpan = document.createElement("span");
  nameSpan.className = "file-name";
  nameSpan.textContent = fileName;
  a.appendChild(nameSpan);
  if (fileSize) {
    let sizeSpan = document.createElement("span");
    sizeSpan.className = "file-size";
    let sz = fileSize;
    if (sz < 1024) sizeSpan.textContent = sz + " B";
    else if (sz < 1024 * 1024) sizeSpan.textContent = (sz / 1024).toFixed(1) + " KB";
    else sizeSpan.textContent = (sz / (1024 * 1024)).toFixed(1) + " MB";
    a.appendChild(sizeSpan);
  }
  bubble.appendChild(a);
  wrapper.appendChild(bubble);

  if (!isSelf && name) {
    let replyBtn = document.createElement("span");
    replyBtn.textContent = "回复";
    replyBtn.style.cssText = "cursor:pointer;font-size:11px;color:#888;margin-left:8px;vertical-align:middle;";
    replyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startReply(name, "[文件]");
    });
    wrapper.appendChild(replyBtn);
  }

  if (isSelf && timestamp && Date.now() - timestamp < 120000) {
    let recallBtn = document.createElement("span");
    recallBtn.className = "recall-btn";
    recallBtn.textContent = "撤回";
    recallBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      recallMessage(timestamp);
    });
    wrapper.appendChild(recallBtn);
  }

  if (msgId) {
    let linkBtn = document.createElement("span");
    linkBtn.className = "link-btn";
    linkBtn.textContent = "🔗";
    linkBtn.title = "复制消息链接";
    linkBtn.style.cssText = "cursor:pointer;font-size:11px;color:#888;margin-left:6px;vertical-align:middle;";
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let link = window.location.origin + window.location.pathname + "#" + roomname + ":" + msgId;
      navigator.clipboard.writeText(link).then(() => {
        addChatMessage(null, "* 消息链接已复制");
      }).catch(() => {});
    });
    wrapper.appendChild(linkBtn);
  }

  if (timestamp) {
    let timeSpan = document.createElement("span");
    timeSpan.className = "msg-time";
    timeSpan.textContent = formatTime(timestamp);
    wrapper.appendChild(timeSpan);
  }

  chatlog.appendChild(wrapper);
  chatlog.scrollBy(0, 1e8);
}

async function updatePointsDisplay() {
  try {
    let r = await fetch("/api/points/all");
    let data = await r.json();
    if (!data || typeof data !== "object") return;
    for (let child of roster.children) {
      let name = child.dataset.name || child.innerText || "";
      name = name.replace(/[\s]*$/, "").split(" ")[0];
      let pts = data[name];
      if (pts !== undefined) {
        let oldPts = child.querySelector(".points-badge");
        if (oldPts) oldPts.remove();
        let badge = document.createElement("span");
        badge.className = "points-badge";
        badge.textContent = pts;
        child.appendChild(badge);
      }
    }
  } catch (e) {}
}

let menuTargetUser = null;

let dmCache = {};
let dmTarget = null;
let dmUnread = 0;
let dmUnreadTimer = null;

function updateDmBadge() {
  let items = document.querySelectorAll('.user-menu-item[data-action="dm"]');
  items.forEach(el => {
    if (dmUnread > 0) {
      el.innerHTML = '💬 私信 <span class="dm-badge">' + dmUnread + '</span>';
    } else {
      el.innerHTML = '💬 私信';
    }
  });
}

let replyTarget = null;
let replyText = null;

function startReply(name, text) {
  replyTarget = name;
  replyText = text;
  let bar = document.getElementById("reply-bar");
  bar.innerHTML = "";
  let nameSpan = document.createElement("span");
  nameSpan.className = "reply-name";
  nameSpan.textContent = "@" + name;
  bar.appendChild(nameSpan);
  bar.appendChild(document.createTextNode(" " + (text.length > 60 ? text.slice(0, 60) + "..." : text)));
  let cancel = document.createElement("span");
  cancel.className = "reply-cancel";
  cancel.textContent = "取消";
  bar.appendChild(cancel);
  bar.style.display = "block";
  chatInput.focus();
}

function cancelReply() {
  replyTarget = null;
  replyText = null;
  document.getElementById("reply-bar").style.display = "none";
}

let soundMuted = false;

function playMsgSound() {
  if (soundMuted) return;
  try {
    let ctx = new (window.AudioContext || window.webkitAudioContext)();
    let osc = ctx.createOscillator();
    let gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 520;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function playMentionSound() {
  if (soundMuted) return;
  try {
    let ctx = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((freq, i) => {
      let osc = ctx.createOscillator();
      let gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.15);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.15);
    });
  } catch (e) {}
}

async function recallMessage(timestamp) {
  if (!timestamp || !roomname) return;
  try {
    let r = await fetch("/api/recall/" + encodeURIComponent(roomname) + "?timestamp=" + encodeURIComponent(timestamp) + "&name=" + encodeURIComponent(username));
    let text = await r.text();
    if (r.ok) {
      addChatMessage(null, "* 消息已撤回");
    } else {
      addChatMessage(null, "* 撤回失败: " + text);
    }
  } catch (e) {
    addChatMessage(null, "* 撤回失败: " + e.message);
  }
}

let typingTimers = {};
let lastTypingSent = 0;

function sendTyping() {
  if (!currentWebSocket || !username) return;
  let now = Date.now();
  if (now - lastTypingSent < 3000) return;
  lastTypingSent = now;
  currentWebSocket.send(JSON.stringify({type: "typing"}));
}

async function exportChatLog() {
  let fmt = confirm("确定导出为TXT格式？\n取消将导出为JSON格式") ? "txt" : "json";
  try {
    addChatMessage(null, "* 正在导出聊天记录...");
    let r = await fetch("/api/room/" + encodeURIComponent(roomname) + "/export?format=" + fmt);
    if (!r.ok) { addChatMessage(null, "* 导出失败"); return; }
    let blob = await r.blob();
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = "chatlog_" + roomname + "_" + new Date().toISOString().slice(0,10) + "." + fmt;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addChatMessage(null, "* 聊天记录已导出");
  } catch (e) {
    addChatMessage(null, "* 导出失败: " + e.message);
  }
}

function showTyping(name) {
  let el = document.getElementById("typing-indicator");
  if (!el) return;
  el.textContent = name + " 正在输入...";
  el.classList.add("show");
  if (typingTimers[name]) clearTimeout(typingTimers[name]);
  typingTimers[name] = setTimeout(() => {
    let el2 = document.getElementById("typing-indicator");
    if (el2) el2.classList.remove("show");
    delete typingTimers[name];
  }, 2500);
}

let searchResults = [];
let searchIndex = -1;

function toggleSearch() {
  let bar = document.getElementById("search-bar");
  let opened = bar.classList.toggle("show");
  if (opened) {
    document.getElementById("search-input").focus();
    document.getElementById("search-input").value = "";
    searchResults = [];
    searchIndex = -1;
    document.getElementById("search-count").textContent = "";
    clearHighlights();
  }
}

function clearHighlights() {
  document.querySelectorAll(".search-highlight").forEach(el => {
    let parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    }
  });
  document.querySelectorAll(".search-highlight.active").forEach(el => {
    el.classList.remove("active");
  });
}

function doSearch() {
  clearHighlights();
  let query = document.getElementById("search-input").value.trim().toLowerCase();
  if (!query) {
    searchResults = [];
    searchIndex = -1;
    document.getElementById("search-count").textContent = "";
    return;
  }

  searchResults = [];
  let bubbles = chatlog.querySelectorAll(".chat-msg .bubble");
  bubbles.forEach((bubble, idx) => {
    let text = bubble.textContent.toLowerCase();
    if (text.includes(query)) {
      searchResults.push(bubble);
      let html = bubble.innerHTML;
      let re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      bubble.innerHTML = html.replace(re, '<span class="search-highlight">$1</span>');
    }
  });

  if (searchResults.length > 0) {
    searchIndex = 0;
    goToSearchResult(0);
    document.getElementById("search-count").textContent = searchIndex + 1 + "/" + searchResults.length;
  } else {
    searchIndex = -1;
    document.getElementById("search-count").textContent = "无结果";
  }
}

function goToSearchResult(idx) {
  if (searchResults.length === 0 || idx < 0 || idx >= searchResults.length) return;
  document.querySelectorAll(".search-highlight.active").forEach(el => el.classList.remove("active"));
  searchIndex = idx;
  let target = searchResults[idx];
  let activeHighlights = target.querySelectorAll(".search-highlight");
  if (activeHighlights.length > 0) {
    activeHighlights[0].classList.add("active");
  }
  target.closest(".chat-msg").scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("search-count").textContent = (searchIndex + 1) + "/" + searchResults.length;
}

function searchPrev() {
  if (searchResults.length === 0) return;
  let idx = (searchIndex - 1 + searchResults.length) % searchResults.length;
  goToSearchResult(idx);
}

function searchNext() {
  if (searchResults.length === 0) return;
  let idx = (searchIndex + 1) % searchResults.length;
  goToSearchResult(idx);
}

function showLightbox(src) {
  let lb = document.getElementById("lightbox");
  document.getElementById("lightbox-img").src = src;
  lb.classList.add("show");
}

function hideLightbox() {
  document.getElementById("lightbox").classList.remove("show");
}

function showUserMenu(name, x, y) {
  menuTargetUser = name;
  let menu = document.getElementById("user-menu");
  document.getElementById("user-menu-name").textContent = name;

  let hasAdmin = !!localStorage.getItem("admin_key");
  menu.querySelectorAll(".user-menu-item").forEach(el => {
    let a = el.dataset.action;
    if (a === "pay" || a === "at" || a === "dm") {
      el.style.display = "block";
    } else if (a === "block") {
      el.style.display = blockedUsers.has(name) ? "none" : "flex";
    } else if (a === "unblock") {
      el.style.display = blockedUsers.has(name) ? "flex" : "none";
    } else {
      el.style.display = hasAdmin ? "flex" : "none";
    }
  });

  let vw = window.innerWidth, vh = window.innerHeight;
  let mw = 160, mh = 260;
  let left = Math.max(4, Math.min(x, vw - mw - 4));
  let top = Math.max(4, Math.min(y, vh - mh - 4));
  menu.style.left = left + "px";
  menu.style.top = top + "px";
  menu.classList.add("show");
}

function hideUserMenu() {
  document.getElementById("user-menu").classList.remove("show");
  menuTargetUser = null;
}

function handleMenuAction(action) {
  let target = menuTargetUser;
  hideUserMenu();
  if (!target) return;

  switch (action) {
    case "at": {
      let input = document.getElementById("chat-input");
      let cursorPos = input.selectionStart || input.value.length;
      let textBefore = input.value.substring(0, cursorPos);
      let textAfter = input.value.substring(cursorPos);
      input.value = textBefore + "@" + target + " " + textAfter;
      let newPos = cursorPos + target.length + 2;
      input.setSelectionRange(newPos, newPos);
      input.focus();
      break;
    }
    case "dm": {
      if (target === username) { addChatMessage(null, "* 不能给自己发私信"); break; }
      openDM(target);
      break;
    }
    case "kick": {
      let k = localStorage.getItem("admin_key");
      if (!k) { addChatMessage(null, "* 请先登录管理后台才能踢出用户"); return; }
      if (!confirm("确定要踢出「" + target + "」吗？")) return;
      fetch("/api/admin/kick-user/" + encodeURIComponent(roomname) + "?key=" + encodeURIComponent(k) + "&name=" + encodeURIComponent(target))
        .then(r => r.text()).then(t => addChatMessage(null, "* " + t));
      break;
    }
    case "ban": {
      let k = localStorage.getItem("admin_key");
      if (!k) { addChatMessage(null, "* 请先登录管理后台才能封禁用户"); return; }
      if (!confirm("确定要永久封禁「" + target + "」吗？（将同时封禁IP）")) return;
      fetch("/api/admin/global-kick?key=" + encodeURIComponent(k) + "&name=" + encodeURIComponent(target));
      fetch("/api/admin/ban/add?key=" + encodeURIComponent(k) + "&name=" + encodeURIComponent(target))
        .then(r => r.text()).then(t => addChatMessage(null, "* " + t));
      break;
    }
    case "banip": {
      let k = localStorage.getItem("admin_key");
      if (!k) { addChatMessage(null, "* 请先登录管理后台才能封禁IP"); return; }
      if (!confirm("确定要封禁「" + target + "」的IP吗？")) return;
      fetch("/api/admin/user-ips?key=" + encodeURIComponent(k))
        .then(r => r.json())
        .then(ipMap => {
          let ip = ipMap[target];
          if (!ip) { addChatMessage(null, "* 未找到 " + target + " 的IP记录"); return; }
          fetch("/api/admin/ip-ban/add?key=" + encodeURIComponent(k) + "&ip=" + encodeURIComponent(ip))
            .then(r => r.text()).then(t => addChatMessage(null, "* " + t));
        });
      break;
    }
    case "block": {
      blockedUsers.add(target);
      saveBlockedUsers();
      addChatMessage(null, "* 已屏蔽 " + target + " 的消息");
      break;
    }
    case "unblock": {
      blockedUsers.delete(target);
      saveBlockedUsers();
      addChatMessage(null, "* 已取消屏蔽 " + target);
      break;
    }
    case "pay": {
      if (target === username) { addChatMessage(null, "* 不能给自己转账"); return; }
      let amt = prompt("输入要转给「" + target + "」的积分数量：");
      if (!amt || isNaN(amt) || parseInt(amt) <= 0) { addChatMessage(null, "* 已取消或数量无效"); return; }
      fetch("/api/points/transfer?sender=" + encodeURIComponent(username) + "&receiver=" + encodeURIComponent(target) + "&amount=" + parseInt(amt))
        .then(r => r.text()).then(t => { addChatMessage(null, "* " + t); updatePointsDisplay(); });
      break;
    }
    case "tag": {
      let k = localStorage.getItem("admin_key");
      if (!k) { addChatMessage(null, "* 请先登录管理后台才能修改标签"); return; }
      let newTag = prompt("输入「" + target + "」的新标签（留空取消）:");
      if (!newTag || !newTag.trim()) return;
      let newColor = prompt("标签颜色（留空默认）: red/blue/green/purple/pink/cyan/gray/orange");
      let url = "/api/admin/tag/set?key=" + encodeURIComponent(k) + "&name=" + encodeURIComponent(target) + "&tag=" + encodeURIComponent(newTag.trim());
      if (newColor) url += "&color=" + encodeURIComponent(newColor);
      fetch(url).then(r => r.text()).then(t => addChatMessage(null, "* " + t));
      break;
    }
  }
}

function openDM(user) {
  if (user === username) { addChatMessage(null, "* 不能给自己发私信"); return; }
  dmTarget = user;
  document.querySelector("#dm-username").textContent = "私信: " + user;
  document.querySelector("#dm-panel").style.display = "flex";
  renderDMLog(user);
  dmUnread = 0;
  updateDmBadge();
  let inp = document.querySelector("#dm-input");
  if (inp) { inp.focus(); inp.select(); }
}

function closeDM() {
  document.querySelector("#dm-panel").style.display = "none";
  dmTarget = null;
}

function renderDMLog(user) {
  let log = document.querySelector("#dm-log");
  let msgs = dmCache[user] || [];
  if (msgs.length === 0) {
    log.innerHTML = '<div class="dm-system">还没有消息，开始聊天吧</div>';
    return;
  }
  log.innerHTML = '';
  msgs.forEach(m => {
    if (m.divider) {
      let div = document.createElement("div");
      div.className = "dm-divider";
      div.textContent = m.divider;
      log.appendChild(div);
      return;
    }
    if (m.system) {
      let div = document.createElement("div");
      div.className = "dm-system";
      div.textContent = m.system;
      log.appendChild(div);
      return;
    }
    let wrapper = document.createElement("div");
    wrapper.className = "dm-msg" + (m.isSelf ? " dm-self" : " dm-other");
    let textEl = document.createElement("span");
    textEl.className = "dm-msg-text";
    textEl.textContent = m.message;
    let timeEl = document.createElement("span");
    timeEl.className = "dm-msg-time";
    timeEl.textContent = formatTime(m.timestamp);
    wrapper.appendChild(textEl);
    wrapper.appendChild(timeEl);
    log.appendChild(wrapper);
  });
  log.scrollTop = log.scrollHeight;
}

function addToDMCache(user, msg, isSelf) {
  if (!dmCache[user]) dmCache[user] = [];
  dmCache[user].push({...msg, isSelf});
  if (dmTarget === user) renderDMLog(user);
}

function sendDM() {
  let input = document.querySelector("#dm-input");
  let text = input.value.trim();
  if (!text) return;
  if (!dmTarget) { addChatMessage(null, "* 请先选择私信对象"); return; }
  if (!currentWebSocket) { addChatMessage(null, "* 未连接到聊天室"); return; }
  input.value = "";
  currentWebSocket.send(JSON.stringify({type: "whisper", target: dmTarget, message: text}));
  addToDMCache(dmTarget, {from: username, message: text, timestamp: Date.now()}, true);
}

function clearDM(user) {
  if (user && dmCache[user]) {
    delete dmCache[user];
    if (dmTarget === user) renderDMLog(user);
  }
}

document.addEventListener("keydown", function(e) {
  if (e.target && e.target.id === "dm-input" && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendDM();
  }
});

let origTitle = document.title;
let titleInterval = null;

function flashTitle(text) {
  origTitle = document.title;
  if (titleInterval) clearInterval(titleInterval);
  let flash = true;
  titleInterval = setInterval(() => {
    document.title = flash ? text : origTitle;
    flash = !flash;
  }, 800);
  setTimeout(() => {
    if (titleInterval) { clearInterval(titleInterval); titleInterval = null; document.title = origTitle; }
  }, 12000);
  window.addEventListener("focus", () => {
    if (titleInterval) { clearInterval(titleInterval); titleInterval = null; document.title = origTitle; }
  }, { once: true });
}

function checkAtMention(msgText, senderName) {
  if (!msgText || !username) return;
  if (/@everyone\b/i.test(msgText)) {
    playMentionSound();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("@" + senderName + " @了所有人", { body: msgText.length > 80 ? msgText.slice(0, 80) + "..." : msgText });
    }
    flashTitle("@" + senderName + " @了所有人");
    return;
  }
  let re = new RegExp("@(" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i");
  if (re.test(msgText)) {
    playMentionSound();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("@" + senderName + " 提到了你", { body: msgText.length > 80 ? msgText.slice(0, 80) + "..." : msgText });
    }
    flashTitle("@" + senderName + " 提到了你");
  }
}

const ASCII_FONT = {
  A: [".##.", "#..#", "####", "#..#", "#..#"],
  B: ["###.", "#..#", "###.", "#..#", "###."],
  C: [".##.", "#..#", "#...", "#..#", ".##."],
  D: ["###.", "#..#", "#..#", "#..#", "###."],
  E: ["####", "#...", "###.", "#...", "####"],
  F: ["####", "#...", "###.", "#...", "#..."],
  G: [".##.", "#...", "#.##", "#..#", ".##."],
  H: ["#..#", "#..#", "####", "#..#", "#..#"],
  I: ["#####", "..#..", "..#..", "..#..", "#####"],
  J: ["..##.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#..#", "#.#.", "##..", "#.#.", "#..#"],
  L: ["#...", "#...", "#...", "#...", "####"],
  M: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  N: ["#..#", "##.#", "#.##", "#.##", "#..#"],
  O: [".##.", "#..#", "#..#", "#..#", ".##."],
  P: ["###.", "#..#", "###.", "#...", "#..."],
  Q: [".##.", "#..#", "#..#", "#.##", ".##."],
  R: ["###.", "#..#", "###.", "#.#.", "#..#"],
  S: [".##.", "#...", ".##.", "...#", ".##."],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
  U: ["#..#", "#..#", "#..#", "#..#", ".##."],
  V: ["#..#", "#..#", "#..#", ".#.#", "..#.."],
  W: ["#..#", "#..#", "#.##", "##.#", "#..#"],
  X: ["#..#", ".#.#", "..#..", ".#.#", "#..#"],
  Y: ["#..#", ".#.#", "..#..", "..#..", "..#.."],
  Z: ["####", "...#", "..#..", ".#...", "####"],
  "0": [".##.", "#..#", "#..#", "#..#", ".##."],
  "1": ["..#.", ".##.", "..#.", "..#.", "####"],
  "2": [".##.", "#..#", "...#", ".#..", "####"],
  "3": [".##.", "#..#", "..##", "#..#", ".##."],
  "4": ["...#", "..#.", ".#.#", "####", "...#"],
  "5": ["####", "#...", "###.", "...#", "###."],
  "6": [".##.", "#...", "###.", "#..#", ".##."],
  "7": ["####", "...#", "..#.", ".#..", ".#.."],
  "8": [".##.", "#..#", ".##.", "#..#", ".##."],
  "9": [".##.", "#..#", ".###", "...#", ".##."],
  "?": [".##.", "#..#", "..#.", "....", "..#."],
  "!": ["..#.", "..#.", "..#.", "....", "..#."],
  ".": ["....", "....", "....", "....", "..#."],
  " ": [".....", ".....", ".....", ".....", "....."],
};
const ASCII_UNKNOWN_CHAR = ["#####", "#   #", "# # #", "#   #", "#####"];

function generateAsciiArt(text) {
  let unknown = [];
  let lines = ['', '', '', '', ''];
  for (let ch of text) {
    let upper = ch.toUpperCase();
    let letter = ASCII_FONT[upper];
    if (!letter) {
      letter = ASCII_FONT[ch];
    }
    if (!letter) {
      letter = ASCII_UNKNOWN_CHAR;
      unknown.push(ch);
    }
    for (let i = 0; i < 5; i++) {
      lines[i] += (letter[i] || ASCII_UNKNOWN_CHAR[i]) + '  ';
    }
  }
  let result = lines.map(l => l.replace(/\./g, ' ')).join('\n');
  return { art: result, unknown: unknown };
}

function renderTextToAsciiCanvas(text) {
  const GRID_W = 20, GRID_H = 20, GAP = 2;
  const FONT_SIZE = 200;
  const FONT = `bold ${FONT_SIZE}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "SimHei", "Heiti SC", sans-serif`;
  const chars = ' .:-=+*#%@';
  let grids = [];

  for (let ch of text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = FONT;

    const textW = ctx.measureText(ch).width;
    const minW = FONT_SIZE * 0.7;
    canvas.width = Math.ceil(Math.max(textW, minW));
    canvas.height = Math.ceil(FONT_SIZE * 1.15);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(ch, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const totalPixels = canvas.width * canvas.height;

    let charGrid = [];
    for (let row = 0; row < GRID_H; row++) {
      let line = '';
      for (let col = 0; col < GRID_W; col++) {
        const xStart = Math.floor(col * canvas.width / GRID_W);
        const xEnd = Math.floor((col + 1) * canvas.width / GRID_W);
        const yStart = Math.floor(row * canvas.height / GRID_H);
        const yEnd = Math.floor((row + 1) * canvas.height / GRID_H);
        let totalBright = 0;
        let count = 0;
        for (let py = yStart; py < yEnd; py++) {
          for (let px = xStart; px < xEnd; px++) {
            const idx = (py * canvas.width + px) * 4;
            if (idx < 0 || idx + 2 >= totalPixels * 4) continue;
            const b = (pixels[idx] * 0.299 + pixels[idx+1] * 0.587 + pixels[idx+2] * 0.114) / 255;
            totalBright += b;
            count++;
          }
        }
        const avgBright = count > 0 ? totalBright / count : 1;
        const ci = Math.floor((1 - avgBright) * (chars.length - 1));
        line += chars[Math.max(0, Math.min(ci, chars.length - 1))];
      }
      charGrid.push(line);
    }
    grids.push(charGrid);
  }

  let result = grids[0].map((_, row) =>
    grids.map(g => g[row]).join(' '.repeat(GAP))
  ).join('\n');
  return result.replace(/\n[ \n]+$/, '');
}

async function handleCommand(text) {
  let parts = text.split(/\s+/);
  let cmd = parts[0].toLowerCase();
  let arg = parts.slice(1).join(" ");

  switch (cmd) {
    case "/help":
      addChatMessage(null, "* 可用命令: /pay <用户> <数量> 转积分 | /w <用户> <消息> 私聊 | /color <颜色> 字体颜色 | /kick <用户> 踢出 | /ban <用户> 封禁(含IP) | /unban <用户> 解封 | /tag <用户> <标签> [颜色] 设置标签 | /untag <用户> 移除标签 | /clear 清空(需管理) | /clean 本地清屏 | /zifu <文字> 生成字符画 | 发送 @所有人 可@全体成员 | /help 帮助");
      break;

    case "/kick": {
      if (!arg) { addChatMessage(null, "* 用法: /kick <用户名>"); break; }
      let adminKey = localStorage.getItem("admin_key");
      if (!adminKey) { addChatMessage(null, "* 错误: 请先登录管理后台（访问 /admin）"); break; }
      try {
        let r = await fetch("/api/admin/kick-user/" + encodeURIComponent(roomname) + "?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(arg));
        let t = await r.text();
        addChatMessage(null, "* " + t);
      } catch (e) {
        addChatMessage(null, "* 操作失败: " + e.message);
      }
      break;
    }

    case "/ban": {
      if (!arg) { addChatMessage(null, "* 用法: /ban <用户名>"); break; }
      let adminKey = localStorage.getItem("admin_key");
      if (!adminKey) { addChatMessage(null, "* 错误: 请先登录管理后台（访问 /admin）"); break; }
      try {
        await fetch("/api/admin/global-kick?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(arg));
        let r = await fetch("/api/admin/ban/add?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(arg));
        let t = await r.text();
        addChatMessage(null, "* " + t);
      } catch (e) {
        addChatMessage(null, "* 操作失败: " + e.message);
      }
      break;
    }

    case "/unban": {
      if (!arg) { addChatMessage(null, "* 用法: /unban <用户名>"); break; }
      let adminKey = localStorage.getItem("admin_key");
      if (!adminKey) { addChatMessage(null, "* 错误: 请先登录管理后台（访问 /admin）"); break; }
      try {
        let r = await fetch("/api/admin/ban/remove?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(arg));
        let t = await r.text();
        addChatMessage(null, "* " + t);
      } catch (e) {
        addChatMessage(null, "* 操作失败: " + e.message);
      }
      break;
    }

    case "/color": {
      if (!arg) {
        addChatMessage(null, "* 当前字体颜色: " + selectedColor + "（支持颜色名: red/orange/gold/green/cyan/blue/purple/pink/black/white 或 #hex 值）");
        break;
      }
      const colorMap = {
        "red": "#dc3545", "orange": "#e67e22", "gold": "#f1c40f",
        "green": "#28a745", "cyan": "#17a2b8", "blue": "#007bff",
        "purple": "#6f42c1", "pink": "#e83e8c", "black": "#000000",
        "white": "#ffffff", "gray": "#6c757d"
      };
      let newColor = colorMap[arg.toLowerCase()] || arg;
      if (!/^#[0-9a-f]{6}$/i.test(newColor)) {
        addChatMessage(null, "* 无效颜色，可用: red/orange/gold/green/cyan/blue/purple/pink/black/white/gray 或 #hex");
        break;
      }
      selectedColor = newColor;
      localStorage.setItem("chat_color", newColor);
      addChatMessage(null, "* 字体颜色已设置为 " + arg);
      break;
    }

    case "/bg": {
      if (!arg) {
        addChatMessage(null, "* 当前房间背景: " + (localStorage.getItem("chat_bg_" + roomname) || "默认") + "。用法: /bg <颜色/#hex/url> 或 /bg 清除");
        break;
      }
      if (arg === "清除" || arg === "reset" || arg === "default") {
        localStorage.removeItem("chat_bg_" + roomname);
        applyRoomBackground(roomname);
        addChatMessage(null, "* 已清除房间背景");
        break;
      }
      localStorage.setItem("chat_bg_" + roomname, arg);
      applyRoomBackground(roomname);
      addChatMessage(null, "* 已设置房间背景: " + arg);
      break;
    }

    case "/jl": {
      if (!currentWebSocket) { addChatMessage(null, "* 未连接到聊天室"); break; }
      if (!arg) {
        currentWebSocket.send(JSON.stringify({type: "relay-list"}));
        break;
      }
      if (arg === "结束") {
        currentWebSocket.send(JSON.stringify({type: "relay-end", relayId: currentRelayId}));
        break;
      }
      let parts = arg.split(/\s+/);
      let first = parts[0];
      let rest = parts.slice(1).join(" ");
      let num = parseInt(first, 10);
      if (!isNaN(num) && rest) {
        currentWebSocket.send(JSON.stringify({type: "relay-add", relayId: currentRelayId, number: num, content: rest}));
        break;
      }
      if (!isNaN(num) && !rest) {
        addChatMessage(null, "* 用法: /jl <数字> <内容>");
        break;
      }
      currentWebSocket.send(JSON.stringify({type: "relay-create", topic: arg}));
      break;
    }

    case "/draw": {
      let poolName = arg || "default";
      if (!username) { addChatMessage(null, "* 请先登录才能抽奖"); break; }
      try {
        let r = await fetch("/api/lottery/draw", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name: username, pool: poolName})});
        let data = await r.json();
        if (data.ok && data.prize) {
          addChatMessage(null, "* 🎉 恭喜 " + username + " 抽中了: " + data.prize.name + "!");
          if (data.prize.tag) {
            addChatMessage(null, "* 🏷️ 标签 " + data.prize.tag + " 已自动装备！");
          }
        } else {
          addChatMessage(null, "* " + (data.error || "抽奖失败"));
        }
      } catch (e) {
        addChatMessage(null, "* 抽奖失败: " + e.message);
      }
      break;
    }

    case "/pools": {
      try {
        let r = await fetch("/api/lottery/pools");
        let data = await r.json();
        if (data && data.length > 0) {
          addChatMessage(null, "* 可用抽奖池:");
          data.forEach(p => {
            addChatMessage(null, "*   " + p.name + " - 每次 " + p.cost + " 积分 (奖品: " + p.prizes.length + " 种)");
          });
        } else {
          addChatMessage(null, "* 当前没有可用的抽奖池");
        }
      } catch (e) {
        addChatMessage(null, "* 获取奖池失败: " + e.message);
      }
      break;
    }

    case "/pay": {
      let parts = text.split(/\s+/);
      let target = parts[1];
      let amount = parseInt(parts[2], 10);
      if (!target || !amount) { addChatMessage(null, "* 用法: /pay <用户名> <积分数量>"); break; }
      if (amount <= 0) { addChatMessage(null, "* 积分数量必须大于 0"); break; }
      try {
        let r = await fetch("/api/points/transfer?sender=" + encodeURIComponent(username) + "&receiver=" + encodeURIComponent(target) + "&amount=" + amount);
        let t = await r.text();
        addChatMessage(null, "* " + t);
        updatePointsDisplay();
      } catch (e) {
        addChatMessage(null, "* 转账失败: " + e.message);
      }
      break;
    }

    case "/w":
    case "/whisper": {
      let target = parts[1];
      let whisperText = parts.slice(2).join(" ");
      if (!target || !whisperText) { addChatMessage(null, "* 用法: /w <用户名> <消息>"); break; }
      if (!currentWebSocket) { addChatMessage(null, "* 未连接到聊天室"); break; }
      currentWebSocket.send(JSON.stringify({type: "whisper", target: target, message: whisperText}));
      break;
    }

    case "/tag": {
      let parts = text.split(/\s+/);
      let targetUser = parts[1];
      let tagValue = parts[2];
      let tagColor = parts[3] || "";
      if (!targetUser || !tagValue) { addChatMessage(null, "* 用法: /tag <用户名> <标签> [颜色]"); break; }
      let adminKey = localStorage.getItem("admin_key");
      if (!adminKey) { addChatMessage(null, "* 错误: 请先登录管理后台（访问 /admin）"); break; }
      try {
        let url = "/api/admin/tag/set?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(targetUser) + "&tag=" + encodeURIComponent(tagValue);
        if (tagColor) url += "&color=" + encodeURIComponent(tagColor);
        let r = await fetch(url);
        let t = await r.text();
        addChatMessage(null, "* " + t);
      } catch (e) {
        addChatMessage(null, "* 操作失败: " + e.message);
      }
      break;
    }

    case "/untag": {
      let parts = text.split(/\s+/);
      let targetUser = parts[1];
      if (!targetUser) { addChatMessage(null, "* 用法: /untag <用户名>"); break; }
      let adminKey = localStorage.getItem("admin_key");
      if (!adminKey) { addChatMessage(null, "* 错误: 请先登录管理后台（访问 /admin）"); break; }
      try {
        let r = await fetch("/api/admin/tag/remove?key=" + encodeURIComponent(adminKey) + "&name=" + encodeURIComponent(targetUser));
        let t = await r.text();
        addChatMessage(null, "* " + t);
      } catch (e) {
        addChatMessage(null, "* 操作失败: " + e.message);
      }
      break;
    }

    case "/clear": {
      let adminKey = localStorage.getItem("admin_key");
      if (!adminKey) { addChatMessage(null, "* 错误: 请先登录管理后台（访问 /admin）"); break; }
      if (!confirm("确定清空 " + roomname + " 的聊天记录吗？")) break;
      try {
        let r = await fetch("/api/admin/clear-room/" + encodeURIComponent(roomname) + "?key=" + encodeURIComponent(adminKey));
        let t = await r.text();
        addChatMessage(null, "* " + t + " 即将刷新聊天室...");
        setTimeout(() => document.location.reload(), 200);
      } catch (e) {
        addChatMessage(null, "* 操作失败: " + e.message);
      }
      break;
    }

    case "/clean": {
      chatlog.querySelectorAll(".chat-msg, .system-msg").forEach(el => el.remove());
      addChatMessage(null, "* 本地聊天记录已清除");
      break;
    }

    case "/zifu": {
      if (!arg) { addChatMessage(null, "* 用法: /zifu <文字>"); break; }
      if (arg.length > 15) { addChatMessage(null, "* 文字太长，最多15个字符"); break; }
      let art;
      try {
        art = renderTextToAsciiCanvas(arg);
      } catch (e) {
        addChatMessage(null, "* 字符画生成失败: " + e.message);
        break;
      }
      if (currentWebSocket) {
        currentWebSocket.send(JSON.stringify({type: "zifu", message: art}));
      }
      break;
    }

    default:
      addChatMessage(null, "* 未知命令: " + cmd + "，输入 /help 查看可用命令");
  }
}

function getAuthName() {
  return username || localStorage.getItem("chat_username") || "";
}
function getAuthToken() {
  return localStorage.getItem("chat_token") || "";
}
function isAuthenticated() {
  return !!getAuthToken() && !!getAuthName();
}

async function openShop(tab) {
  document.getElementById("shop-overlay").classList.add("show");
  switchShopTab(tab || "buy");
}
function openLottery() {
  document.getElementById("lottery-overlay").classList.add("show");
  loadLotteryPools();
}
function closeLottery() {
  document.getElementById("lottery-overlay").classList.remove("show");
}
async function loadLotteryPools() {
  let body = document.getElementById("lottery-body");
  let loading = document.getElementById("lottery-loading");
  let poolsDiv = document.getElementById("lottery-pools");
  let resultDiv = document.getElementById("lottery-result");
  if (loading) loading.style.display = "block";
  if (poolsDiv) poolsDiv.style.display = "none";
  if (resultDiv) resultDiv.style.display = "none";
  try {
    let r = await fetch("/api/lottery/pools");
    let data = await r.json();
    if (loading) loading.style.display = "none";
    if (!data || data.length === 0) {
      if (poolsDiv) poolsDiv.innerHTML = '<div style="text-align:center;color:#888;padding:40px">暂无可用抽奖池</div>';
      if (poolsDiv) poolsDiv.style.display = "block";
      return;
    }
    let html = data.map(p => '<div class="lottery-pool-card" style="border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:12px;background:var(--card-bg,#fff)">'
      + '<div style="font-weight:600;font-size:16px;margin-bottom:4px">' + p.name + '</div>'
      + '<div style="font-size:13px;color:#666;margin-bottom:8px">' + (p.description || "") + '</div>'
      + '<div style="font-size:13px;margin-bottom:8px">每次 <strong>' + p.cost + '</strong> 积分</div>'
      + '<div style="font-size:12px;color:#888;margin-bottom:10px">奖品: ' + (p.prizes || []).map(pr => pr.name + "(" + pr.stock + "/" + pr.initialStock + ")").join(", ") + '</div>'
      + '<button class="auth-btn" onclick="doDraw(\'' + p.id + '\')" style="padding:6px 20px;font-size:14px">抽一次</button>'
      + '</div>').join("");
    if (poolsDiv) { poolsDiv.innerHTML = html; poolsDiv.style.display = "block"; }
  } catch (e) {
    if (loading) loading.style.display = "none";
    if (poolsDiv) { poolsDiv.innerHTML = '<div style="text-align:center;color:#c00;padding:40px">加载失败: ' + e.message + '</div>'; poolsDiv.style.display = "block"; }
  }
}
async function doDraw(poolId) {
  if (!username) { alert("请先登录"); return; }
  let resultDiv = document.getElementById("lottery-result");
  let poolsDiv = document.getElementById("lottery-pools");
  if (poolsDiv) poolsDiv.style.display = "none";
  if (resultDiv) { resultDiv.style.display = "block"; resultDiv.innerHTML = '<div style="padding:20px;font-size:18px">🎰 抽奖中...</div>'; }
  try {
    let r = await fetch("/api/lottery/draw", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name: username, pool: poolId})});
    let data = await r.json();
    if (data.ok && data.prize) {
      let tagMsg = data.prize.tag ? "<br><span style=\"font-size:14px;color:#888\">🏷️ 标签已自动装备!</span>" : "";
      if (resultDiv) resultDiv.innerHTML = '<div style="padding:20px"><div style="font-size:48px;margin-bottom:12px">🎉</div><div style="font-size:20px;font-weight:600;margin-bottom:8px">恭喜获得:</div><div style="font-size:24px;color:#e67e22">' + data.prize.name + '</div>' + tagMsg + '</div>';
    } else {
      if (resultDiv) resultDiv.innerHTML = '<div style="padding:20px"><div style="font-size:48px;margin-bottom:12px">😅</div><div style="font-size:16px;color:#666">' + (data.error || "抽奖失败") + '</div></div>';
    }
  } catch (e) {
    if (resultDiv) resultDiv.innerHTML = '<div style="padding:20px"><div style="font-size:16px;color:#c00">错误: ' + e.message + '</div></div>';
  }
}

function closeShop() {
  document.getElementById("shop-overlay").classList.remove("show");
}
function switchShopTab(tab) {
  document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t.dataset.shopTab === tab));
  if (tab === "buy") loadShopItems();
  else loadInventory();
}

function updateShopPoints() {
  let name = getAuthName();
  if (!name) return;
  fetch("/api/points/all").then(r => r.json()).then(data => {
    let pts = data[name];
    if (pts !== undefined) {
      document.getElementById("shop-points-display").textContent = pts + " 积分";
    }
  }).catch(() => {});
}

async function loadShopItems() {
  let container = document.getElementById("shop-content");
  if (!isAuthenticated()) {
    container.innerHTML = '<div class="shop-empty">请先<a href="#" onclick="closeShop();return false">登录</a>后使用商城</div>';
    return;
  }
  updateShopPoints();
  try {
    let r = await fetch("/api/shop/items");
    let items = await r.json();
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="shop-empty">暂无商品</div>';
      return;
    }
    let html = "";
    for (let item of items) {
      let colorStyle = item.color && TAG_COLORS[item.color] ? "background:" + TAG_COLORS[item.color] : "background:#95a5a6";
      let borderStyle = item.border && TAG_COLORS[item.border] ? ";outline:2px solid " + TAG_COLORS[item.border] + ";outline-offset:-1px" : "";
      html += '<div class="shop-item">' +
        '<span class="shop-item-tag" style="' + colorStyle + borderStyle + '">' + escapeHtml(item.tag) + '</span>' +
        '<div class="shop-item-info"><div class="shop-item-name">' + escapeHtml(item.name) + '</div>' +
        (item.description ? '<div class="shop-item-desc">' + escapeHtml(item.description) + '</div>' : '') +
        '</div><span class="shop-item-price">' + item.price + ' 积分</span>' +
        '<button class="shop-btn shop-btn-buy" data-item-id="' + escapeHtml(item.id) + '">购买</button></div>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="shop-empty">加载失败: ' + e.message + '</div>';
  }
}

async function loadInventory() {
  let container = document.getElementById("shop-content");
  if (!isAuthenticated()) {
    container.innerHTML = '<div class="shop-empty">请先登录后使用商城</div>';
    return;
  }
  updateShopPoints();
  try {
    let r = await fetch("/api/shop/inventory?name=" + encodeURIComponent(getAuthName()));
    let items = await r.json();
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="shop-empty">背包空空如也，去商品列表购买吧</div>';
      return;
    }
    let html = "";
    for (let item of items) {
      let colorStyle = item.color && TAG_COLORS[item.color] ? "background:" + TAG_COLORS[item.color] : "background:#95a5a6";
      let borderStyle = item.border && TAG_COLORS[item.border] ? "outline:2px solid " + TAG_COLORS[item.border] + ";outline-offset:-1px" : "";
      let btnHtml = item.equipped
        ? '<button class="shop-btn shop-btn-unequip" data-item-id="' + escapeHtml(item.itemId) + '">卸下</button>'
        : '<button class="shop-btn shop-btn-equip" data-item-id="' + escapeHtml(item.itemId) + '">装备</button>';
      let equippedBadge = item.equipped ? '<span class="shop-equip-badge">已装备</span>' : '';
      html += '<div class="shop-item">' +
        '<span class="shop-item-tag" style="' + colorStyle + (borderStyle ? ";" + borderStyle : "") + '">' + escapeHtml(item.tag) + '</span>' +
        '<div class="shop-item-info"><div class="shop-item-name">' + escapeHtml(item.name) + equippedBadge + '</div></div>' +
        btnHtml + '</div>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="shop-empty">加载失败: ' + e.message + '</div>';
  }
}

async function buyItem(itemId) {
  try {
    let r = await fetch("/api/shop/buy", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: getAuthName(), itemId})
    });
    let data = await r.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert("购买成功！");
      if (typeof updatePointsDisplay === "function") updatePointsDisplay();
      loadShopItems();
    }
  } catch (e) {
    alert("购买失败: " + e.message);
  }
}

async function equipItem(itemId) {
  try {
    let r = await fetch("/api/shop/equip", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: getAuthName(), itemId})
    });
    let data = await r.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert("装备成功！");
      if (typeof updatePointsDisplay === "function") updatePointsDisplay();
      loadInventory();
    }
  } catch (e) {
    alert("装备失败: " + e.message);
  }
}

async function unequipItem() {
  try {
    let r = await fetch("/api/shop/unequip", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: getAuthName()})
    });
    let data = await r.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert("已卸下装备");
      if (typeof updatePointsDisplay === "function") updatePointsDisplay();
      loadInventory();
    }
  } catch (e) {
    alert("操作失败: " + e.message);
  }
}

function escapeHtml(str) {
  let div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

(function() {
  let el = document.getElementById("shop-content");
  if (el) el.addEventListener("click", (e) => {
    let btn = e.target.closest(".shop-btn");
    if (!btn) return;
    let id = btn.dataset.itemId;
    if (!id) return;
    if (btn.classList.contains("shop-btn-buy")) buyItem(id);
    else if (btn.classList.contains("shop-btn-equip")) equipItem(id);
    else if (btn.classList.contains("shop-btn-unequip")) unequipItem(id);
  });
})();

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeShop();
});
(function() {
  let el = document.getElementById("shop-overlay");
  if (el) el.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeShop();
  });
})();

function openTasks() {
  document.getElementById("task-overlay").classList.add("show");
  loadTasks();
}
function closeTasks() {
  document.getElementById("task-overlay").classList.remove("show");
}

function updateTaskPoints() {
  let name = getAuthName();
  if (!name) return;
  fetch("/api/points/all").then(r => r.json()).then(data => {
    let pts = data[name];
    if (pts !== undefined) {
      document.getElementById("task-points-display").textContent = pts + " 积分";
    }
  }).catch(() => {});
}

async function loadTasks() {
  let container = document.getElementById("task-content");
  if (!isAuthenticated()) {
    container.innerHTML = '<div class="task-empty">请先<a href="#" onclick="closeTasks();return false">登录</a>后查看任务</div>';
    return;
  }
  updateTaskPoints();
  try {
    let [tasksR, compR, claimsR] = await Promise.all([
      fetch("/api/tasks/list"),
      fetch("/api/tasks/completions?name=" + encodeURIComponent(getAuthName())),
      fetch("/api/tasks/claims?name=" + encodeURIComponent(getAuthName()))
    ]);
    let tasks = await tasksR.json();
    let compData = await compR.json();
    let completed = compData.completed || [];
    let clData = await claimsR.json();
    let claimed = clData.claimed || [];
    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<div class="task-empty">暂无可用任务</div>';
      return;
    }
    let html = "";
    for (let task of tasks) {
      let isDone = completed.includes(task.id);
      let isClaimed = claimed.includes(task.id);
      let isClaimedByOther = task.claimedBy && task.claimedBy !== getAuthName();
      let btnHtml;
      if (isDone) {
        btnHtml = '<button class="task-btn task-btn-done">已完成 ✓</button>';
      } else if (isClaimedByOther) {
        btnHtml = '<button class="task-btn task-btn-done">已被领取</button>';
      } else if (isClaimed) {
        btnHtml = '<button class="task-btn task-btn-claim task-btn-complete" data-task-id="' + escapeHtml(task.id) + '">完成任务</button>';
      } else {
        btnHtml = '<button class="task-btn task-btn-claim" data-task-id="' + escapeHtml(task.id) + '">领取任务</button>';
      }
      html += '<div class="task-item">' +
        '<div class="task-item-info"><div class="task-item-name">' + escapeHtml(task.name) + '</div>' +
        (task.description ? '<div class="task-item-desc">' + escapeHtml(task.description) + '</div>' : '') +
        '</div><span class="task-item-reward">+' + task.reward + ' 积分</span>' +
        btnHtml + '</div>';
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="task-empty">加载失败: ' + e.message + '</div>';
  }
}

async function claimTask(taskId) {
  try {
    let r = await fetch("/api/tasks/claim", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: getAuthName(), taskId})
    });
    let data = await r.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert("已领取任务！完成任务后可获得奖励。");
      loadTasks();
    }
  } catch (e) {
    alert("领取失败: " + e.message);
  }
}

async function completeTask(taskId) {
  try {
    let r = await fetch("/api/tasks/complete", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: getAuthName(), taskId})
    });
    let data = await r.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert("任务完成！获得 " + data.reward + " 积分！当前积分: " + data.total);
      if (typeof updatePointsDisplay === "function") updatePointsDisplay();
      loadTasks();
    }
  } catch (e) {
    alert("提交失败: " + e.message);
  }
}

(function() {
  let el = document.getElementById("task-content");
  if (el) el.addEventListener("click", (e) => {
    let btn = e.target.closest(".task-btn-claim");
    if (!btn) return;
    let id = btn.dataset.taskId;
    if (!id) return;
    if (btn.classList.contains("task-btn-complete")) {
      completeTask(id);
    } else {
      claimTask(id);
    }
  });
})();

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeShop(); closeTasks(); }
});
(function() {
  let el = document.getElementById("task-overlay");
  if (el) el.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeTasks();
  });
})();

startNameChooser();

document.getElementById("user-menu").addEventListener("click", (e) => {
  let item = e.target.closest(".user-menu-item");
  if (item) handleMenuAction(item.dataset.action);
});
document.body.addEventListener("click", (e) => {
  if (!e.target.closest("#user-menu")) hideUserMenu();
});

document.body.addEventListener("click", (e) => {
  if (e.target.closest(".reply-cancel")) cancelReply();
});

document.body.addEventListener("click", (e) => {
  let mention = e.target.closest(".mention");
  if (mention) {
    e.preventDefault();
    let name = mention.dataset.mention;
    if (name) showUserMenu(name, e.clientX, e.clientY);
  }
});

document.body.addEventListener("click", (e) => {
  let btn = e.target.closest(".code-copy-btn");
  if (!btn) return;
  let code = btn.parentNode.querySelector("code");
  if (code) {
    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = "已复制";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "复制";
        btn.classList.remove("copied");
      }, 2000);
    }).catch(() => {});
  }
});

document.getElementById("search-toggle").addEventListener("click", toggleSearch);
document.getElementById("search-input").addEventListener("input", doSearch);
document.getElementById("search-prev").addEventListener("click", searchPrev);
document.getElementById("search-next").addEventListener("click", searchNext);
document.getElementById("search-close").addEventListener("click", toggleSearch);
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (e.shiftKey) searchPrev();
    else searchNext();
  }
  if (e.key === "Escape") {
    toggleSearch();
  }
});

document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target === e.currentTarget || e.target.classList.contains("lb-close")) hideLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideLightbox();
});

document.getElementById("sound-toggle").addEventListener("click", () => {
  soundMuted = !soundMuted;
  document.getElementById("sound-toggle").textContent = soundMuted ? "🔇" : "🔊";
  document.getElementById("sound-toggle").classList.toggle("muted", soundMuted);
});

if (localStorage.getItem("darkMode") === "1") {
  document.body.classList.add("dark");
  document.getElementById("dark-toggle").textContent = "☀️";
}
document.getElementById("dark-toggle").addEventListener("click", () => {
  let on = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", on ? "1" : "0");
  document.getElementById("dark-toggle").textContent = on ? "☀️" : "🌙";
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

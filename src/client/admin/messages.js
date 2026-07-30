// 房间消息查看 + 公告设置
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export async function toggleRoomMessages(btn, room) {
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
    let r = await fetch("/api/admin/room-messages/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(state.adminKey) + "&limit=30");
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
    viewer.innerHTML = '<h4>📝 最近消息</h4><div style="color:#c00;font-size:85%;padding:8px">加载失败</div>';
    btn.textContent = "查看消息";
  }
}

export async function setAnnouncement(room) {
  let inputId = 'ann-input-' + room.replace(/[^a-zA-Z0-9_-]/g, '_');
  let text = document.getElementById(inputId).value.trim();
  try {
    let r = await fetch("/api/admin/announcement/" + encodeURIComponent(room) + "?key=" + encodeURIComponent(state.adminKey) + "&text=" + encodeURIComponent(text));
    let result = await r.text();
    alert(result);
  } catch (e) {
    alert("设置公告失败: " + e.message);
  }
}

// 操作日志查看
import { state } from './state.js';
import { escapeHtml } from './utils.js';

const ACTION_LABELS = {
  kick: '👢 踢出',
  ban: '🚫 封禁',
  unban: '🔓 解封',
  ipban: '🔨 IP封禁',
  ipunban: '🔓 IP解封',
  set_points: '💰 设置积分',
  add_points: '➕ 增加积分',
  deduct_points: '➖ 扣除积分',
  set_tag: '🏷️ 设置标签',
  remove_tag: '🗑️ 移除标签',
  clear_room: '🧹 清空房间',
  destroy_room: '💥 销毁房间',
  delete_user: '🗑️ 删除用户',
  blacklist: '⛔ 拉黑',
  unblacklist: '✅ 移出黑名单',
  global_kick: '👢 全局踢出',
  kick_protect: '🛡️ 踢出保护',
};

export async function loadLogSection() {
  let container = document.getElementById("log-container");
  let filter = document.getElementById("log-filter").value;
  if (!container) return;
  container.innerHTML = '<div style="color:#888;padding:20px;text-align:center">加载中...</div>';
  try {
    let url = "/api/admin/log/list?key=" + encodeURIComponent(state.adminKey);
    if (filter) url += "&action=" + encodeURIComponent(filter);
    let r = await fetch(url);
    let logs = await r.json();
    if (!Array.isArray(logs) || logs.length === 0) {
      container.innerHTML = '<div style="color:#888;padding:40px;text-align:center">暂无操作日志</div>';
      return;
    }
    let html = '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="background:#f8f9fa;text-align:left">' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">时间</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">操作人</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">操作</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">目标</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #eee">详情</th>' +
      '</tr></thead><tbody>';
    logs.forEach(log => {
      let ts = log.timestamp ? new Date(log.timestamp).toLocaleString() : "-";
      let actionLabel = ACTION_LABELS[log.action] || log.action;
      html += '<tr style="border-bottom:1px solid #f0f0f0">' +
        '<td style="padding:6px 10px;color:#999;font-size:12px;white-space:nowrap">' + ts + '</td>' +
        '<td style="padding:6px 10px">' + escapeHtml(log.operator) + '</td>' +
        '<td style="padding:6px 10px">' + actionLabel + '</td>' +
        '<td style="padding:6px 10px">' + escapeHtml(log.target || "-") + '</td>' +
        '<td style="padding:6px 10px;color:#666">' + escapeHtml(log.detail || "") + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:#c00;padding:20px;text-align:center">加载失败</div>';
  }
}

export async function clearLog() {
  if (!confirm("确定清空所有操作日志？")) return;
  try {
    await fetch("/api/admin/log/clear?key=" + encodeURIComponent(state.adminKey), {method: "POST"});
    loadLogSection();
  } catch (e) { alert("操作失败"); }
}

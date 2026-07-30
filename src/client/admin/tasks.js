// 任务管理
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export async function loadTaskSection() {
  try {
    let r = await fetch("/api/admin/tasks/list?key=" + encodeURIComponent(state.adminKey));
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
    document.getElementById("task-tbody").innerHTML = '<tr><td colspan="7" style="color:#c00;text-align:center">加载失败</td></tr>';
  }
}

export async function addTaskItem() {
  let name = document.getElementById("task-tb-name").value.trim();
  let desc = document.getElementById("task-tb-desc").value.trim();
  let reward = document.getElementById("task-tb-reward").value;
  if (!name || !reward) { alert("请至少填写任务名称和奖励积分"); return; }
  try {
    let r = await fetch("/api/admin/tasks/task/add?key=" + encodeURIComponent(state.adminKey), {
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

export async function toggleTaskItem(taskId) {
  try {
    let r = await fetch("/api/admin/tasks/task/toggle?key=" + encodeURIComponent(state.adminKey), {
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

export async function deleteTaskItem(taskId) {
  if (!confirm("确定删除此任务？")) return;
  try {
    let r = await fetch("/api/admin/tasks/task/delete?key=" + encodeURIComponent(state.adminKey), {
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

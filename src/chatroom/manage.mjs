// 管理类消息处理（pin/edit/highlight/effect/get-scheduled）— 从 chatroom.mjs 提取

export async function handleManage(room, session, data, webSocket) {
  if (data.type === "pin") {
    if (room._loadPinned) await room._loadPinned;
    if (room.pinnedMessage && data.unpin) {
      room.pinnedMessage = null;
      await room.storage.delete("pinnedMessage");
      room.broadcast({type: "pinned", pinned: null});
      return true;
    }
    if (!data.text || !data.timestamp) {
      webSocket.send(JSON.stringify({error: "置顶参数错误"}));
      return true;
    }
    room.pinnedMessage = {name: session.name, text: "" + data.text, timestamp: parseInt(data.timestamp), tag: session.tag || "", tagColor: session.tagColor || "", tagBorder: session.tagBorder || "", pinnedAt: Date.now()};
    await room.storage.put("pinnedMessage", JSON.stringify(room.pinnedMessage));
    room.broadcast({type: "pinned", pinned: room.pinnedMessage});
    return true;
  }

  if (data.type === "edit") {
    let editId = parseInt(data.id, 10);
    let editMessage = "" + (data.message || "");
    if (!editId || !editMessage) {
      webSocket.send(JSON.stringify({error: "编辑参数错误"}));
      return true;
    }
    let orig = room.messages.get(editId);
    if (!orig) {
      webSocket.send(JSON.stringify({error: "消息不存在或已过期"}));
      return true;
    }
    if (orig.name !== session.name) {
      webSocket.send(JSON.stringify({error: "只能编辑自己的消息"}));
      return true;
    }
    if (Date.now() - orig.timestamp > 120000) {
      webSocket.send(JSON.stringify({error: "超过2分钟无法编辑"}));
      return true;
    }
    let maxMsgLen = (session.vip && session.vip.features ? session.vip.features.maxMsgLen : 256);
    if (editMessage.length > maxMsgLen) {
      webSocket.send(JSON.stringify({error: "消息过长"}));
      return true;
    }
    orig.message = editMessage;
    room.messages.set(editId, orig);
    let storageKey = new Date(orig.timestamp).toISOString();
    try { await room.storage.put(storageKey, JSON.stringify(orig)); } catch (e) {}
    room.broadcast({type: "edit", id: editId, message: editMessage, name: session.name, timestamp: orig.timestamp});
    return true;
  }

  if (data.type === "get-scheduled") {
    if (room._loadScheduled) await room._loadScheduled;
    let list = (room.scheduledMessages || []).map(s => ({id: s.id, name: s.name, message: s.message.slice(0, 80), time: s.time, createdAt: s.createdAt}));
    webSocket.send(JSON.stringify({type: "scheduled-list", list}));
    return true;
  }

  if (data.type === "highlight") {
    let hKey = data.msgTimestamp;
    let hText = data.text || "";
    if (!hKey) { webSocket.send(JSON.stringify({error: "缺少参数"})); return true; }
    if (!room.highlights) room.highlights = [];
    let existing = room.highlights.findIndex(h => h.timestamp == hKey);
    if (existing >= 0) {
      room.highlights.splice(existing, 1);
    } else {
      room.highlights.push({timestamp: parseInt(hKey), text: hText.slice(0, 100), name: session.name, by: session.name, time: Date.now()});
    }
    await room.storage.put("highlights", JSON.stringify(room.highlights));
    room.broadcast({type: "highlights-update", highlights: room.highlights});
    return true;
  }

  if (data.type === "effect") {
    room.broadcast(JSON.stringify({type: "effect", effect: data.effect}));
    return true;
  }

  return false;
}

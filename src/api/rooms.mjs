// 房间 API - 创建、加入、列表

export async function handleRooms(path, request, env) {
  switch (path[0]) {
    case "rooms": {
      if (path[1] === "list") {
        try {
          let registryId = env.registry.idFromName("global");
          let registryStub = env.registry.get(registryId);
          let response = await registryStub.fetch(new URL("https://dummy-url/list"));
          let data = await response.json();
          return new Response(JSON.stringify(data), {
            headers: {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
          });
        } catch (error) {
          return new Response(JSON.stringify({error: error.message}), {status: 500});
        }
      }
      return new Response("未找到", {status: 404});
    }

    case "room": {
      if (!path[1]) {
        if (request.method == "POST") {
          let id = env.rooms.newUniqueId();
          return new Response(id.toString(), {headers: {"Access-Control-Allow-Origin": "*"}});
        } else {
          return new Response("方法不允许", {status: 405});
        }
      }

      let name = path[1];
      let id;
      if (name.match(/^[0-9a-f]{64}$/)) {
        id = env.rooms.idFromString(name);
      } else if (name.length <= 32) {
        id = env.rooms.idFromName(name);
      } else {
        return new Response("名称过长", {status: 404});
      }

      let roomObject = env.rooms.get(id);

    // Password check/verify endpoints (handled via registry, not chatroom DO)
    if (path[2] === "password-status") {
      try {
        let registryId = env.registry.idFromName("global");
        let registryStub = env.registry.get(registryId);
        let r = await registryStub.fetch("https://dummy-url/password-status?name=" + encodeURIComponent(name));
        return new Response(await r.text(), {headers: {"Content-Type": "application/json"}});
      } catch (error) {
        return new Response(JSON.stringify({hasPassword: false}), {headers: {"Content-Type": "application/json"}});
      }
    }
    if (path[2] === "verify-password") {
      try {
        let registryId = env.registry.idFromName("global");
        let registryStub = env.registry.get(registryId);
        let body = await request.json();
        body.name = name;
        let r = await registryStub.fetch("https://dummy-url/verify-password", {method: "POST", body: JSON.stringify(body), headers: {"Content-Type": "application/json"}});
        return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
      } catch (error) {
        return new Response(JSON.stringify({ok: false, error: error.message}), {status: 500});
      }
    }

      // 加载更多历史消息（无限滚动）
      if (path[2] === "history") {
        let hLimit = new URL(request.url).searchParams.get("limit") || 50;
        let hBefore = new URL(request.url).searchParams.get("before") || "";
        let hUrl = "https://dummy-url/messages?limit=" + hLimit;
        if (hBefore) hUrl += "&before=" + encodeURIComponent(hBefore);
        let hResp = await roomObject.fetch(new URL(hUrl));
        let hData = await hResp.json();
        let filtered = (Array.isArray(hData) ? hData : []).filter(m => m.type !== "file");
        return new Response(JSON.stringify(filtered), {
          headers: {"Content-Type": "application/json"}
        });
      }

      let newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");
      newUrl.searchParams.set("room_name", name);

      return roomObject.fetch(newUrl, request);
    }
  }
  return new Response("未找到", {status: 404});
}

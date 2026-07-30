// 房间注册/更新/列表 + 密码管理

export async function handleRooms(reg, request, url) {
  switch (url.pathname) {
    case "/register": {
      let name = url.searchParams.get("name");
      if (!name) return new Response("请提供房间名", { status: 400 });
      if (!reg.rooms.has(name)) {
        reg.rooms.set(name, { count: 0, password: null });
      }
      return new Response("ok");
    }

    case "/update": {
      let name = url.searchParams.get("name");
      let count = parseInt(url.searchParams.get("count"), 10);
      if (!name) return new Response("请提供房间名", { status: 400 });
      let room = reg.rooms.get(name);
      if (!room) {
        reg.rooms.set(name, { count: count || 0, password: null });
      } else {
        room.count = count || 0;
      }
      await reg.save();
      return new Response("ok");
    }

    case "/list": {
      let result = {};
      for (let [name, info] of reg.rooms) {
        if (info.count > 0) {
          result[name] = { count: info.count, hasPassword: !!info.password };
        }
      }
      return new Response(JSON.stringify(result), {
        headers: {"Content-Type": "application/json"}
      });
    }

    case "/password-status": {
      let name = url.searchParams.get("name");
      if (!name) return new Response(JSON.stringify({error: "no name"}), {status: 400});
      let room = reg.rooms.get(name);
      return new Response(JSON.stringify({hasPassword: !!(room && room.password)}), {
        headers: {"Content-Type": "application/json"}
      });
    }

    case "/verify-password": {
      if (request.method !== "POST") return new Response(JSON.stringify({error: "请使用POST"}), {status: 405});
      try {
        let body = await request.json();
        let name = body.name;
        let password = body.password || "";
        let room = reg.rooms.get(name);
        if (!room || !room.password) {
          return new Response(JSON.stringify({ok: true}), {headers: {"Content-Type": "application/json"}});
        }
        if (room.password === password) {
          return new Response(JSON.stringify({ok: true}), {headers: {"Content-Type": "application/json"}});
        }
        return new Response(JSON.stringify({ok: false, error: "密码错误"}), {status: 403, headers: {"Content-Type": "application/json"}});
      } catch (e) {
        return new Response(JSON.stringify({error: "请求解析失败"}), {status: 400});
      }
    }

    case "/set-password": {
      let name = url.searchParams.get("name");
      let password = url.searchParams.get("password") || "";
      if (!name) return new Response("请提供房间名", { status: 400 });
      if (!reg.rooms.has(name)) {
        reg.rooms.set(name, { count: 0, password: null });
      }
      let room = reg.rooms.get(name);
      room.password = password || null;
      await reg.save();
      return new Response(password ? "密码已设置" : "密码已清除");
    }

    case "/room-destroy": {
      let name = url.searchParams.get("name");
      if (!name) return new Response("请提供房间名", { status: 400 });
      reg.rooms.delete(name);
      await reg.save();
      return new Response("房间 " + name + " 已从注册表中移除", { status: 200 });
    }

    default:
      return null;
  }
}

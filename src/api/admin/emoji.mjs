// 管理后台 - 自定义表情管理

export async function handleAdminEmoji(path, request, env, url) {
  switch (path[1]) {
    case "emoji": {
      let registryId = env.registry.idFromName("global");
      let stub = env.registry.get(registryId);

      if (path[2] === "list") {
        let r = await stub.fetch("https://dummy-url/emoji/list");
        let data = await r.json();
        // Strip data URLs for list view
        let names = Object.keys(data);
        return new Response(JSON.stringify({emojis: names, count: names.length}), {
          headers: {"Content-Type": "application/json"}
        });
      }

      if (path[2] === "add" && request.method === "POST") {
        try {
          let body = await request.json();
          let r = await stub.fetch("https://dummy-url/emoji/add", {
            method: "POST",
            body: JSON.stringify(body),
            headers: {"Content-Type": "application/json"}
          });
          return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
        } catch (e) {
          return new Response(JSON.stringify({error: "请求解析失败"}), {status: 400});
        }
      }

      if (path[2] === "remove") {
        let name = url.searchParams.get("name");
        if (!name) return new Response("请提供表情名称", {status: 400});
        let r = await stub.fetch("https://dummy-url/emoji/remove?name=" + encodeURIComponent(name));
        return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
      }

      return new Response("未找到", {status: 404});
    }
    default:
      return null;
  }
}

// 管理后台操作日志 API

export async function handleAdminLog(path, request, env, url) {
  if (path[1] !== "log") return null;

  try {
    let registryId = env.registry.idFromName("global");
    let stub = env.registry.get(registryId);

    if (path[2] === "list") {
      let filter = url.searchParams.get("action") || "";
      let r = await stub.fetch(new URL("https://dummy-url/log/list?action=" + encodeURIComponent(filter)));
      return new Response(await r.text(), {status: 200, headers: {"Content-Type": "application/json"}});
    }

    if (path[2] === "clear" && request.method === "POST") {
      let r = await stub.fetch("https://dummy-url/log/clear", {method: "POST"});
      return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
    }

    return null;
  } catch (error) {
    return new Response(JSON.stringify({error: "操作失败"}), {status: 500, headers: {"Content-Type": "application/json"}});
  }
}

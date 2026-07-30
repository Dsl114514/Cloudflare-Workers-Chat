// 管理后台兑换码操作
export async function handleAdminRedeem(path, request, env, url) {
  if (path[1] !== "redeem") return null;

  const action = path[2];
  try {
    let registryId = env.registry.idFromName("global");
    let stub = env.registry.get(registryId);

    if (action === "generate" && request.method === "POST") {
      let body = await request.json();
      let r = await stub.fetch("https://dummy-url/redeem/generate", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {"Content-Type": "application/json"}
      });
      return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
    }

    if (action === "add" && request.method === "POST") {
      let body = await request.json();
      let r = await stub.fetch("https://dummy-url/redeem/add", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {"Content-Type": "application/json"}
      });
      return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
    }

    if (action === "list") {
      let r = await stub.fetch("https://dummy-url/redeem/list");
      return new Response(await r.text(), {status: 200, headers: {"Content-Type": "application/json"}});
    }

    if (action === "delete" && request.method === "POST") {
      let body = await request.json();
      let r = await stub.fetch("https://dummy-url/redeem/delete", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {"Content-Type": "application/json"}
      });
      return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
    }

    return null;
  } catch (error) {
    return new Response(JSON.stringify({error: "操作失败"}), {status: 500});
  }
}

// 管理后台商店操作

export async function handleAdminShop(path, request, env, url) {
  if (path[1] !== "shop") return null;

  const shopAction = path[2];
  try {
    let registryId = env.registry.idFromName("global");
    let registryStub = env.registry.get(registryId);

    if (shopAction === "items") {
      let r = await registryStub.fetch(new URL("https://dummy-url/admin/shop/items"));
      return new Response(await r.text(), { status: 200, headers: {"Content-Type": "application/json"} });
    }
    if (shopAction === "item" && path[3] === "add") {
      if (request.method !== "POST") return new Response("方法不允许", {status: 405});
      let body = await request.json();
      let r = await registryStub.fetch("https://dummy-url/admin/shop/item/add", {method: "POST", body: JSON.stringify(body), headers: {"Content-Type": "application/json"}});
      return new Response(await r.text(), { status: r.status });
    }
    if (shopAction === "item" && path[3] === "toggle") {
      if (request.method !== "POST") return new Response("方法不允许", {status: 405});
      let body = await request.json();
      let r = await registryStub.fetch("https://dummy-url/admin/shop/item/toggle", {method: "POST", body: JSON.stringify(body), headers: {"Content-Type": "application/json"}});
      return new Response(await r.text(), { status: r.status });
    }
    if (shopAction === "item" && path[3] === "delete") {
      if (request.method !== "POST") return new Response("方法不允许", {status: 405});
      let body = await request.json();
      let r = await registryStub.fetch("https://dummy-url/admin/shop/item/delete", {method: "POST", body: JSON.stringify(body), headers: {"Content-Type": "application/json"}});
      return new Response(await r.text(), { status: r.status });
    }
    return new Response("未找到该操作", { status: 404 });
  } catch (error) {
    return new Response("商店管理操作失败: " + "操作失败", { status: 500 });
  }
}

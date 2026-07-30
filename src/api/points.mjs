// 积分 API - 转账、查询
// 重要：转账操作要求 sender 提供 token 验证身份，防止任意盗转积分

export async function handlePoints(path, request, env) {
  const url = new URL(request.url);
  const action = path[1];
  if (action === "get") {
    let name = url.searchParams.get("name");
    if (!name) return new Response(JSON.stringify({points: 0}), {headers: {"Content-Type": "application/json"}});
    let registryId = env.registry.idFromName("global");
    let stub = env.registry.get(registryId);
    let r = await stub.fetch(new URL("https://dummy-url/points/get?name=" + encodeURIComponent(name)));
    return new Response(await r.text(), {headers: {"Content-Type": "application/json"}});
  }
  if (action === "transfer") {
    let sender = url.searchParams.get("sender");
    let receiver = url.searchParams.get("receiver");
    let amount = url.searchParams.get("amount");
    let token = url.searchParams.get("token") || "";
    if (!sender || !receiver || !amount) {
      return new Response("请提供 sender、receiver 和 amount", { status: 400 });
    }
    try {
      let registryId = env.registry.idFromName("global");
      let stub = env.registry.get(registryId);
      // 验证 sender 身份：查询注册用户 token 是否匹配
      let authCheck = await stub.fetch(new URL("https://dummy-url/user-check-auth?name=" + encodeURIComponent(sender) + "&token=" + encodeURIComponent(token)));
      let authData = await authCheck.json();
      if (!authData.authenticated) {
        return new Response("转账失败：请先登录并验证身份", { status: 403 });
      }
      let r = await stub.fetch(new URL("https://dummy-url/points/transfer?sender=" + encodeURIComponent(sender) + "&receiver=" + encodeURIComponent(receiver) + "&amount=" + encodeURIComponent(amount)));
      return new Response(await r.text(), { status: r.status });
    } catch (error) {
      return new Response("转账失败: " + error.message, { status: 500 });
    }
  }
  if (action === "all") {
    // 需要管理员密钥
    let key = url.searchParams.get("key") || "";
    if (key !== (env.ADMIN_SECRET_KEY || "") && key !== (env.ADMIN_KEY || "")) {
      return new Response(JSON.stringify({error: "需要管理密钥"}), { status: 403, headers: {"Content-Type": "application/json"}});
    }
    try {
      let registryId = env.registry.idFromName("global");
      let stub = env.registry.get(registryId);
      let r = await stub.fetch(new URL("https://dummy-url/points/all"));
      return new Response(await r.text(), { status: 200, headers: {"Content-Type": "application/json"} });
    } catch (error) {
      return new Response("获取积分失败: " + error.message, { status: 500 });
    }
  }
  return new Response("未找到该操作", { status: 404 });
}

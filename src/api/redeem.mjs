// 兑换码 API — 用户兑换
export async function handleRedeemApi(path, request, env) {
  const url = new URL(request.url);
  try {
    let registryId = env.registry.idFromName("global");
    let stub = env.registry.get(registryId);

    if (request.method === "POST") {
      let body = await request.json();
      let r = await stub.fetch("https://dummy-url/redeem/redeem", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {"Content-Type": "application/json"}
      });
      return new Response(await r.text(), {status: r.status, headers: {"Content-Type": "application/json"}});
    }
    return new Response("未找到", {status: 404});
  } catch (error) {
    return new Response(JSON.stringify({error: error.message}), {status: 500});
  }
}

// v1.47 交易市场线上冒烟脚本（Node18+ 原生 fetch，本机直连 chat.liuxiyu.cn）
// 用法：node market-smoke.mjs
const BASE = "https://chat.liuxiyu.cn";
const SUPER_KEY = "9167c945079746dbfa6cd249df4ad64f102e9e34a366624539ee3ac7cfefa16e";
const ADMIN_KEY = "7a7be27563c45956c313005973b4902a15b7a1008c207c05";
const ITEM = "shop_1778732416675_hnyd6u"; // "称号" price 10000

async function j(path, opts = {}) {
  const r = await fetch(BASE + path, { headers: { "Content-Type": "application/json", "User-Agent": "CloudChat-Lxy" }, ...opts });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, d };
}
let fails = 0;
function check(cond, label, extra) { console.log((cond ? "✅ " : "❌ ") + label + (extra ? "  " + JSON.stringify(extra) : "")); if (!cond) fails++; }

async function main() {
  // 1. login
  const a = await j("/api/login", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", password: "mkt123456" }) });
  const b = await j("/api/login", { method: "POST", body: JSON.stringify({ name: "mkt_buyer_b", password: "mkt123456" }) });
  const ta = a.d && a.d.token, tb = b.d && b.d.token;
  check(!!ta && !!tb, "1. login A/B 拿 token", { a: a.d, b: b.d });

  // 2. 加积分
  await j(`/api/admin/points/add?key=${SUPER_KEY}&name=mkt_seller_a&amount=100000`);
  await j(`/api/admin/points/add?key=${SUPER_KEY}&name=mkt_buyer_b&amount=50000`);

  // 3. A 买 #1 号 → 挂单 12000 → B 买
  let r = await j("/api/shop/buy", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM }) });
  check(r.d && r.d.ok === true, "3. A 买 #1 称号", r.d);
  r = await j(`/api/admin/points/get?key=${SUPER_KEY}&name=mkt_seller_a`);
  check(String(r.d.points) === "90000", "3. A 积分 100000-10000=90000", r.d);
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "12000" }) });
  check(r.d && r.d.ok === true, "3. A 挂单 12000", r.d);
  const order1 = r.d.id;
  r = await j("/api/market/buy", { method: "POST", body: JSON.stringify({ name: "mkt_buyer_b", token: tb, orderId: order1 }) });
  check(r.d && r.d.ok === true && r.d.price === "12000" && r.d.fee === "600", "3. B 买 12000 / fee 600 (5%)", r.d);
  r = await j(`/api/admin/points/get?key=${SUPER_KEY}&name=mkt_seller_a`);
  check(String(r.d.points) === "101400", "3. A 得净额 90000+11400=101400", r.d);
  r = await j(`/api/admin/points/get?key=${SUPER_KEY}&name=mkt_buyer_b`);
  check(String(r.d.points) === "38000", "3. B 扣 12000 → 38000", r.d);
  r = await j(`/api/market/inventory?name=mkt_buyer_b&token=${tb}`);
  check(Array.isArray(r.d) && r.d.some(i => i.itemId === ITEM && i.sellable === true), "3. B 背包有称号且 sellable", Array.isArray(r.d) ? r.d : r.d);

  // 4. A 买 #2 号 → 挂单 9000 (order2)，留作 open
  await j("/api/shop/buy", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM }) });
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "9000" }) });
  check(r.d && r.d.ok === true, "4. A 挂 #2 号 9000", r.d);
  const order2 = r.d.id;

  // 5. B 已拥有 → 买 order2 拒
  r = await j("/api/market/buy", { method: "POST", body: JSON.stringify({ name: "mkt_buyer_b", token: tb, orderId: order2 }) });
  check(r.d && r.d.error === "你已拥有此商品", "5. B 已拥有同 itemId 拒买", r.d);

  // 6. 自买拒
  r = await j("/api/market/buy", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, orderId: order2 }) });
  check(r.d && r.d.error === "不能购买自己挂单", "6. 自买拒", r.d);

  // 7. A 买 #3 号 → equip → 挂单拒 → unequip
  await j("/api/shop/buy", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM }) });
  r = await j("/api/shop/equip", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM }) });
  check(r.d && r.d.ok === true, "7. A 装备 #3 号", r.d);
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "8000" }) });
  check(r.d && r.d.error === "请先卸下该装备再挂单", "7. 装备中挂单拒", r.d);
  await j("/api/shop/unequip", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM }) });

  // 8. 金额校验 0 / 负 / 超上限
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "0" }) });
  check(r.d && r.d.error === "价格必须是正整数", "8a. 金额0拒", r.d);
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "-5" }) });
  check(r.d && r.d.error === "价格必须是正整数", "8b. 金额负拒", r.d);
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "99999999999999999999" }) });
  check(r.d && r.d.error === "价格超出上限", "8c. 金额超上限拒", r.d);

  // 9. A 卖 #3 号 7000 (order3) → cancel 退回
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "7000" }) });
  check(r.d && r.d.ok === true, "9. A 挂 #3 号 7000", r.d);
  const order3 = r.d.id;
  r = await j("/api/market/cancel", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, orderId: order3 }) });
  check(r.d && r.d.ok === true, "9. cancel 成功", r.d);
  r = await j(`/api/market/inventory?name=mkt_seller_a&token=${ta}`);
  check(Array.isArray(r.d) && r.d.some(i => i.itemId === ITEM && i.sellable === true), "9. cancel 后 #3 号退回 A 背包", Array.isArray(r.d) ? r.d : r.d);

  // 10. admin 改手续费 → GET 验证 → 改回
  r = await j("/api/admin/market/config?key=" + SUPER_KEY, { method: "POST", body: JSON.stringify({ feePercent: 10 }) });
  check(r.d && r.d.ok === true && r.d.config.feePercent === 10, "10. admin 改手续费 10%", r.d.config);
  r = await j("/api/admin/market/config?key=" + SUPER_KEY);
  check(r.d && r.d.feePercent === 10, "10. config GET 验证 10%");
  await j("/api/admin/market/config?key=" + SUPER_KEY, { method: "POST", body: JSON.stringify({ feePercent: 5 }) });
  r = await j("/api/admin/market/config?key=" + SUPER_KEY);
  check(r.d && r.d.feePercent === 5, "10. 手续费改回 5%");

  // 11. A 卖 #3 号 6000 (order4) → admin delist 强制下架 → 退回
  r = await j("/api/market/sell", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, itemId: ITEM, price: "6000" }) });
  check(r.d && r.d.ok === true, "11. A 挂 #3 号 6000", r.d);
  const order4 = r.d.id;
  r = await j("/api/admin/market/delist?key=" + SUPER_KEY, { method: "POST", body: JSON.stringify({ orderId: order4 }) });
  check(r.d && r.d.ok === true, "11. admin delist 强制下架", r.d);
  r = await j(`/api/market/inventory?name=mkt_seller_a&token=${ta}`);
  check(Array.isArray(r.d) && r.d.some(i => i.itemId === ITEM), "11. delist 后 #3 号退回 A 背包");

  // 12. ledger type=market
  r = await j(`/api/points/ledger?name=mkt_seller_a&token=${ta}&limit=20`);
  check(Array.isArray(r.d) && r.d.some(x => x.type === "market" && x.desc.includes("售出")), "12. A 流水含 market 售出", Array.isArray(r.d) ? r.d.filter(x=>x.type==="market") : r.d);
  r = await j(`/api/points/ledger?name=mkt_buyer_b&token=${tb}&limit=20`);
  check(Array.isArray(r.d) && r.d.some(x => x.type === "market" && x.desc.includes("购买")), "12. B 流水含 market 购买", Array.isArray(r.d) ? r.d.filter(x=>x.type==="market") : r.d);

  // 13. 普通 admin key 访问 market admin → 403
  r = await j("/api/admin/market/config?key=" + ADMIN_KEY);
  check(r.status === 403, "13. 普通 admin(7a7be275) 访问 market admin 403", r.d);

  // 14. admin orders 含 sold 单（持久化留存）
  r = await j("/api/admin/market/orders?key=" + SUPER_KEY + "&status=sold");
  check(r.d && r.d.total >= 1, "14. admin orders 含 sold 单", r.d ? { total: r.d.total } : r.d);

  // 15. 公开 list：order1(sold) 不在、order2(open) 在
  r = await j("/api/market/list");
  const ids = Array.isArray(r.d.orders) ? r.d.orders.map(o => o.id) : [];
  check(!ids.includes(order1) && ids.includes(order2), "15. list 含 open order2、不含 sold order1", ids);

  // 16. 清理：A cancel order2（open 残留）
  r = await j("/api/market/cancel", { method: "POST", body: JSON.stringify({ name: "mkt_seller_a", token: ta, orderId: order2 }) });
  check(r.d && r.d.ok === true, "16. 清理 open order2", r.d);

  console.log(fails === 0 ? "\n🎉 全部通过" : `\n⚠️ ${fails} 项失败`);
  process.exit(fails === 0 ? 0 : 1);
}
main();

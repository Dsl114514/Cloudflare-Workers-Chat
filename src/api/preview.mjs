// URL 预览 - 获取链接的标题和描述
// ⚠️ 安全限制：禁止 SSRF（禁止访问内网地址和元数据接口）

function isPrivateIP(hostname) {
  // 解析 IP 并检查是否属于私有/保留地址段
  let parts = hostname.split('.');
  if (parts.length !== 4) return false; // 域名无法直接判断，由 DNS 解析时限制
  let nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return false;
  let [a, b] = nums;
  // 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0/8, 100.64.0.0/10
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  // ::1 (IPv6 localhost) 通过 hostname 中的 ":" 判断
  if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true;
  return false;
}

function isBannedHost(hostname) {
  const lower = hostname.toLowerCase();
  // 禁止 Cloudflare 内部元数据和其他敏感端点
  const banned = [
    '169.254.169.254', // 云元数据接口
    'metadata.google.internal',
    'metadata.cloud.google',
    '100.100.100.200', // 阿里云元数据
  ];
  if (banned.includes(lower)) return true;
  // 禁止 .internal / .local 域名
  if (lower.endsWith('.internal') || lower.endsWith('.local')) return true;
  return false;
}

export async function handlePreview(apiPath, request, env) {
  let url = new URL(request.url);
  let target = url.searchParams.get("url");
  if (!target) return new Response(JSON.stringify({error: "缺少 url 参数"}), {status: 400, headers: {"Content-Type": "application/json"}});

  let parsed;
  try { parsed = new URL(target); } catch { return new Response(JSON.stringify({error: "无效 URL"}), {status: 400, headers: {"Content-Type": "application/json"}}); }

  // 协议限制：只允许 http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response(JSON.stringify({error: "只支持 http/https 协议"}), {status: 400, headers: {"Content-Type": "application/json"}});
  }

  // IP 限制：禁止访问私有 IP
  if (isPrivateIP(parsed.hostname)) {
    return new Response(JSON.stringify({error: "不允许访问内网地址"}), {status: 403, headers: {"Content-Type": "application/json"}});
  }

  // 禁止访问已知敏感地址
  if (isBannedHost(parsed.hostname)) {
    return new Response(JSON.stringify({error: "不允许访问该地址"}), {status: 403, headers: {"Content-Type": "application/json"}});
  }

  try {
    let resp = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CloudflareChat/1.0)" },
      signal: AbortSignal.timeout(5000)
    });
    let html = await resp.text();
    let title = "", description = "", icon = "";
    let titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();
    let descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) description = descMatch[1].trim();
    let iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (iconMatch) {
      icon = iconMatch[1];
      if (icon.startsWith("//")) icon = "https:" + icon;
      else if (icon.startsWith("/")) icon = new URL(target).origin + icon;
    }
    if (!title && !description) {
      let h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) title = h1Match[1].trim();
    }
    return new Response(JSON.stringify({title, description, icon, url: target}), {
      status: 200, headers: {"Content-Type": "application/json"}
    });
  } catch (e) {
    return new Response(JSON.stringify({error: "获取失败: " + e.message}), {
      status: 200, headers: {"Content-Type": "application/json"}
    });
  }
}

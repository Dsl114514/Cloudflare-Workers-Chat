// VersionArchive Durable Object — 存贮版本 zip 文件（分块存储以绕过 128KB 限制）
export class VersionArchive {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request) {
    let url = new URL(request.url);

    switch (url.pathname) {
      case "/upload": {
        let name = url.searchParams.get("name");
        let description = url.searchParams.get("description") || "";
        if (!name) return new Response("请提供版本名称", {status: 400});

        let body = await request.arrayBuffer();
        let b64 = btoa(new Uint8Array(body).reduce((s, b) => s + String.fromCharCode(b), ""));
        let chunkSize = 96000;
        let chunks = [];
        for (let i = 0; i < b64.length; i += chunkSize) {
          chunks.push(b64.slice(i, i + chunkSize));
        }

        let info = {name, description, timestamp: Date.now(), size: body.byteLength, chunkCount: chunks.length};
        await this.storage.put("v:" + name + ":info", JSON.stringify(info));

        let puts = [this.storage.put("v:" + name + ":info", JSON.stringify(info))];
        for (let i = 0; i < chunks.length; i++) {
          puts.push(this.storage.put("v:" + name + ":c:" + i, chunks[i]));
        }
        await Promise.all(puts);

        let versions = await this.storage.get("versions") || [];
        if (!versions.includes(name)) {
          versions.unshift(name);
          await this.storage.put("versions", versions);
        }

        return new Response(JSON.stringify({ok: true, name, chunks: chunks.length, size: body.byteLength}), {
          headers: {"Content-Type": "application/json"}
        });
      }

      case "/list": {
        let versions = await this.storage.get("versions") || [];
        let result = [];
        for (let v of versions) {
          let raw = await this.storage.get("v:" + v + ":info");
          if (raw) result.push(JSON.parse(raw));
        }
        return new Response(JSON.stringify(result), {
          headers: {"Content-Type": "application/json"}
        });
      }

      case "/download": {
        let name = url.searchParams.get("name");
        if (!name) return new Response("请提供版本名称", {status: 400});
        let raw = await this.storage.get("v:" + name + ":info");
        if (!raw) return new Response("版本不存在", {status: 404});
        let info = JSON.parse(raw);

        let chunks = [];
        for (let i = 0; i < info.chunkCount; i++) {
          let c = await this.storage.get("v:" + name + ":c:" + i);
          if (c) chunks.push(c);
        }
        let b64 = chunks.join("");
        let binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

        return new Response(binary, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="' + name + '.zip"'
          }
        });
      }

      case "/delete": {
        let name = url.searchParams.get("name");
        if (!name) return new Response("请提供版本名称", {status: 400});
        let raw = await this.storage.get("v:" + name + ":info");
        if (!raw) return new Response("版本不存在", {status: 404});
        let info = JSON.parse(raw);

        let dels = [this.storage.delete("v:" + name + ":info")];
        for (let i = 0; i < info.chunkCount; i++) {
          dels.push(this.storage.delete("v:" + name + ":c:" + i));
        }
        await Promise.all(dels);

        let versions = await this.storage.get("versions") || [];
        let idx = versions.indexOf(name);
        if (idx >= 0) versions.splice(idx, 1);
        await this.storage.put("versions", versions);

        return new Response("已删除版本 " + name);
      }

      default:
        return new Response("未找到", {status: 404});
    }
  }
}

// 标签管理

export async function handleTags(reg, request, url) {
  switch (url.pathname) {
    case "/tag/set": {
      let name = url.searchParams.get("name");
      let tag = url.searchParams.get("tag");
      let color = url.searchParams.get("color") || "";
      let border = url.searchParams.get("border") || "";
      if (!name) return new Response("请提供用户名", { status: 400 });
      if (!tag) return new Response("请提供标签", { status: 400 });
      let userInv = reg.userInventory.get(name);
      if (userInv) {
        for (let [id, info] of userInv) {
          if (info.equipped) {
            return new Response("用户 " + name + " 正在使用商城标签，无法通过此方式修改", { status: 400 });
          }
        }
      }
      reg.tags.set(name, {tag, color, border});
      await reg.saveTags();
      if (color === "gray") {
        reg.banned.add(name);
        reg.globalBlacklist.add(name);
        await reg.saveBanned();
        await reg.saveGlobalBlacklist();
      }
      let colorText = color ? " (颜色: " + color + ")" : "";
      let borderText = border ? " (边框: " + border + ")" : "";
      return new Response("已为 " + name + " 设置标签 [" + tag + "]" + colorText + borderText, { status: 200 });
    }

    case "/tag/remove": {
      let name = url.searchParams.get("name");
      if (!name) return new Response("请提供用户名", { status: 400 });
      let oldTag = reg.tags.get(name);
      let oldColor = oldTag ? (typeof oldTag === "string" ? "" : oldTag.color || "") : "";
      reg.tags.delete(name);
      await reg.saveTags();
      if (oldColor === "gray") {
        reg.banned.delete(name);
        reg.globalBlacklist.delete(name);
        await reg.saveBanned();
        await reg.saveGlobalBlacklist();
      }
      return new Response("已移除 " + name + " 的标签", { status: 200 });
    }

    case "/tag/get": {
      let name = url.searchParams.get("name");
      if (!name) return new Response(JSON.stringify({tag: "", color: ""}), {
        headers: {"Content-Type": "application/json"}
      });
      let td = reg.tags.get(name) || {tag: "", color: ""};
      if (typeof td === "string") td = {tag: td, color: ""};
      return new Response(JSON.stringify(td), {
        headers: {"Content-Type": "application/json"}
      });
    }

    case "/tag/list": {
      let result = {};
      for (let [name, td] of reg.tags) {
        if (typeof td === "string") td = {tag: td, color: ""};
        result[name] = td;
      }
      return new Response(JSON.stringify(result), {
        headers: {"Content-Type": "application/json"}
      });
    }

    default:
      return null;
  }
}

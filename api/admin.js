const { cmd } = require("./_db");

async function montar() {
  const prox = Number(await cmd(["GET", "cfg:next"])) || 0;
  const keys = (await cmd(["KEYS", "qr:*"])) || [];
  const maxid = Math.max(prox, ...keys.map(k => Number(k.slice(3)) || 0), 0);
  const ids = Array.from({ length: maxid }, (_, i) => i + 1);
  const lista = [];
  for (let i = 0; i < ids.length; i += 200) {
    const ch = ids.slice(i, i + 200);
    const ks = [];
    ch.forEach(n => ks.push("qr:" + n, "name:" + n, "scans:" + n, "last:" + n));
    const v = await cmd(["MGET", ...ks]);
    ch.forEach((n, j) => lista.push({
      id: n,
      destino: v[j * 4] || "",
      nome: v[j * 4 + 1] || "",
      leituras: Number(v[j * 4 + 2]) || 0,
      ultima: Number(v[j * 4 + 3]) || 0,
    }));
  }
  return { lista, prox };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const pw = process.env.ADMIN_PASSWORD;
  const b = req.body || {};
  if (!pw || b.senha !== pw) { res.statusCode = 401; return res.end(JSON.stringify({ erro: "Senha incorreta" })); }
  try {
    let extra = {};
    if (b.acao === "set") {
      const id = String(b.id || "").replace(/[^0-9]/g, "");
      if (!id) throw new Error("Número inválido");
      let d = String(b.destino || "").trim();
      if (!d) await cmd(["DEL", "qr:" + id]);
      else {
        if (!/^https?:\/\//i.test(d)) d = "https://" + d;
        await cmd(["SET", "qr:" + id, d]);
      }
      const nome = String(b.nome || "").trim().slice(0, 80);
      if (nome) await cmd(["SET", "name:" + id, nome]);
    }
    if (b.acao === "alocar") {
      const n = Math.min(500, Math.max(1, parseInt(b.qtd) || 1));
      const ate = await cmd(["INCRBY", "cfg:next", n]);
      extra = { de: ate - n + 1, ate };
    }
    if (b.acao === "apagar_tudo") {
      if (b.confirmar !== "APAGAR TUDO") throw new Error("Confirmação incorreta");
      for (const p of ["qr:*", "name:*", "scans:*", "last:*"]) {
        const ks = (await cmd(["KEYS", p])) || [];
        for (let i = 0; i < ks.length; i += 500) await cmd(["DEL", ...ks.slice(i, i + 500)]);
      }
      await cmd(["DEL", "cfg:next"]);
    }
    const m = await montar();
    res.end(JSON.stringify({ ok: true, ...m, ...extra }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erro: String(e.message || e) })); }
};

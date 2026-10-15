const { cmd } = require("./_db");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.query.id || "").replace(/[^0-9]/g, "");
  let dest = null;
  if (id) {
    try {
      const [d, next] = await Promise.all([cmd(["GET", "qr:" + id]), cmd(["GET", "cfg:next"])]);
      dest = d;
      if (d || Number(id) <= (Number(next) || 0)) {
        await Promise.all([cmd(["INCR", "scans:" + id]), cmd(["SET", "last:" + id, String(Date.now())])]);
      }
    } catch (e) {}
  }
  res.statusCode = 302;
  res.setHeader("Location", dest && /^https?:\/\//i.test(dest) ? dest : "/inativo.html");
  res.end();
};

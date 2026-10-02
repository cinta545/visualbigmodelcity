const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

// node:sqlite 目前还挂着实验性标记,首次 require 会打横幅;
// 横幅没有信息量,这里拦掉实验类告警,其余照常往外抛
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning") return;
  console.warn(warning);
});

const seed = require("./server/seed");
const { TwinEngine } = require("./server/twin-engine");
const { SceneStore } = require("./server/store");

function createServer(options = {}) {
  const port = Number(options.port !== undefined ? options.port : process.env.PORT || 4173);
  const host = options.host || process.env.HOST || "127.0.0.1";
  const dbPath = options.dbPath || process.env.DB_PATH || path.join(__dirname, "server", "twin-scene.db");
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });
  const store = new SceneStore(dbPath);
  const engine = new TwinEngine(options.seed || seed, { store });

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(__dirname));

  // ---------- 查询类 ----------
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  app.get("/api/frame", (req, res) => res.json(engine.getStreamFrame("api-frame")));
  app.get("/api/overview", (req, res) => res.json(engine.getOverview()));
  app.get("/api/map", (req, res) => res.json(engine.getMapSnapshot()));
  app.get("/api/entities", (req, res) => {
    res.json(engine.getEntities(req.query.filter || "all", req.query.search || ""));
  });
  app.get("/api/entities/:id", (req, res) => {
    const entity = engine.getEntityById(req.params.id);
    if (!entity) return res.status(404).json({ error: "Entity not found" });
    res.json(entity);
  });
  // 因果解释:不只是实体长什么样,还回答"为什么"——归因、传播链、证据、建议
  app.get("/api/explain/:id", (req, res) => {
    const explanation = engine.explainEntity(req.params.id);
    if (!explanation) return res.status(404).json({ error: "Entity not found" });
    res.json(explanation);
  });
  app.get("/api/alerts", (req, res) => res.json(engine.getAlerts()));
  app.get("/api/history", (req, res) => res.json(engine.getHistory(req.query.limit || 20)));
  app.get("/api/diagnostics", (req, res) => res.json(engine.getDiagnostics()));
  app.get("/api/forecast", (req, res) => res.json(engine.getForecast()));
  app.get("/api/semantic-graph", (req, res) => res.json(engine.getSemanticGraph()));
  app.get("/api/control", (req, res) => res.json(engine.getControlState()));

  // ---------- 写操作 ----------
  app.post("/api/playback/toggle", (req, res) => res.json(engine.togglePlayback()));

  app.post("/api/control/strategy", (req, res) => {
    try {
      res.json(engine.setStrategy(req.body.strategyId));
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });

  app.post("/api/commands", (req, res) => {
    try {
      res.json(engine.executeCommand(req.body || {}));
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });

  app.post("/api/alerts/:id/resolve", (req, res) => res.json(engine.resolveAlert(req.params.id)));

  // 场景重建:放弃当前现场,按原始种子全量重写台账(换 seed 数据后也需要调一次)
  app.post("/api/admin/reset", (req, res) => {
    try {
      res.json(engine.resetToSeed());
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/export/snapshot", (req, res) => {
    res.setHeader("Content-Disposition", 'attachment; filename="semantic-traffic-twin-snapshot.json"');
    res.json(engine.getStreamFrame("export-snapshot"));
  });

  // Socket.IO:连上先给一帧完整快照,之后每个 tick 推增量状态
  io.on("connection", (socket) => {
    socket.emit("snapshot", engine.getStreamFrame("stream-open"));
    const unsubscribe = engine.subscribe((frame) => socket.emit("state", frame));
    socket.on("disconnect", unsubscribe);
  });

  function start(callback) {
    engine.start();
    return server.listen(port, host, () => {
      const addr = server.address();
      console.log(`twin server running at http://${host}:${(addr && addr.port) || port}`);
      console.log(`scene ledger at ${dbPath}`);
      if (callback) callback();
    });
  }

  function stop(callback) {
    engine.stop(); // 引擎停机会把检查点刷进库,必须先于 store.close
    io.close(() => {
      store.close();
      server.close(callback);
    });
  }

  return { app, server, io, engine, store, host, port, dbPath, start, stop };
}

// 直接 node server.js 跑;被 require 时不自动监听,方便测试
if (require.main === module) {
  const runtime = createServer();
  runtime.start();

  const shutdown = () => runtime.stop(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = { createServer };

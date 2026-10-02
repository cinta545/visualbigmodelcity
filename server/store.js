// 场景持久层:单文件 SQLite,直接用 Node 内置的 node:sqlite,不引三方驱动。
// 定位是"运行态台账",而不是简单的 dump 文件:
//   - 全要素场景(路网/路口/信号/设备/站点/车队/事件/分区)首次建模后导入要素表,
//     每类要素一张表,折线、相位表这类结构化大对象整体存 JSON 文本;
//   - 推演指标帧逐 tick 落 history_frame,调度指令追加 command_log,都可回溯;
//   - 运行状态(时钟/策略/车辆进度/信号相位/设备健康/事件等级)定期写检查点,
//     重启时先拿路网指纹做完整性校验,对得上就恢复现场接着跑;
//   - 路网指纹同时存进 scene_meta,库里的路网一旦被外部工具改动,引擎会放弃
//     恢复并触发重建,宁可重来也不带病运行。
// 有了这层,系统就不是"重启归零"的演示件,而是一个有落盘、可回溯、可接管的运行体。

const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = 1;

// 建表语句一次成型。要素表的静态可查字段(名称/类型/归属)拆成独立列,
// 方便外部工具直连排障;动态位置和嵌套结构存 JSON。
const DDL = `
CREATE TABLE IF NOT EXISTS scene_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roads (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  functional_class TEXT NOT NULL,
  lane_count       INTEGER,
  speed_limit      INTEGER,
  capacity         INTEGER,
  tags             TEXT,
  points           TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intersections (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  control_mode        TEXT,
  position            TEXT NOT NULL,
  connected_roads     TEXT NOT NULL,
  approach_count      INTEGER,
  saturation_warning  REAL
);
CREATE TABLE IF NOT EXISTS signals (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  intersection_id    TEXT,
  position           TEXT NOT NULL,
  cycle_length       INTEGER,
  coordination_group TEXT,
  controller_vendor  TEXT,
  phases             TEXT NOT NULL,
  phase_index        INTEGER DEFAULT 0,
  elapsed            REAL DEFAULT 0,
  current_phase      TEXT,
  current_color      TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT,
  road_id      TEXT,
  position     TEXT NOT NULL,
  status       TEXT,
  coverage     TEXT,
  capability   TEXT,
  latency_ms   INTEGER,
  health_score INTEGER,
  sample_rate  TEXT
);
CREATE TABLE IF NOT EXISTS stops (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  road_id        TEXT,
  line           TEXT,
  position       TEXT NOT NULL,
  passenger_load INTEGER,
  dwell_seconds  INTEGER
);
CREATE TABLE IF NOT EXISTS fleet (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  road_id       TEXT,
  route         TEXT NOT NULL,
  sub_type      TEXT,
  priority      TEXT,
  status        TEXT,
  speed         REAL,
  loop_flag     INTEGER DEFAULT 1,
  progress      REAL DEFAULT 0,
  delay_minutes REAL DEFAULT 0,
  occupancy     INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS events (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT,
  road_id            TEXT,
  position           TEXT NOT NULL,
  severity           INTEGER DEFAULT 2,
  status             TEXT,
  description        TEXT,
  owner              TEXT,
  first_detected_at  INTEGER,
  pulse              REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS zones (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  position         TEXT NOT NULL,
  roads            TEXT NOT NULL,
  demand_index     INTEGER,
  parking_pressure INTEGER,
  pedestrian_flow  INTEGER
);
CREATE TABLE IF NOT EXISTS run_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  tick            INTEGER NOT NULL,
  clock_minutes   REAL NOT NULL,
  playback        TEXT NOT NULL,
  active_strategy TEXT NOT NULL,
  command_seq     INTEGER NOT NULL,
  saved_at        INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS command_log (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id  TEXT NOT NULL,
  type        TEXT,
  target_id   TEXT,
  title       TEXT,
  status      TEXT,
  impact      TEXT,
  clock_label TEXT,
  operator    TEXT,
  at          INTEGER
);
CREATE TABLE IF NOT EXISTS history_frame (
  tick            INTEGER PRIMARY KEY,
  clock_label     TEXT,
  reason          TEXT,
  congestion      INTEGER,
  avg_speed       INTEGER,
  online_rate     INTEGER,
  punctuality     INTEGER,
  critical_alerts INTEGER,
  confidence      INTEGER,
  playback        TEXT,
  strategy        TEXT,
  recorded_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_history_tick ON history_frame (tick DESC);
`;

// 行记录 <-> 引擎对象 的小转换器,读写两侧各一份,贴着表放
function roadFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    functionalClass: row.functional_class,
    laneCount: row.lane_count,
    speedLimit: row.speed_limit,
    capacity: row.capacity,
    tags: JSON.parse(row.tags || "[]"),
    points: JSON.parse(row.points),
  };
}

function intersectionFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: "intersection",
    controlMode: row.control_mode,
    position: JSON.parse(row.position),
    connectedRoads: JSON.parse(row.connected_roads),
    approachCount: row.approach_count,
    saturationWarning: row.saturation_warning,
  };
}

function signalFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: "signalController",
    intersectionId: row.intersection_id,
    position: JSON.parse(row.position),
    cycleLength: row.cycle_length,
    coordinationGroup: row.coordination_group,
    controllerVendor: row.controller_vendor,
    phases: JSON.parse(row.phases),
    phaseIndex: row.phase_index || 0,
    elapsed: row.elapsed || 0,
    currentPhase: row.current_phase,
    currentColor: row.current_color,
  };
}

function deviceFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    roadId: row.road_id,
    position: JSON.parse(row.position),
    status: row.status,
    coverage: row.coverage,
    capability: row.capability,
    latencyMs: row.latency_ms,
    healthScore: row.health_score,
    sampleRate: row.sample_rate,
  };
}

function stopFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: "transitStop",
    roadId: row.road_id,
    line: row.line,
    position: JSON.parse(row.position),
    passengerLoad: row.passenger_load,
    dwellSeconds: row.dwell_seconds,
  };
}

function vehicleFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    roadId: row.road_id,
    route: JSON.parse(row.route),
    subType: row.sub_type,
    priority: row.priority,
    status: row.status,
    speed: row.speed,
    loop: Boolean(row.loop_flag),
    progress: row.progress,
    delayMinutes: row.delay_minutes,
    occupancy: row.occupancy,
  };
}

function eventFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: "incident",
    category: row.category,
    roadId: row.road_id,
    position: JSON.parse(row.position),
    severity: row.severity,
    status: row.status,
    description: row.description,
    owner: row.owner,
    firstDetectedAt: row.first_detected_at,
    pulse: row.pulse,
  };
}

function zoneFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: "trafficZone",
    position: JSON.parse(row.position),
    roads: JSON.parse(row.roads),
    demandIndex: row.demand_index,
    parkingPressure: row.parking_pressure,
    pedestrianFlow: row.pedestrian_flow,
  };
}

function commandFromRow(row) {
  return {
    id: row.command_id,
    type: row.type,
    targetId: row.target_id,
    title: row.title,
    status: row.status,
    impact: row.impact,
    clockLabel: row.clock_label,
    operator: row.operator,
    at: row.at,
  };
}

function historyFromRow(row) {
  return {
    tick: row.tick,
    clockLabel: row.clock_label,
    reason: row.reason,
    congestionIndex: row.congestion,
    avgSpeed: row.avg_speed,
    onlineRate: row.online_rate,
    punctuality: row.punctuality,
    criticalAlerts: row.critical_alerts,
    confidence: row.confidence,
    playback: row.playback,
    strategy: row.strategy,
    recordedAt: row.recorded_at,
  };
}

function parseJsonSafe(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return fallback;
  }
}

class SceneStore {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    // WAL 换写并发,NORMAL 同步档够用:检查点丢了顶多回退十几秒,不至于坏库
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(DDL);
    this.prepareStatements();
  }

  // 热路径语句统一在开库时备好,tick 落帧就是一次 run,不做重复 parse
  prepareStatements() {
    const prepare = (sql) => this.db.prepare(sql);

    this.insertRoad = prepare(
      "INSERT INTO roads (id,name,functional_class,lane_count,speed_limit,capacity,tags,points) VALUES (?,?,?,?,?,?,?,?)"
    );
    this.insertIntersection = prepare(
      "INSERT INTO intersections (id,name,control_mode,position,connected_roads,approach_count,saturation_warning) VALUES (?,?,?,?,?,?,?)"
    );
    this.insertSignal = prepare(
      "INSERT INTO signals (id,name,intersection_id,position,cycle_length,coordination_group,controller_vendor,phases,phase_index,elapsed,current_phase,current_color) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    this.insertDevice = prepare(
      "INSERT INTO devices (id,name,type,road_id,position,status,coverage,capability,latency_ms,health_score,sample_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    );
    this.insertStop = prepare(
      "INSERT INTO stops (id,name,road_id,line,position,passenger_load,dwell_seconds) VALUES (?,?,?,?,?,?,?)"
    );
    this.insertVehicle = prepare(
      "INSERT INTO fleet (id,name,road_id,route,sub_type,priority,status,speed,loop_flag,progress,delay_minutes,occupancy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    this.insertEvent = prepare(
      "INSERT INTO events (id,name,category,road_id,position,severity,status,description,owner,first_detected_at,pulse) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    );
    this.insertZone = prepare(
      "INSERT INTO zones (id,name,position,roads,demand_index,parking_pressure,pedestrian_flow) VALUES (?,?,?,?,?,?,?)"
    );
    this.putMeta = prepare("INSERT OR REPLACE INTO scene_meta (key,value) VALUES (?,?)");
    this.insertHistory = prepare(
      "INSERT OR REPLACE INTO history_frame (tick,clock_label,reason,congestion,avg_speed,online_rate,punctuality,critical_alerts,confidence,playback,strategy,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    this.insertCommand = prepare(
      "INSERT INTO command_log (command_id,type,target_id,title,status,impact,clock_label,operator,at) VALUES (?,?,?,?,?,?,?,?,?)"
    );

    // 检查点要用的按 id 更新语句
    this.updateVehicle = prepare("UPDATE fleet SET progress=?, delay_minutes=?, status=? WHERE id=?");
    this.updateSignal = prepare("UPDATE signals SET phase_index=?, elapsed=?, current_phase=?, current_color=? WHERE id=?");
    this.updateDevice = prepare("UPDATE devices SET status=?, health_score=? WHERE id=?");
    this.updateEvent = prepare("UPDATE events SET status=?, severity=?, pulse=? WHERE id=?");
    this.putRunState = prepare(
      "INSERT OR REPLACE INTO run_state (id,tick,clock_minutes,playback,active_strategy,command_seq,saved_at) VALUES (1,?,?,?,?,?,?)"
    );
  }

  readMeta() {
    const rows = this.db.prepare("SELECT key, value FROM scene_meta").all();
    const meta = {};
    for (const row of rows) meta[row.key] = row.value;
    return meta;
  }

  // 全量重建:要素、检查点、两本日志一起清,再按引擎给的建模结果导入。
  // 换 seed 或管理接口触发重置时走这里,一个大事务保证库内自洽。
  resetScene(seed, fingerprint) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const wipe = [
        "roads",
        "intersections",
        "signals",
        "devices",
        "stops",
        "fleet",
        "events",
        "zones",
        "run_state",
        "command_log",
        "history_frame",
      ];
      for (const table of wipe) this.db.exec(`DELETE FROM ${table}`);

      for (const road of seed.roads) {
        this.insertRoad.run(
          road.id,
          road.name,
          road.functionalClass,
          road.laneCount,
          road.speedLimit,
          road.capacity,
          JSON.stringify(road.tags || []),
          JSON.stringify(road.points)
        );
      }
      for (const ix of seed.intersections) {
        this.insertIntersection.run(
          ix.id,
          ix.name,
          ix.controlMode,
          JSON.stringify(ix.position),
          JSON.stringify(ix.connectedRoads || []),
          ix.approachCount,
          ix.saturationWarning
        );
      }
      for (const signal of seed.signals) {
        this.insertSignal.run(
          signal.id,
          signal.name,
          signal.intersectionId,
          JSON.stringify(signal.position),
          signal.cycleLength,
          signal.coordinationGroup,
          signal.controllerVendor,
          JSON.stringify(signal.phases),
          signal.phaseIndex || 0,
          signal.elapsed || 0,
          signal.currentPhase,
          signal.currentColor
        );
      }
      for (const device of seed.devices) {
        this.insertDevice.run(
          device.id,
          device.name,
          device.type,
          device.roadId,
          JSON.stringify(device.position),
          device.status,
          device.coverage,
          device.capability,
          device.latencyMs,
          device.healthScore,
          device.sampleRate
        );
      }
      for (const stop of seed.stops) {
        this.insertStop.run(
          stop.id,
          stop.name,
          stop.roadId,
          stop.line,
          JSON.stringify(stop.position),
          stop.passengerLoad,
          stop.dwellSeconds
        );
      }
      for (const vehicle of seed.fleet) {
        this.insertVehicle.run(
          vehicle.id,
          vehicle.name,
          vehicle.roadId,
          JSON.stringify(vehicle.route),
          vehicle.subType,
          vehicle.priority,
          vehicle.status,
          vehicle.speed,
          vehicle.loop === false ? 0 : 1,
          vehicle.progress || 0,
          vehicle.delayMinutes || 0,
          vehicle.occupancy || 1
        );
      }
      for (const event of seed.events) {
        this.insertEvent.run(
          event.id,
          event.name,
          event.category,
          event.roadId,
          JSON.stringify(event.position),
          event.severity,
          event.status,
          event.description,
          event.owner,
          event.firstDetectedAt,
          event.pulse || 0
        );
      }
      for (const zone of seed.zones) {
        this.insertZone.run(
          zone.id,
          zone.name,
          JSON.stringify(zone.position),
          JSON.stringify(zone.roads || []),
          zone.demandIndex,
          zone.parkingPressure,
          zone.pedestrianFlow
        );
      }

      const meta = {
        schemaVersion: String(SCHEMA_VERSION),
        fingerprint,
        scenarioName: seed.scenarioName || "",
        metadata: JSON.stringify(seed.metadata || {}),
        createdAt: String(Date.now()),
      };
      for (const pair of Object.entries(meta)) this.putMeta.run(pair[0], pair[1]);

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  // 读出整个场景。没有台账(首次启动)返回 null,由引擎决定走全新建模。
  loadScene() {
    const meta = this.readMeta();
    if (!meta.fingerprint) return null;

    const roads = this.db.prepare("SELECT * FROM roads").all().map(roadFromRow);
    if (!roads.length) return null;

    const scene = {
      scenarioName: meta.scenarioName || undefined,
      metadata: parseJsonSafe(meta.metadata, {}),
      roads,
      intersections: this.db.prepare("SELECT * FROM intersections").all().map(intersectionFromRow),
      signals: this.db.prepare("SELECT * FROM signals").all().map(signalFromRow),
      devices: this.db.prepare("SELECT * FROM devices").all().map(deviceFromRow),
      stops: this.db.prepare("SELECT * FROM stops").all().map(stopFromRow),
      fleet: this.db.prepare("SELECT * FROM fleet").all().map(vehicleFromRow),
      events: this.db.prepare("SELECT * FROM events").all().map(eventFromRow),
      zones: this.db.prepare("SELECT * FROM zones").all().map(zoneFromRow),
    };

    const runRow = this.db.prepare("SELECT * FROM run_state WHERE id = 1").get();
    const runState = runRow
      ? {
          tick: runRow.tick,
          clockMinutes: runRow.clock_minutes,
          playback: runRow.playback,
          activeStrategy: runRow.active_strategy,
          commandSeq: runRow.command_seq,
          savedAt: runRow.saved_at,
        }
      : null;

    const commandLog = this.db
      .prepare("SELECT * FROM command_log ORDER BY seq DESC LIMIT 80")
      .all()
      .map(commandFromRow);
    const history = this.db
      .prepare("SELECT * FROM history_frame ORDER BY tick DESC LIMIT 180")
      .all()
      .map(historyFromRow);

    return { scene, fingerprint: meta.fingerprint, runState, commandLog, history };
  }

  // 检查点:全局运行态一行,要素动态字段按 id 逐条更新,整体一个事务。
  // 量级很小(车队 180 + 信号 42 + 设备 104 + 事件 5),几十毫秒内完事。
  saveRunState(run) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const vehicle of run.fleet) {
        this.updateVehicle.run(vehicle.progress, vehicle.delayMinutes, vehicle.status, vehicle.id);
      }
      for (const signal of run.signals) {
        this.updateSignal.run(signal.phaseIndex, signal.elapsed, signal.currentPhase, signal.currentColor, signal.id);
      }
      for (const device of run.devices) {
        this.updateDevice.run(device.status, device.healthScore, device.id);
      }
      for (const event of run.events) {
        this.updateEvent.run(event.status, event.severity, event.pulse, event.id);
      }
      this.putRunState.run(run.tick, run.clockMinutes, run.playback, run.activeStrategy, run.commandSeq, Date.now());
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  appendHistory(frame) {
    this.insertHistory.run(
      frame.tick,
      frame.clockLabel,
      frame.reason,
      frame.congestionIndex,
      frame.avgSpeed,
      frame.onlineRate,
      frame.punctuality,
      frame.criticalAlerts,
      frame.confidence,
      frame.playback,
      frame.strategy,
      frame.recordedAt
    );
    // 裁剪尾巴不用每秒做,tick 逢 30 清一次:库里留最近 600 帧(约 10 分钟)
    if (frame.tick % 30 === 0) {
      this.db.exec("DELETE FROM history_frame WHERE tick <= (SELECT MAX(tick) - 600 FROM history_frame)");
    }
  }

  appendCommand(entry) {
    this.insertCommand.run(
      entry.id,
      entry.type,
      entry.targetId,
      entry.title,
      entry.status,
      entry.impact,
      entry.clockLabel,
      entry.operator,
      entry.at
    );
    // 指令日志留最近 500 条,足够审计,也不至于无限膨胀
    this.db.exec("DELETE FROM command_log WHERE seq <= (SELECT MAX(seq) - 500 FROM command_log)");
  }

  // 诊断面板展示用:一眼看清库文件在哪、落了多少东西、检查点新不新
  describe() {
    const countOf = (table) => this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const runRow = this.db.prepare("SELECT saved_at FROM run_state WHERE id = 1").get();
    return {
      file: this.filePath,
      schemaVersion: SCHEMA_VERSION,
      roads: countOf("roads"),
      historyFrames: countOf("history_frame"),
      commands: countOf("command_log"),
      lastCheckpointAt: runRow ? runRow.saved_at : null,
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = { SceneStore };

// 交通数字孪生推演引擎。
// seed(虚构路网 + 车队 + 事件)进来后先补全要素:路口、信号机、感知设备、
// 公交站、交通分区没有就自动生成;之后每个 tick 推进车辆位置、信号相位、设备状态,
// 再全量重算派生指标、实体快照和语义图。
// 挂上持久层(store)后:首次启动把建模结果导入 SQLite 台账,推演帧、调度指令、
// 检查点持续落盘,重启先验路网指纹再恢复现场——时钟、策略、车辆进度、信号相位
// 都接着上次跑,不归零。不挂 store 则退回纯内存模式,行为与旧版一致。

const MODEL_VERSION = "TwinEngine-3.0.0-landable";

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pad = (num, size) => String(num).padStart(size, "0");
const ensureArray = (v) => (Array.isArray(v) ? v : []);
const findById = (list, id) => list.find((item) => item.id === id) || null;

// FNV 变体字符串哈希,再取模做成 0~1 的确定性随机源:
// 同一个 key 永远得到同一个值,场景才能复现
function hashNumber(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

const seeded01 = (key) => (hashNumber(key) % 10000) / 10000;

// 折线总长,兜底为 1 防除零
function routeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total || 1;
}

// progress 取 0~1(负数按循环处理),返回沿线坐标
function pointAlongRoute(points, progress) {
  let normalized = progress;
  if (normalized < 0) {
    normalized = 1 + (normalized % 1);
  }
  normalized %= 1;

  const total = routeLength(points);
  const target = total * normalized;
  let traversed = 0;

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const segment = Math.sqrt(dx * dx + dy * dy) || 1;

    if (traversed + segment >= target) {
      const local = (target - traversed) / segment;
      return { x: start[0] + dx * local, y: start[1] + dy * local };
    }
    traversed += segment;
  }

  return { x: points[points.length - 1][0], y: points[points.length - 1][1] };
}

function pointAtRoad(road, ratio) {
  const point = pointAlongRoute(road.points, ratio);
  return [point.x, point.y];
}

// 取道路上前後两个采样点算航向角
function roadHeading(road, ratio) {
  const a = pointAlongRoute(road.points, clamp(ratio - 0.01, 0, 0.99));
  const b = pointAlongRoute(road.points, clamp(ratio + 0.01, 0.01, 1));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// 沿道路法线方向偏移,用于摆放路侧设备/公交站
function offsetFromRoad(road, ratio, meters) {
  const base = pointAtRoad(road, ratio);
  const heading = roadHeading(road, ratio);
  return [base[0] - Math.sin(heading) * meters, base[1] + Math.cos(heading) * meters];
}

function formatClock(totalMinutes) {
  const minutes = Math.floor(totalMinutes % (24 * 60));
  return `${pad(Math.floor(minutes / 60), 2)}:${pad(minutes % 60, 2)}`;
}

function severityLevel(severity) {
  if (severity >= 3) return "danger";
  if (severity === 2) return "warn";
  return "ok";
}

// 道路重要度 = 等级权重 x 长度 x 车道数,用来决定哪些路优先布设备/站点
const CLASS_WEIGHT = {
  motorway: 5,
  trunk: 4.6,
  primary: 4,
  secondary: 3,
  tertiary: 2.4,
  tertiary_link: 2,
  residential: 1,
};

function roadRank(road) {
  return (CLASS_WEIGHT[road.functionalClass] || 1.6) * routeLength(road.points) * (road.laneCount || 2);
}

const CLASS_LABEL = {
  motorway: "快速路",
  trunk: "主干路",
  primary: "主干路",
  secondary: "次干路",
  tertiary: "支路",
  tertiary_link: "匝道",
  residential: "街坊路",
};

function roadClassLabel(road) {
  return CLASS_LABEL[road.functionalClass] || road.functionalClass || "道路";
}

function roadName(road, fallback) {
  if (!road) return fallback || "未知道路";
  return road.name || fallback || road.id;
}

function centerOfRoads(roads) {
  const points = [];
  for (const road of roads) {
    if (road.points && road.points.length) points.push(pointAtRoad(road, 0.5));
  }
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p[0];
    sumY += p[1];
  }
  return points.length ? [sumX / points.length, sumY / points.length] : [500, 500];
}

// 按重要度从高到低,后面到处要用
const byRankDesc = (a, b) => roadRank(b) - roadRank(a);

// ---------- 路网拓扑层 ----------
// 道路 points 是折线,拓扑上只认端点:端点吸附进 30m 网格聚成节点,
// 每条路退化为图中一条边。介数中心性、干线识别、因果传播链都建在这张图上。
// 拓扑只依赖 seed.roads,初始化算一次全引擎复用。

function buildRoadGraph(roads) {
  const cellToNode = new Map();
  const nodes = new Map();
  let seq = 0;

  // 端点吸附:同一格子里出现多个端点说明路在这里交汇
  const snap = (point) => {
    const key = Math.round(point[0] / 30) + ":" + Math.round(point[1] / 30);
    let node = cellToNode.get(key);
    if (!node) {
      seq += 1;
      node = { id: "N" + seq, x: point[0], y: point[1], edgeIds: [] };
      cellToNode.set(key, node);
      nodes.set(node.id, node);
    }
    return node;
  };

  const edges = new Map();
  for (const road of roads) {
    const from = snap(road.points[0]);
    const to = snap(road.points[road.points.length - 1]);
    if (from.id === to.id) continue; // 首尾落在同一格的路是环,不参与拓扑
    edges.set(road.id, { id: road.id, from: from.id, to: to.id, length: routeLength(road.points) });
    from.edgeIds.push(road.id);
    to.edgeIds.push(road.id);
  }

  const adjacency = new Map();
  for (const node of nodes.values()) adjacency.set(node.id, []);
  for (const edge of edges.values()) {
    adjacency.get(edge.from).push({ node: edge.to, roadId: edge.id, length: edge.length });
    adjacency.get(edge.to).push({ node: edge.from, roadId: edge.id, length: edge.length });
  }

  return { nodes, edges, adjacency };
}

// Brandes 算法(无权图简化版):对每个源点做一次 BFS 记录最短路条数,
// 再按发现的逆序回填,得到每个节点被多少条最短路穿过——即"咽喉度"。
// 值越高,拆掉这个节点后全网绕行代价越大。
function brandesBetweenness(adjacency) {
  const nodeIds = Array.from(adjacency.keys());
  const centrality = new Map(nodeIds.map((n) => [n, 0]));

  for (const source of nodeIds) {
    const order = [];
    const preds = new Map(nodeIds.map((n) => [n, []]));
    const dist = new Map(nodeIds.map((n) => [n, -1]));
    const sigma = new Map(nodeIds.map((n) => [n, 0]));
    dist.set(source, 0);
    sigma.set(source, 1);

    // 手写下标推进的队列,shift() 在图大时会退化
    const queue = [source];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      order.push(v);
      for (const link of adjacency.get(v)) {
        const w = link.node;
        if (dist.get(w) < 0) {
          dist.set(w, dist.get(v) + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v));
          preds.get(w).push(v);
        }
      }
    }

    const delta = new Map(nodeIds.map((n) => [n, 0]));
    for (let i = order.length - 1; i >= 0; i--) {
      const w = order[i];
      for (const v of preds.get(w)) {
        delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      }
      if (w !== source) centrality.set(w, centrality.get(w) + delta.get(w));
    }
  }
  return centrality;
}

// 路网指纹:每个节点输出"度数:邻居度数序列",全体排序后整体哈希。
// 拓扑同构的路网指纹一致,改动任何一条路指纹都会变,用来标识场景版本。
function networkFingerprint(graph) {
  const parts = [];
  for (const node of graph.nodes.values()) {
    const neighborDegrees = graph.adjacency
      .get(node.id)
      .map((link) => graph.adjacency.get(link.node).length)
      .sort((a, b) => a - b)
      .join(".");
    parts.push(graph.adjacency.get(node.id).length + ":" + neighborDegrees);
  }
  parts.sort();
  return "TG-" + hashNumber(parts.join("|")).toString(16).toUpperCase().padStart(8, "0").slice(-8);
}

// 点到折线的投影位置(0~1),干线信号机排序要用
function projectRatioOnRoad(points, p) {
  const total = routeLength(points);
  let bestDist = Infinity;
  let bestRatio = 0;
  let traversed = 0;

  for (let i = 1; i < points.length; i++) {
    const ax = points[i - 1][0];
    const ay = points[i - 1][1];
    const dx = points[i][0] - ax;
    const dy = points[i][1] - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((p[0] - ax) * dx + (p[1] - ay) * dy) / len2, 0, 1);
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const dist = Math.hypot(p[0] - cx, p[1] - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestRatio = (traversed + Math.sqrt(len2) * t) / total;
    }
    traversed += Math.sqrt(len2);
  }
  return bestRatio;
}

class TwinEngine {
  constructor(seed, options = {}) {
    this.store = options.store || null;
    this.originSeed = seed; // 原始种子留个引用,管理接口重建场景时从这里重新克隆
    this.maxHistory = 180;
    this.listeners = [];
    this.timer = null;
    this.topology = null; // 路网拓扑,initialize 里填充

    this.state = {
      seed: clone(seed),
      meta: {
        tick: 0,
        clockMinutes: 8 * 60 + 5,
        playback: "running",
        startedAt: Date.now(),
        tickIntervalSeconds: 1,
        streamVersion: 0,
        historySamples: 0,
        lastTickAt: null,
      },
      control: {
        activeStrategy: "balanced",
        commandSeq: 0,
        commandLog: [],
        strategies: [
          {
            id: "balanced",
            name: "均衡协同",
            description: "兼顾通勤效率、公交准点和事件处置的默认策略。",
            parameters: { signalBias: 0.05, busPriority: 0.06, incidentRelief: 0.04, freightBias: 0.02 },
          },
          {
            id: "green_wave",
            name: "干线绿波",
            description: "提升主干路连续通行能力,适合早晚高峰潮汐流。",
            parameters: { signalBias: 0.18, busPriority: 0.04, incidentRelief: 0.02, freightBias: 0.03 },
          },
          {
            id: "transit_priority",
            name: "公交优先",
            description: "扩大公交相位权重,降低站点延误和线路串车。",
            parameters: { signalBias: 0.08, busPriority: 0.2, incidentRelief: 0.03, freightBias: 0 },
          },
          {
            id: "incident_response",
            name: "事件联动",
            description: "围绕事件路段实施信号截流、诱导绕行和现场处置。",
            parameters: { signalBias: 0.11, busPriority: 0.08, incidentRelief: 0.18, freightBias: 0.01 },
          },
          {
            id: "demand_balance",
            name: "需求均衡",
            description: "对商圈、停车、慢行和换乘需求进行跨区削峰。",
            parameters: { signalBias: 0.09, busPriority: 0.09, incidentRelief: 0.07, freightBias: 0.06 },
          },
        ],
      },
      derived: {},
      entities: [],
      entityMap: {},
      history: [],
      semanticGraph: { nodes: [], edges: [] },
    };

    this.initialize();
  }

  initialize() {
    // 优先从持久层恢复现场;恢复不了(首次启动/库被改动/指纹对不上)才走全新建模
    const restored = this.bootstrapFromStore();
    if (restored) {
      this.topology = this.buildTopology(this.state.seed);
      this.recomputeRuntimeFields();
    } else {
      this.prepareSeed(); // state.seed 构造时已克隆过,直接补全
      this.topology = this.buildTopology(this.state.seed);
      this.seedRuntimeDefaults();
      if (this.store) this.store.resetScene(this.state.seed, this.topology.fingerprint);
    }
    this.refresh(restored ? "scene-resume" : "initialize");
  }

  // 启动恢复:库里读出场景和检查点。路网指纹重算一遍和台账里存的对不上
  // (比如库文件被外部工具改过、或数据跟当前代码不配套),宁可放弃恢复走重建。
  bootstrapFromStore() {
    if (!this.store) return false;
    const snapshot = this.store.loadScene();
    if (!snapshot) return false;

    const recomputed = networkFingerprint(buildRoadGraph(snapshot.scene.roads));
    if (recomputed !== snapshot.fingerprint) return false;

    this.state.seed = snapshot.scene;
    const run = snapshot.runState;
    if (run) {
      this.state.meta.tick = run.tick;
      this.state.meta.clockMinutes = run.clockMinutes;
      this.state.meta.playback = run.playback || "running";
      this.state.control.activeStrategy = run.activeStrategy || "balanced";
      this.state.control.commandSeq = run.commandSeq || 0;
    }
    if (snapshot.commandLog.length) this.state.control.commandLog = snapshot.commandLog;
    if (snapshot.history.length) this.state.history = snapshot.history;
    this.state.meta.historySamples = this.state.history.length;
    return true;
  }

  // 全新建模时给动态字段铺初值(车辆进度、信号相位、事件脉动)
  seedRuntimeDefaults() {
    const seed = this.state.seed;

    // 车队沿路线展开,补初始位置和车型相关字段
    seed.fleet.forEach((vehicle, index) => {
      vehicle.progress = typeof vehicle.progress === "number" ? vehicle.progress : seeded01(vehicle.id);
      vehicle.routeLength = routeLength(vehicle.route || []);
      vehicle.position = pointAlongRoute(vehicle.route, vehicle.progress);
      vehicle.priority = vehicle.priority || this.inferPriority(vehicle, index);
      vehicle.subType = vehicle.subType || (vehicle.priority === "transit" ? "bus" : vehicle.priority === "freight" ? "truck" : "car");
      vehicle.delayMinutes = typeof vehicle.delayMinutes === "number" ? vehicle.delayMinutes : vehicle.subType === "bus" ? 1 + (index % 3) * 0.6 : 0;
      vehicle.occupancy = vehicle.subType === "bus" ? 42 + (index % 18) : vehicle.subType === "truck" ? 1 : 1 + (index % 3);
    });

    seed.signals.forEach((signal, index) => {
      signal.phaseIndex = signal.phaseIndex || 0;
      signal.elapsed = typeof signal.elapsed === "number" ? signal.elapsed : index * 5;
      signal.currentPhase = signal.currentPhase || signal.phases[0].code;
      signal.currentColor = signal.currentColor || signal.phases[0].color;
      signal.adaptiveOffset = seeded01(signal.id) * 10;
    });

    seed.events.forEach((event, index) => {
      event.pulse = typeof event.pulse === "number" ? event.pulse : index * 0.4;
      event.firstDetectedAt = event.firstDetectedAt || Date.now() - (index + 1) * 4 * 60 * 1000;
      event.owner = event.owner || (event.category === "device" ? "设施运维" : event.category === "construction" ? "道路养护" : "指挥中心");
    });
  }

  // 恢复现场后,坐标这类可推导字段重算一遍:库里只存进度,位置由折线推出来
  recomputeRuntimeFields() {
    const seed = this.state.seed;
    for (const vehicle of seed.fleet) {
      vehicle.routeLength = routeLength(vehicle.route || []);
      vehicle.position = pointAlongRoute(vehicle.route, vehicle.progress);
    }
    for (const signal of seed.signals) {
      signal.adaptiveOffset = seeded01(signal.id) * 10;
      if (!signal.phases || !signal.phases.length) continue;
      if (typeof signal.phaseIndex !== "number") signal.phaseIndex = 0;
      if (typeof signal.elapsed !== "number") signal.elapsed = 0;
      const phase = signal.phases[signal.phaseIndex] || signal.phases[0];
      signal.currentPhase = signal.currentPhase || phase.code;
      signal.currentColor = signal.currentColor || phase.color;
    }
  }

  // 检查点落盘:全局运行态 + 各要素动态字段。tick 每 12 拍存一次,
  // 策略切换/指令下发/告警闭环这类突变则立即存,停机时再兜一次。
  persistCheckpoint() {
    if (!this.store) return;
    const seed = this.state.seed;
    this.store.saveRunState({
      tick: this.state.meta.tick,
      clockMinutes: this.state.meta.clockMinutes,
      playback: this.state.meta.playback,
      activeStrategy: this.state.control.activeStrategy,
      commandSeq: this.state.control.commandSeq,
      fleet: seed.fleet.map((v) => ({ id: v.id, progress: v.progress, delayMinutes: v.delayMinutes || 0, status: v.status })),
      signals: seed.signals.map((s) => ({ id: s.id, phaseIndex: s.phaseIndex, elapsed: s.elapsed, currentPhase: s.currentPhase, currentColor: s.currentColor })),
      devices: seed.devices.map((d) => ({ id: d.id, status: d.status, healthScore: d.healthScore })),
      events: seed.events.map((e) => ({ id: e.id, status: e.status, severity: e.severity, pulse: e.pulse || 0 })),
    });
  }

  prepareSeed() {
    const seed = this.state.seed;
    // 只保留有效数据:路线至少要有两个点
    seed.roads = ensureArray(seed.roads).filter((road) => ensureArray(road.points).length >= 2);
    seed.intersections = ensureArray(seed.intersections);
    seed.stops = ensureArray(seed.stops);
    seed.devices = ensureArray(seed.devices);
    seed.signals = ensureArray(seed.signals);
    seed.fleet = ensureArray(seed.fleet).filter((v) => ensureArray(v.route).length >= 2);
    seed.events = ensureArray(seed.events);

    seed.metadata = seed.metadata || {};
    seed.metadata.modelVersion = MODEL_VERSION;
    seed.metadata.enrichment = "自动生成路口、信号、感知、公交、事件、语义关系与预测控制层";

    // 这些要素缺了就自动补
    if (!seed.intersections.length) seed.intersections = this.generateIntersections(seed.roads);
    if (!seed.signals.length) seed.signals = this.generateSignals(seed.intersections);
    if (!seed.devices.length) seed.devices = this.generateDevices(seed.roads);
    if (!seed.stops.length) seed.stops = this.generateStops(seed.roads);
    if (seed.events.length < 5) seed.events = this.generateEvents(seed.events, seed.roads, seed.devices);
    seed.zones = this.generateZones(seed.roads);

    this.normalizeFleet(seed);
  }

  normalizeFleet(seed) {
    const rankedRoads = seed.roads.slice().sort(byRankDesc);
    seed.fleet.forEach((vehicle, i) => {
      // 车辆挂的道路不存在时,按重要度轮转分配一条
      let road = findById(seed.roads, vehicle.roadId);
      if (!road) road = rankedRoads[i % rankedRoads.length];
      vehicle.roadId = road.id;
      vehicle.route = ensureArray(vehicle.route).length >= 2 ? vehicle.route : road.points;
      vehicle.name = vehicle.name || `网联车辆 ${i + 1}`;
      vehicle.priority = vehicle.priority || this.inferPriority(vehicle, i);
      vehicle.subType = vehicle.subType || (vehicle.priority === "transit" ? "bus" : vehicle.priority === "freight" ? "truck" : "car");
      vehicle.status = vehicle.status || "moving";
      vehicle.speed = Number(vehicle.speed) || clamp((road.speedLimit || 50) * (0.72 + seeded01(vehicle.id) * 0.35), 24, 70);
      vehicle.loop = vehicle.loop !== false;
    });
  }

  inferPriority(vehicle, index) {
    if (vehicle.priority) return vehicle.priority;
    if (vehicle.subType === "bus" || index % 11 === 0) return "transit";
    if (vehicle.subType === "truck" || index % 7 === 0) return "freight";
    if (index % 53 === 0) return "emergency";
    return "general";
  }

  generateIntersections(roads) {
    // 把道路端点、1/3、2/3 处的采样点丢进 26m 网格,
    // 同一格子里出现 >= 2 条路就认作路口
    const cells = new Map();
    for (const road of roads) {
      const samples = [
        road.points[0],
        road.points[road.points.length - 1],
        pointAtRoad(road, 0.33),
        pointAtRoad(road, 0.66),
      ];
      for (const point of samples) {
        const key = `${Math.round(point[0] / 26)}:${Math.round(point[1] / 26)}`;
        if (!cells.has(key)) cells.set(key, { roadIds: new Set(), points: [], weight: 0 });
        const cell = cells.get(key);
        cell.roadIds.add(road.id);
        cell.points.push(point);
        cell.weight += roadRank(road);
      }
    }

    let candidates = Array.from(cells.values())
      .filter((cell) => cell.roadIds.size >= 2)
      .sort((a, b) => b.roadIds.size - a.roadIds.size || b.weight - a.weight)
      .slice(0, 48);

    // 路口太少的话,用最重要的道路单路成"路口"补到 28 个,保证演示规模
    if (candidates.length < 28) {
      const ranked = roads.slice().sort(byRankDesc);
      const need = 28 - candidates.length;
      for (let m = 0; m < need && m < ranked.length; m++) {
        const road = ranked[m];
        candidates.push({
          roadIds: new Set([road.id]),
          points: [pointAtRoad(road, 0.5)],
          weight: roadRank(road),
        });
      }
    }

    return candidates.map((cell, index) => {
      const roadIds = Array.from(cell.roadIds).slice(0, 6);
      const position = [0, 0];
      for (const p of cell.points) {
        position[0] += p[0];
        position[1] += p[1];
      }
      position[0] /= cell.points.length;
      position[1] /= cell.points.length;

      const leadRoad = findById(roads, roadIds[0]);
      const degree = roadIds.length;
      return {
        id: `I-AUTO-${pad(index + 1, 2)}`,
        name: `${roadName(leadRoad, "核心")}协同路口`,
        type: "intersection",
        controlMode: degree >= 4 ? "adaptive-multi-ring" : degree >= 2 ? "coordinated" : "actuated",
        position,
        connectedRoads: roadIds,
        approachCount: Math.max(2, degree * 2),
        saturationWarning: 0.78 + seeded01(`ix-${index}`) * 0.12,
      };
    });
  }

  generateSignals(intersections) {
    return intersections.slice(0, 42).map((intersection, index) => {
      const cycle = 78 + (index % 5) * 6;
      return {
        id: `SC-AUTO-${pad(index + 1, 2)}`,
        name: `${intersection.name}信号控制机`,
        type: "signalController",
        intersectionId: intersection.id,
        position: [intersection.position[0] + 10 + (index % 3) * 4, intersection.position[1] - 10],
        cycleLength: cycle,
        coordinationGroup: `G-${pad((index % 6) + 1, 2)}`,
        controllerVendor: index % 2 ? "EdgeSignal-X" : "MEC-Signal-AI",
        // 四相位 + 全红清空
        phases: [
          { code: "NS_GREEN", color: "green", duration: Math.round(cycle * 0.38) },
          { code: "NS_YELLOW", color: "yellow", duration: 4 },
          { code: "EW_GREEN", color: "green", duration: Math.round(cycle * 0.34) },
          { code: "EW_YELLOW", color: "yellow", duration: 4 },
          { code: "ALL_RED", color: "red", duration: 3 },
        ],
      };
    });
  }

  generateDevices(roads) {
    const ranked = roads.slice().sort(byRankDesc);
    const devices = [];
    const blueprints = [
      { prefix: "CAM", type: "camera", name: "视频结构化相机", capability: "video-ai", ratio: 0.28, offset: 14 },
      { prefix: "RAD", type: "radar", name: "毫米波雷达", capability: "trajectory", ratio: 0.52, offset: -13 },
      { prefix: "RSU", type: "rsu", name: "车路协同 RSU", capability: "v2x", ratio: 0.72, offset: 16 },
      { prefix: "VMS", type: "vms", name: "可变情报板", capability: "guidance", ratio: 0.43, offset: -17 },
    ];

    // 前 76 条重要道路布设备,前 28 条每条两台
    const roadLimit = Math.min(ranked.length, 76);
    for (let roadIndex = 0; roadIndex < roadLimit; roadIndex++) {
      const road = ranked[roadIndex];
      const count = roadIndex < 28 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const bp = blueprints[(roadIndex + i) % blueprints.length];
        // 第一台 VMS 固定叫 D-VMS-01,后面有个"诱导屏离线"事件挂在它身上
        const id = bp.prefix === "VMS" && !findById(devices, "D-VMS-01")
          ? "D-VMS-01"
          : `D-${bp.prefix}-${pad(devices.length + 1, 3)}`;
        const risk = seeded01(`${id}-${road.id}`);
        const status = id === "D-VMS-01" ? "offline" : risk > 0.94 ? "offline" : risk > 0.82 ? "degraded" : "online";
        devices.push({
          id,
          name: `${road.name}${bp.name}`,
          type: bp.type,
          roadId: road.id,
          position: offsetFromRoad(road, clamp(bp.ratio + (seeded01(id) - 0.5) * 0.12, 0.12, 0.88), bp.offset),
          status,
          coverage: `${road.name} ${roadClassLabel(road)} ${Math.round(routeLength(road.points))}m`,
          capability: bp.capability,
          latencyMs: Math.round(18 + seeded01(`${id}-latency`) * 48),
          healthScore: status === "online" ? Math.round(88 + seeded01(id) * 10) : status === "degraded" ? Math.round(62 + seeded01(id) * 18) : Math.round(25 + seeded01(id) * 25),
          sampleRate: bp.type === "camera" ? "25fps" : bp.type === "radar" ? "10Hz" : bp.type === "rsu" ? "20Hz" : "event",
        });
      }
    }

    return devices;
  }

  generateStops(roads) {
    const ranked = roads
      .filter((road) => ["primary", "secondary", "tertiary"].indexOf(road.functionalClass) >= 0)
      .sort(byRankDesc);

    const result = [];
    const limit = Math.min(ranked.length, 32);
    for (let index = 0; index < limit; index++) {
      const road = ranked[index];
      result.push({
        id: `STOP-AUTO-${pad(index + 1, 2)}`,
        name: `${road.name}智慧公交站`,
        type: "transitStop",
        roadId: road.id,
        line: `L${(index % 8) + 1} / 快线${(index % 4) + 1}`,
        // 站台摆在道路两侧,避免和车流重叠
        position: offsetFromRoad(road, index % 2 ? 0.38 : 0.62, index % 2 ? 18 : -18),
        passengerLoad: Math.round(28 + seeded01(`stop-${index}`) * 120),
        dwellSeconds: Math.round(22 + seeded01(`dwell-${index}`) * 42),
      });
    }
    return result;
  }

  generateEvents(existing, roads, devices) {
    const ranked = roads.slice().sort(byRankDesc);
    const pick = (index) => ranked[index % ranked.length];

    const output = existing.map((event, index) => ({
      ...event,
      id: event.id || `E-SEED-${index + 1}`,
      type: "incident",
      roadId: event.roadId || pick(index).id,
      position: event.position || pointAtRoad(pick(index), 0.5),
      severity: event.severity || 2,
      status: event.status || "active",
      category: event.category || "congestion",
    }));

    // 补四类演示事件,seed 里已有同类的不重复生成
    const vmsDevice = findById(devices, "D-VMS-01");
    const deviceRoad = (vmsDevice && findById(roads, vmsDevice.roadId)) || pick(2);

    const templates = [
      {
        id: "E-AUTO-WORKZONE",
        name: "道路占道施工联动",
        category: "construction",
        severity: 2,
        status: "monitoring",
        road: pick(1),
        ratio: 0.48,
        description: "施工围挡占用外侧车道,系统已生成绕行与限速诱导方案。",
      },
      {
        id: "E-AUTO-DEVICE",
        name: "路侧诱导屏离线",
        category: "device",
        severity: 2,
        status: "active",
        road: deviceRoad,
        ratio: 0.43,
        description: "关键诱导设备离线,影响上游分流信息发布与事件确认闭环。",
      },
      {
        id: "E-AUTO-DEMAND",
        name: "滨江客流聚集预警",
        category: "demand",
        severity: 2,
        status: "monitoring",
        road: pick(3),
        ratio: 0.58,
        description: "商圈停车与慢行需求上升,周边路段存在短时溢出风险。",
      },
      {
        id: "E-AUTO-EMERGENCY",
        name: "应急车辆绿波保障",
        category: "emergency",
        severity: 1,
        status: "active",
        road: pick(4),
        ratio: 0.35,
        description: "急救通道进入核心区,需对连续路口启用优先放行。",
      },
    ];

    for (const tpl of templates) {
      if (output.some((event) => event.category === tpl.category)) continue;
      output.push({
        id: tpl.id,
        name: tpl.name,
        type: "incident",
        status: tpl.status,
        severity: tpl.severity,
        category: tpl.category,
        roadId: tpl.road.id,
        position: pointAtRoad(tpl.road, tpl.ratio),
        description: tpl.description,
      });
    }

    return output;
  }

  generateZones(roads) {
    const names = ["商务核心区", "滨江慢行区", "换乘枢纽区", "地下车库集散区"];
    const ranked = roads.slice().sort(byRankDesc);

    // 道路轮转分到 4 个区,每区最多 28 条
    const chunks = names.map((name, i) => {
      const chunk = [];
      for (let j = 0; j < ranked.length; j++) {
        if (j % names.length === i) chunk.push(ranked[j]);
        if (chunk.length >= 28) break;
      }
      return chunk;
    });

    return chunks.map((chunk, index) => ({
      id: `ZONE-${pad(index + 1, 2)}`,
      name: names[index],
      type: "trafficZone",
      position: centerOfRoads(chunk),
      roads: chunk.map((road) => road.id),
      demandIndex: Math.round(54 + seeded01(`zone-${index}`) * 34),
      parkingPressure: Math.round(42 + seeded01(`parking-${index}`) * 50),
      pedestrianFlow: Math.round(1200 + seeded01(`ped-${index}`) * 5600),
    }));
  }

  // 拓扑分析入口:构图 -> 介数中心性 -> 路段咽喉度 -> 干线识别 -> 指纹
  buildTopology(seed) {
    const graph = buildRoadGraph(seed.roads);
    const centrality = brandesBetweenness(graph.adjacency);

    // 路段咽喉度 = 两端点介数均值,按全网最大值归一到 0~1
    let maxRaw = 0;
    const rawScores = {};
    for (const edge of graph.edges.values()) {
      const score = (centrality.get(edge.from) + centrality.get(edge.to)) / 2;
      rawScores[edge.id] = score;
      if (score > maxRaw) maxRaw = score;
    }
    const choke = {};
    for (const id of Object.keys(rawScores)) {
      choke[id] = maxRaw > 0 ? rawScores[id] / maxRaw : 0;
    }

    return {
      graph,
      centrality,
      choke,
      fingerprint: networkFingerprint(graph),
      corridors: this.traceCorridors(seed, graph),
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.size,
    };
  }

  // 干线识别:在高等级路组成的子图上做"最大延续"链式追踪。
  // 以等级最高的路为种子,双向试走,每步优先接转向角最小的路,平手取等级高者,
  // 拼出走向自然、不被匝道带偏的干线。最多留 6 条,每条最多 7 段。
  traceCorridors(seed, graph) {
    const ARTERIAL_CLASSES = ["motorway", "trunk", "primary", "secondary"];
    const roadById = new Map(seed.roads.map((r) => [r.id, r]));

    // 高等级路按端点聚到节点上
    const byNode = new Map();
    for (const road of seed.roads) {
      if (ARTERIAL_CLASSES.indexOf(road.functionalClass) < 0) continue;
      const edge = graph.edges.get(road.id);
      if (!edge) continue;
      for (const nodeId of [edge.from, edge.to]) {
        if (!byNode.has(nodeId)) byNode.set(nodeId, []);
        byNode.get(nodeId).push(road.id);
      }
    }

    const ranked = seed.roads
      .filter((r) => ARTERIAL_CLASSES.indexOf(r.functionalClass) >= 0 && graph.edges.has(r.id))
      .sort(byRankDesc);

    const used = new Set();
    const corridors = [];

    for (const seedRoad of ranked) {
      if (corridors.length >= 6) break;
      if (used.has(seedRoad.id)) continue;

      // 两个方向各试走一遍,留链更长的那个方向
      const edge = graph.edges.get(seedRoad.id);
      let bestChain = null;
      for (const startNode of [edge.from, edge.to]) {
        const chain = this.walkChain(seedRoad.id, startNode, used, byNode, roadById, graph);
        if (!bestChain || chain.length > bestChain.length) bestChain = chain;
      }
      if (!bestChain || bestChain.length < 2) continue;

      for (const id of bestChain) used.add(id);
      corridors.push(this.assembleCorridor(bestChain, seed, roadById, graph, corridors.length));
    }

    return corridors;
  }

  walkChain(seedRoadId, startNode, used, byNode, roadById, graph) {
    const chain = [seedRoadId];
    let currentNode = this.oppositeEnd(graph, seedRoadId, startNode);
    let heading = this.exitHeading(roadById.get(seedRoadId), graph, startNode);

    while (chain.length < 7) {
      const options = (byNode.get(currentNode) || []).filter((id) => !used.has(id) && chain.indexOf(id) < 0);
      if (!options.length) break;

      options.sort((a, b) => {
        const turnA = Math.abs(this.angleDiff(this.exitHeading(roadById.get(a), graph, currentNode), heading));
        const turnB = Math.abs(this.angleDiff(this.exitHeading(roadById.get(b), graph, currentNode), heading));
        return turnA - turnB || roadRank(roadById.get(b)) - roadRank(roadById.get(a));
      });

      const nextId = options[0];
      heading = this.exitHeading(roadById.get(nextId), graph, currentNode);
      chain.push(nextId);
      currentNode = this.oppositeEnd(graph, nextId, currentNode);
    }
    return chain;
  }

  oppositeEnd(graph, roadId, node) {
    const edge = graph.edges.get(roadId);
    return edge.from === node ? edge.to : edge.from;
  }

  // 从 node 端进入这条路时的出口方向(弧度)
  exitHeading(road, graph, nodeId) {
    const node = graph.nodes.get(nodeId);
    const first = road.points[0];
    const last = road.points[road.points.length - 1];
    const nearFirst =
      Math.hypot(node.x - first[0], node.y - first[1]) < Math.hypot(node.x - last[0], node.y - last[1]);
    const from = nearFirst ? first : last;
    const to = nearFirst ? road.points[1] : road.points[road.points.length - 2];
    return Math.atan2(to[1] - from[1], to[0] - from[0]);
  }

  angleDiff(a, b) {
    let diff = a - b;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

  // 把成员路链组装成干线:定名、算长度、挂信号机锚点(含沿线里程)
  assembleCorridor(chain, seed, roadById, graph, index) {
    const memberRoads = chain.map((id) => roadById.get(id)).filter(Boolean);
    const totalLength = memberRoads.reduce((sum, r) => sum + routeLength(r.points), 0);

    // 名字取成员里出现次数最多的路名——重名本身就是"同一条走廊"的证据
    const nameCounts = new Map();
    for (const road of memberRoads) nameCounts.set(road.name, (nameCounts.get(road.name) || 0) + 1);
    const bestName = Array.from(nameCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

    // 信号机锚点:路口只要连着干线任一成员就算挂靠,记录在第几段、段内位置
    const memberSet = new Set(chain);
    const anchors = [];
    for (const signal of seed.signals) {
      const intersection = findById(seed.intersections, signal.intersectionId);
      if (!intersection) continue;
      const hitRoadId = intersection.connectedRoads.find((rid) => memberSet.has(rid));
      if (!hitRoadId) continue;
      const road = roadById.get(hitRoadId);
      anchors.push({
        signalId: signal.id,
        chainIndex: chain.indexOf(hitRoadId),
        ratio: projectRatioOnRoad(road.points, intersection.position),
        cycle: signal.cycleLength,
      });
    }
    anchors.sort((a, b) => a.chainIndex - b.chainIndex || a.ratio - b.ratio);

    return {
      id: "CORRIDOR-" + pad(index + 1, 2),
      name: bestName + " 沿线",
      roadIds: chain,
      lengthMeters: Math.round(totalLength),
      designSpeed: clamp(Math.min.apply(null, memberRoads.map((r) => r.speedLimit || 50)), 40, 80),
      signalAnchors: anchors,
      memberNames: memberRoads.map((r) => r.name),
    };
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  emit(reason) {
    const frame = this.getStreamFrame(reason);
    this.listeners.forEach((listener) => listener(frame));
  }

  getActiveStrategy() {
    const { strategies, activeStrategy } = this.state.control;
    return strategies.find((s) => s.id === activeStrategy) || strategies[0];
  }

  computeDerived() {
    const seed = this.state.seed;
    const strategy = this.getActiveStrategy();
    const params = strategy.parameters;
    const tick = this.state.meta.tick;
    const clockHours = this.state.meta.clockMinutes / 60;

    // 先聚合:每条路上的车数、活跃事件影响
    const vehicleCountByRoad = {};
    for (const vehicle of seed.fleet) {
      vehicleCountByRoad[vehicle.roadId] = (vehicleCountByRoad[vehicle.roadId] || 0) + 1;
    }
    const activeEventsByRoad = {};
    for (const event of seed.events) {
      if (event.status === "active" || event.status === "monitoring") {
        activeEventsByRoad[event.roadId] = (activeEventsByRoad[event.roadId] || 0) + event.severity;
      }
    }

    // 逐路推指标:基础负载 + 等级压力 + 潮汐 + 微观波动 + 事件影响 - 策略缓解
    // 各分量同时留存到 components,因果解释器靠它做归因分解
    const topo = this.topology;
    const sortedChoke = topo ? seed.roads.map((r) => topo.choke[r.id] || 0).sort((a, b) => a - b) : [];
    const chokeRankOf = (value) => {
      // 二分找第一个 >= value 的位置,返回分位(0~1,越高越关键)
      let lo = 0;
      let hi = sortedChoke.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sortedChoke[mid] < value) lo = mid + 1;
        else hi = mid;
      }
      return sortedChoke.length ? lo / sortedChoke.length : 0;
    };

    const roadMetrics = {};
    seed.roads.forEach((road, index) => {
      const vehicleCount = vehicleCountByRoad[road.id] || 0;
      const eventImpact = activeEventsByRoad[road.id] || 0;
      const classPressure = road.functionalClass === "primary" ? 0.19 : road.functionalClass === "secondary" ? 0.14 : road.functionalClass === "tertiary" ? 0.09 : 0.06;
      const tide = (Math.sin(clockHours * 1.35 + index * 0.47) + 1) * 0.08;
      const microscopic = (Math.sin(tick / 9 + index * 0.61) + 1) * 0.035;
      const demand = (seeded01(road.id) - 0.5) * 0.1;
      const flowLoad = (vehicleCount * 190) / Math.max(road.capacity || 1200, 700);
      const relief = params.signalBias * (road.functionalClass === "primary" || road.functionalClass === "secondary" ? 0.6 : 0.25) + params.incidentRelief * Math.min(eventImpact, 3) * 0.38;
      const load = clamp(0.19 + classPressure + tide + microscopic + demand + flowLoad + eventImpact * 0.095 - relief, 0.07, 0.98);
      const avgSpeed = clamp((road.speedLimit || 45) * (1 - load * 0.58), 8, road.speedLimit || 45);
      const queueLength = Math.round(Math.max(0, load - 0.58) * routeLength(road.points) * (road.laneCount || 2) * 1.4);
      const throughput = Math.round((road.capacity || 1200) * clamp(0.38 + load * 0.48 - Math.max(load - 0.88, 0) * 0.7, 0.18, 0.96));
      const reliability = Math.round(clamp(100 - load * 42 - eventImpact * 5, 40, 99));
      const emissionIndex = Math.round(clamp(34 + load * 55 + Math.max(0, 32 - avgSpeed) * 0.8, 20, 98));

      const choke = topo ? topo.choke[road.id] || 0 : 0;
      roadMetrics[road.id] = {
        load,
        avgSpeed,
        vehicleCount,
        queueLength,
        throughput,
        reliability,
        emissionIndex,
        eventImpact,
        saturation: clamp(load + eventImpact * 0.04, 0, 1),
        choke,
        chokeRank: chokeRankOf(choke),
        components: {
          base: 0.19,
          classPressure,
          tide,
          flowLoad,
          event: eventImpact * 0.095,
          relief: -relief,
        },
      };
    });

    // 车辆实际速度 = 道路均速 x 车辆速度倾向 x 优先级加成
    for (const vehicle of seed.fleet) {
      const roadMetric = roadMetrics[vehicle.roadId];
      const road = findById(seed.roads, vehicle.roadId);
      const maxSpeed = road ? road.speedLimit : vehicle.speed;
      const base = roadMetric ? roadMetric.avgSpeed : vehicle.speed;
      const priorityBoost =
        vehicle.priority === "emergency"
          ? 1.22 + params.incidentRelief * 0.4
          : vehicle.priority === "transit"
          ? 1.03 + params.busPriority
          : vehicle.priority === "freight"
          ? 1 + params.freightBias
          : 1;
      vehicle.effectiveSpeed = clamp(base * (vehicle.speed / Math.max(maxSpeed, 20)) * priorityBoost, 8, 74);
    }

    const deviceCounts = { total: 0, online: 0, degraded: 0, offline: 0 };
    for (const device of seed.devices) {
      deviceCounts.total++;
      deviceCounts[device.status] = (deviceCounts[device.status] || 0) + 1;
    }

    const busFleet = seed.fleet.filter((v) => v.subType === "bus" || v.priority === "transit");
    const avgBusDelay = busFleet.reduce((sum, v) => sum + (Number(v.delayMinutes) || 0), 0) / (busFleet.length || 1);
    const punctuality = clamp(100 - avgBusDelay * 8.5 + params.busPriority * 35, 62, 99);

    const metricList = Object.values(roadMetrics);
    const congestionIndex = Math.round((metricList.reduce((sum, m) => sum + m.load, 0) / (metricList.length || 1)) * 100);
    const avgSpeed = Math.round(metricList.reduce((sum, m) => sum + m.avgSpeed, 0) / (metricList.length || 1));
    const criticalAlerts = seed.events.filter((e) => e.status !== "cleared" && e.severity >= 2).length;
    const onlineRate = deviceCounts.total ? Math.round((deviceCounts.online / deviceCounts.total) * 100) : 100;
    const modelConfidence = Math.round(clamp(88 - deviceCounts.offline * 1.2 - deviceCounts.degraded * 0.35 + params.signalBias * 20, 68, 96));
    const riskIndex = Math.round(clamp(congestionIndex * 0.55 + criticalAlerts * 8 + deviceCounts.offline * 0.8, 10, 99));
    const carbonIndex = Math.round(metricList.reduce((sum, m) => sum + m.emissionIndex, 0) / (metricList.length || 1));

    const derived = {
      roadMetrics,
      metrics: [
        { label: "网络拥堵指数", value: congestionIndex, unit: "%", delta: congestionIndex > 68 ? "走廊压力升高" : "整体可控" },
        { label: "平均运行速度", value: avgSpeed, unit: "km/h", delta: avgSpeed < 28 ? "低速路段增多" : "速度稳定" },
        { label: "感知设备在线率", value: onlineRate, unit: "%", delta: deviceCounts.offline ? `${deviceCounts.offline} 台离线` : "设备运行稳定" },
        { label: "公交准点率", value: Math.round(punctuality), unit: "%", delta: avgBusDelay > 2.5 ? "建议公交优先" : "线路状态平稳" },
        { label: "事件处置压力", value: criticalAlerts, unit: "起", delta: criticalAlerts > 2 ? "需要联动处置" : "告警可控" },
        { label: "模型置信度", value: modelConfidence, unit: "%", delta: modelConfidence < 78 ? "感知覆盖下降" : "数据闭环充分" },
      ],
      health: {
        onlineDevices: deviceCounts.online,
        degradedDevices: deviceCounts.degraded || 0,
        offlineDevices: deviceCounts.offline || 0,
        avgBusDelay: Number(avgBusDelay.toFixed(1)),
        playback: this.state.meta.playback,
        eventPressure: criticalAlerts,
        activeStrategy: strategy.id,
        modelConfidence,
        riskIndex,
        carbonIndex,
      },
      totals: {
        roads: seed.roads.length,
        intersections: seed.intersections.length,
        stops: seed.stops.length,
        devices: seed.devices.length,
        signals: seed.signals.length,
        vehicles: seed.fleet.length,
        events: seed.events.length,
        zones: seed.zones.length,
        entities:
          seed.roads.length +
          seed.intersections.length +
          seed.stops.length +
          seed.devices.length +
          seed.signals.length +
          seed.fleet.length +
          seed.events.length +
          seed.zones.length,
      },
    };

    // 干线状态要先于建议计算:绿波建议要引用带宽数据
    derived.corridors = this.buildCorridorStates(roadMetrics, params);
    derived.alerts = this.buildAlerts(derived);
    derived.forecast = this.buildForecast(derived);
    derived.recommendations = this.buildRecommendations(derived);
    derived.controlPlan = this.buildControlPlan(derived);
    derived.topology = {
      fingerprint: topo ? topo.fingerprint : "TG-NA",
      nodeCount: topo ? topo.nodeCount : 0,
      edgeCount: topo ? topo.edgeCount : 0,
      corridorCount: topo ? topo.corridors.length : 0,
    };

    return derived;
  }

  // 干线绿波状态:按设计速度推理想时距,再拿现状车速算车队实际到达,
  // 两者的相位错位吃掉绿窗,剩下的就是带宽。策略切换会同时影响两头。
  buildCorridorStates(roadMetrics, params) {
    const seed = this.state.seed;
    const topo = this.topology;
    if (!topo || !topo.corridors.length) return [];

    return topo.corridors.map((corridor) => {
      const memberMetrics = corridor.roadIds.map((id) => roadMetrics[id]).filter(Boolean);
      const avgLoad = memberMetrics.reduce((sum, m) => sum + m.load, 0) / (memberMetrics.length || 1);
      const avgChoke = memberMetrics.reduce((sum, m) => sum + (m.choke || 0), 0) / (memberMetrics.length || 1);

      // 成员路长度,用于把信号锚点换算成沿线里程
      const roadLengths = corridor.roadIds.map((id) => {
        const road = findById(seed.roads, id);
        return road ? routeLength(road.points) : 0;
      });

      const stops = corridor.signalAnchors
        .map((anchor) => ({
          signalId: anchor.signalId,
          cycle: anchor.cycle,
          meter: roadLengths.slice(0, anchor.chainIndex).reduce((sum, v) => sum + v, 0) + roadLengths[anchor.chainIndex] * anchor.ratio,
        }))
        .sort((a, b) => a.meter - b.meter);

      const cycle = stops.length ? Math.round(stops.reduce((sum, s) => sum + s.cycle, 0) / stops.length) : 90;
      // 主向绿窗:基准 38% 周期,绿波策略再放大 signalBias
      const green = Math.round(cycle * 0.38 * (1 + params.signalBias * 0.9));

      // 现状通过速度取成员均速的调和平均:干线跑多快由最慢路段决定
      let inverse = 0;
      for (const metric of memberMetrics) inverse += 1 / Math.max(metric.avgSpeed, 8);
      const currentSpeed = memberMetrics.length ? Math.round(memberMetrics.length / inverse) : corridor.designSpeed;

      let bandwidth = green;
      let worstPair = null;
      if (stops.length >= 2) {
        for (let i = 1; i < stops.length; i++) {
          const gapMeters = stops[i].meter - stops[i - 1].meter;
          if (gapMeters < 40) continue; // 紧挨着的信号当作同一处
          const idealSeconds = (gapMeters / 1000) / (corridor.designSpeed / 3600);
          const actualSeconds = (gapMeters / 1000) / (Math.max(currentSpeed, 15) / 3600);
          // 车队实际到达时刻相对理想时距的相位错位,按周期取圆周距离
          let drift = (actualSeconds - idealSeconds) % cycle;
          if (drift < 0) drift += cycle;
          const error = Math.min(drift, cycle - drift);
          const pairBand = Math.max(0, green - error);
          if (pairBand < bandwidth) {
            bandwidth = pairBand;
            // 断点展示用路口名而不是设备编号,一眼能看懂堵在哪两个路口之间
            const sigFrom = findById(seed.signals, stops[i - 1].signalId);
            const sigTo = findById(seed.signals, stops[i].signalId);
            worstPair = {
              from: stops[i - 1].signalId,
              to: stops[i].signalId,
              fromName: sigFrom ? sigFrom.name.replace("信号控制机", "") : stops[i - 1].signalId,
              toName: sigTo ? sigTo.name.replace("信号控制机", "") : stops[i].signalId,
              driftSeconds: Math.round(error),
            };
          }
        }
      }

      const bandwidthPercent = Math.round((bandwidth / cycle) * 100);
      const bandwidthLabel =
        stops.length < 2
          ? "红绿灯尚未联动"
          : bandwidthPercent >= 55
          ? "绿灯一路顺畅"
          : bandwidthPercent >= 30
          ? "绿灯常被打断"
          : "绿灯很难一路通行";

      return {
        id: corridor.id,
        name: corridor.name,
        lengthKm: (corridor.lengthMeters / 1000).toFixed(1),
        designSpeed: corridor.designSpeed,
        currentSpeed,
        cycle,
        greenWindow: green,
        bandwidthPercent,
        bandwidthLabel,
        avgLoadPercent: Math.round(avgLoad * 100),
        signalCount: stops.length,
        memberCount: corridor.roadIds.length,
        memberNames: corridor.memberNames.slice(0, 3).join(" / "),
        worstPair: worstPair || null,
        // 干线处置优先级:负载为主,咽喉度加权——堵在咽喉上的干线最要命
        urgency: Math.round(avgLoad * 100 * (0.65 + 0.35 * avgChoke)),
        advice:
          stops.length < 2
            ? "沿线的红绿灯还没有统一调配，建议先接入联动控制"
            : bandwidthPercent < 30
            ? "绿灯已经完全对不上，建议切换到一路绿灯方案，并排查最堵路段的排队"
            : bandwidthPercent < 55
            ? "能一路绿灯的时间窗口偏小，建议先放空走得慢的路段，让车队重新排整齐"
            : "一路绿灯的时间窗口足够，保持现状即可",
      };
    });
  }

  buildAlerts(derived) {
    const seed = this.state.seed;

    const eventAlerts = seed.events
      .filter((event) => event.status !== "cleared")
      .map((event) => {
        const road = findById(seed.roads, event.roadId);
        return {
          id: event.id,
          title: event.name,
          severity: event.severity,
          level: severityLevel(event.severity),
          category: event.category,
          roadName: roadName(road, event.roadId),
          description: event.description,
          owner: event.owner,
          status: event.status,
          entityId: event.id,
        };
      });

    // 离线设备告警最多报 6 条,不然刷屏
    const deviceAlerts = seed.devices
      .filter((device) => device.status === "offline")
      .slice(0, 6)
      .map((device) => {
        const road = findById(seed.roads, device.roadId);
        return {
          id: `ALERT-${device.id}`,
          title: `${device.name}离线`,
          severity: 2,
          level: "warn",
          category: "device",
          roadName: roadName(road, device.roadId),
          description: `${device.coverage} 的 ${device.capability} 数据缺失,建议派单恢复或切换邻近设备补偿。`,
          owner: "设施运维",
          status: "active",
          entityId: device.id,
        };
      });

    // 瓶颈排序不只看饱和度:同样堵,堵在咽喉上的路段波及面更大,优先处置
    const bottleneckAlerts = Object.entries(derived.roadMetrics)
      .filter(([, metric]) => metric.load > 0.86)
      .sort((a, b) => {
        const weightA = a[1].load * (0.62 + 0.38 * (a[1].choke || 0));
        const weightB = b[1].load * (0.62 + 0.38 * (b[1].choke || 0));
        return weightB - weightA;
      })
      .slice(0, 5)
      .map(([roadId, metric]) => {
        const road = findById(seed.roads, roadId);
        const chokeNote =
          metric.chokeRank >= 0.7
            ? `该路段为路网咽喉(介数中心性全网前 ${Math.round((1 - metric.chokeRank) * 100)}%),失效将迫使大量最短路径绕行,`
            : "";
        return {
          id: `ALERT-${roadId}`,
          title: `${roadName(road, roadId)}饱和度过高`,
          severity: metric.load > 0.93 ? 3 : 2,
          level: metric.load > 0.93 ? "danger" : "warn",
          category: "congestion",
          roadName: roadName(road, roadId),
          description: `饱和度 ${Math.round(metric.load * 100)}%,排队约 ${metric.queueLength}m,${chokeNote}建议上游截流与诱导绕行。`,
          owner: "指挥中心",
          status: "active",
          entityId: roadId,
        };
      });

    return [...eventAlerts, ...deviceAlerts, ...bottleneckAlerts].sort((a, b) => b.severity - a.severity);
  }

  buildForecast(derived) {
    const seed = this.state.seed;
    const activeParams = this.getActiveStrategy().parameters;

    const topRoads = Object.entries(derived.roadMetrics)
      .sort((a, b) => b[1].load - a[1].load)
      .slice(0, 8)
      .map(([roadId, metric]) => {
        const road = findById(seed.roads, roadId);
        return {
          id: roadId,
          name: roadName(road, roadId),
          load: Math.round(metric.load * 100),
          queueLength: metric.queueLength,
          avgSpeed: Math.round(metric.avgSpeed),
        };
      });

    const congestion = derived.metrics[0].value;
    const risk = derived.health.riskIndex;
    const confidence = derived.health.modelConfidence;
    const tick = this.state.meta.tick;

    // 5/15/30min 三个时域,越远置信度越低
    const horizons = [5, 15, 30].map((minutes, index) => ({
      minutes,
      congestionIndex: Math.round(clamp(congestion + index * 4 + Math.sin(tick / 7 + index) * 5 - activeParams.incidentRelief * 18, 1, 99)),
      avgSpeed: Math.round(clamp(derived.metrics[1].value - index * 2 + activeParams.signalBias * 12, 8, 68)),
      alertRisk: Math.round(clamp(risk + index * 6 - confidence * 0.08, 1, 99)),
      confidence: Math.round(clamp(confidence - index * 5, 58, 96)),
    }));

    return {
      generatedAt: Date.now(),
      horizons,
      bottlenecks: topRoads,
      scenario: {
        noAction: Math.round(clamp(congestion + 10 + derived.health.eventPressure * 4, 1, 99)),
        withControl: Math.round(clamp(congestion - activeParams.signalBias * 36 - activeParams.incidentRelief * 28, 1, 99)),
        savedDelayMinutes: Math.round(12 + activeParams.signalBias * 80 + activeParams.incidentRelief * 120),
      },
    };
  }

  buildRecommendations(derived) {
    const seed = this.state.seed;
    const activeStrategyId = this.state.control.activeStrategy;
    const activeParams = this.getActiveStrategy().parameters;
    const recommendations = [];

    // 绿波建议优先指向"堵在咽喉上的干线",而不是单条最堵的路
    const worstCorridor = (derived.corridors || []).slice().sort((a, b) => b.urgency - a.urgency)[0] || null;

    // 最堵的一条路 -> 兜底绿波建议
    let topRoad = null;
    for (const entry of Object.entries(derived.roadMetrics)) {
      if (!topRoad || entry[1].load > topRoad[1].load) topRoad = entry;
    }
    const criticalEvent = seed.events.find((e) => e.status !== "cleared" && e.severity >= 2) || null;
    const offlineDevice = seed.devices.find((d) => d.status === "offline") || null;

    let delayedStop = null;
    for (const stop of seed.stops) {
      if (!delayedStop || stop.passengerLoad > delayedStop.passengerLoad) delayedStop = stop;
    }

    if (worstCorridor) {
      // 指令目标取干线上负载最高的成员路,下发后整条干线进入协调
      let worstMemberId = worstCorridor.id;
      let worstMemberLoad = -1;
      for (const roadId of (this.topology.corridors.find((c) => c.id === worstCorridor.id) || { roadIds: [] }).roadIds) {
        const metric = derived.roadMetrics[roadId];
        if (metric && metric.load > worstMemberLoad) {
          worstMemberLoad = metric.load;
          worstMemberId = roadId;
        }
      }
      recommendations.push({
        id: "REC-GREEN-WAVE",
        commandType: "SIGNAL_GREEN_WAVE",
        targetId: worstMemberId,
        title: `启用 ${worstCorridor.name}绿波协调`,
        description: `干线 ${worstCorridor.memberCount} 段 / ${worstCorridor.signalCount} 处信号,当前带宽 ${worstCorridor.bandwidthPercent}%(${worstCorridor.bandwidthLabel}),现状均速 ${worstCorridor.currentSpeed} km/h 低于设计值 ${worstCorridor.designSpeed} km/h,车队已离散。`,
        impact: `预计带宽提升至 ${Math.min(72, Math.round(worstCorridor.bandwidthPercent * 1.5 + 14))}%`,
        status: activeStrategyId === "green_wave" ? "执行中" : "待下发",
      });
    } else if (topRoad) {
      const [roadId, metric] = topRoad;
      const road = findById(seed.roads, roadId);
      recommendations.push({
        id: "REC-GREEN-WAVE",
        commandType: "SIGNAL_GREEN_WAVE",
        targetId: roadId,
        title: `启用 ${roadName(road, roadId)} 绿波协调`,
        description: `当前饱和度 ${Math.round(metric.load * 100)}%,可对相关信号组扩大主向绿信比并压缩排队。`,
        impact: `预计 ${15 + Math.round(activeParams.signalBias * 40)} 分钟内拥堵指数下降 4-9%`,
        status: activeStrategyId === "green_wave" ? "执行中" : "待下发",
      });
    }

    if (criticalEvent) {
      recommendations.push({
        id: "REC-INCIDENT",
        commandType: "INCIDENT_RESPONSE",
        targetId: criticalEvent.id,
        title: `联动处置 ${criticalEvent.name}`,
        description: "自动生成截流、绕行、现场派单和公众诱导消息,形成事件处置闭环。",
        impact: "预计风险等级下降 1 级,排队长度下降 10-18%",
        status: activeStrategyId === "incident_response" ? "执行中" : "待下发",
      });
    }

    if (offlineDevice) {
      recommendations.push({
        id: "REC-DEVICE",
        commandType: "DEVICE_REPAIR",
        targetId: offlineDevice.id,
        title: `派单恢复 ${offlineDevice.name}`,
        description: "启用邻近感知补偿,同时向运维系统推送设备工单。",
        impact: "预计模型置信度提升 1-3%",
        status: "待下发",
      });
    }

    if (delayedStop) {
      recommendations.push({
        id: "REC-TRANSIT",
        commandType: "TRANSIT_PRIORITY",
        targetId: delayedStop.id,
        title: `对 ${delayedStop.name} 启用公交优先`,
        description: `站点客流 ${delayedStop.passengerLoad} 人次,建议提高公交相位权重并触发到站预测联动。`,
        impact: "预计公交准点率提升 3-6%",
        status: activeStrategyId === "transit_priority" ? "执行中" : "待下发",
      });
    }

    return recommendations;
  }

  buildControlPlan(derived) {
    const strategy = this.getActiveStrategy();
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      description: strategy.description,
      layers: [
        { name: "信号控制", value: Math.round(60 + strategy.parameters.signalBias * 190), status: "自适应配时" },
        { name: "公交优先", value: Math.round(48 + strategy.parameters.busPriority * 210), status: "相位加权" },
        { name: "事件处置", value: Math.round(42 + strategy.parameters.incidentRelief * 250), status: "诱导截流" },
        { name: "数据置信", value: derived.health.modelConfidence, status: "多源融合" },
      ],
      lastCommands: this.state.control.commandLog.slice(0, 8),
    };
  }

  // 实体详情里的语义关系,按实体类型各建一套
  buildRelations() {
    const seed = this.state.seed;
    const relationMap = {};
    const roadOf = (id) => findById(seed.roads, id);

    for (const road of seed.roads) {
      const deviceList = seed.devices.filter((device) => device.roadId === road.id).slice(0, 6);
      const eventList = seed.events.filter((event) => event.roadId === road.id && event.status !== "cleared");
      const relationRows = [
        { predicate: "道路等级", object: roadClassLabel(road) },
        { predicate: "设计通行能力", object: `${road.capacity || 0} pcu/h` },
      ];

      // 拓扑关系:邻接路段 + 干线归属,均来自路网拓扑层
      const neighbors = this.neighborRoads(road.id);
      if (neighbors.length) {
        // 同名分段去重,展示最多 3 条不同道路
        const seenNames = new Set();
        const names = [];
        for (const n of neighbors) {
          const name = roadName(roadOf(n.roadId), n.roadId);
          if (seenNames.has(name)) continue;
          seenNames.add(name);
          names.push(name);
          if (names.length >= 3) break;
        }
        relationRows.push({ predicate: "拓扑邻接", object: names.join("、") });
      }
      const ownerCorridor = (this.topology ? this.topology.corridors : []).find((c) => c.roadIds.indexOf(road.id) >= 0);
      if (ownerCorridor) relationRows.push({ predicate: "干线归属", object: ownerCorridor.name });

      relationMap[road.id] = relationRows
        .concat(deviceList.map((device) => ({ predicate: "被感知设备覆盖", object: device.name })))
        .concat(eventList.map((event) => ({ predicate: "受事件影响", object: event.name })));
    }

    for (const intersection of seed.intersections) {
      const relations = intersection.connectedRoads.map((roadId) => {
        const road = roadOf(roadId);
        return { predicate: "连接道路", object: roadName(road, roadId) };
      });
      const signal = seed.signals.find((s) => s.intersectionId === intersection.id);
      if (signal) relations.push({ predicate: "受控于", object: signal.name });
      relationMap[intersection.id] = relations;
    }

    for (const stop of seed.stops) {
      relationMap[stop.id] = [
        { predicate: "服务线路", object: stop.line },
        { predicate: "位于道路", object: roadName(roadOf(stop.roadId), stop.roadId) },
        { predicate: "站点客流", object: `${stop.passengerLoad} 人次` },
      ];
    }

    for (const device of seed.devices) {
      relationMap[device.id] = [
        { predicate: "监测道路", object: roadName(roadOf(device.roadId), device.roadId) },
        { predicate: "能力类型", object: device.capability },
        { predicate: "采样频率", object: device.sampleRate },
      ];
    }

    for (const signal of seed.signals) {
      const intersection = findById(seed.intersections, signal.intersectionId);
      relationMap[signal.id] = [
        { predicate: "控制路口", object: intersection ? intersection.name : signal.intersectionId },
        { predicate: "当前相位", object: signal.currentPhase },
        { predicate: "协调组", object: signal.coordinationGroup },
      ];
    }

    for (const vehicle of seed.fleet) {
      relationMap[vehicle.id] = [
        { predicate: "行驶道路", object: roadName(roadOf(vehicle.roadId), vehicle.roadId) },
        { predicate: "优先级", object: vehicle.priority },
        { predicate: "车路协同", object: vehicle.priority === "general" ? "基础定位" : "优先通行" },
      ];
    }

    for (const event of seed.events) {
      relationMap[event.id] = [
        { predicate: "影响道路", object: roadName(roadOf(event.roadId), event.roadId) },
        { predicate: "事件类别", object: event.category },
        { predicate: "处置责任", object: event.owner || "指挥中心" },
      ];
    }

    for (const zone of seed.zones) {
      relationMap[zone.id] = [
        { predicate: "覆盖道路", object: `${zone.roads.length} 条` },
        { predicate: "需求指数", object: `${zone.demandIndex}%` },
        { predicate: "停车压力", object: `${zone.parkingPressure}%` },
      ];
    }

    return relationMap;
  }

  buildEntities() {
    const seed = this.state.seed;
    const derived = this.state.derived;
    const relations = this.buildRelations();
    const entities = [];
    const roadOf = (id) => findById(seed.roads, id);

    for (const road of seed.roads) {
      const metric = derived.roadMetrics[road.id];
      entities.push({
        id: road.id,
        name: road.name,
        type: "roadSegment",
        displayType: "roadSegment",
        status: metric.load > 0.84 ? "degraded" : "online",
        description: `${roadClassLabel(road)} / ${road.tags.join(" / ")}`,
        severity: metric.load > 0.88 ? 3 : metric.load > 0.72 ? 2 : 1,
        stats: {
          车道数: `${road.laneCount} 车道`,
          限速: `${road.speedLimit} km/h`,
          饱和度: `${Math.round(metric.load * 100)}%`,
          排队长度: `${metric.queueLength} m`,
          咽喉度: `介数 ${Math.round((metric.chokeRank || 0) * 100)} 分位`,
        },
        relations: relations[road.id] || [],
        searchable: `${road.name} ${road.tags.join(" ")} ${road.functionalClass}`,
        geometry: { points: road.points },
      });
    }

    for (const intersection of seed.intersections) {
      const signal = seed.signals.find((s) => s.intersectionId === intersection.id);
      entities.push({
        id: intersection.id,
        name: intersection.name,
        type: "intersection",
        displayType: "intersection",
        status: signal && signal.currentColor === "red" ? "monitoring" : "online",
        description: `${intersection.controlMode} 控制 / ${intersection.approachCount} 进口道`,
        severity: signal && signal.currentColor === "red" ? 2 : 1,
        stats: {
          控制模式: intersection.controlMode,
          连接道路: `${intersection.connectedRoads.length} 条`,
          当前相位: signal ? signal.currentPhase : "none",
        },
        relations: relations[intersection.id] || [],
        searchable: `${intersection.name} ${intersection.controlMode}`,
        geometry: { position: intersection.position },
      });
    }

    for (const stop of seed.stops) {
      entities.push({
        id: stop.id,
        name: stop.name,
        type: "transitStop",
        displayType: "transitStop",
        status: stop.passengerLoad > 120 ? "monitoring" : "online",
        description: `${stop.line} 智慧站点`,
        severity: stop.passengerLoad > 130 ? 2 : 1,
        stats: {
          服务线路: stop.line,
          站点客流: `${stop.passengerLoad} 人次`,
          停站时间: `${stop.dwellSeconds} s`,
        },
        relations: relations[stop.id] || [],
        searchable: `${stop.name} ${stop.line}`,
        geometry: { position: stop.position },
      });
    }

    for (const device of seed.devices) {
      entities.push({
        id: device.id,
        name: device.name,
        type: "sensor",
        displayType: device.type,
        status: device.status,
        description: `${device.coverage} 覆盖`,
        severity: device.status === "offline" ? 3 : device.status === "degraded" ? 2 : 1,
        stats: {
          能力: device.capability,
          延迟: `${device.latencyMs} ms`,
          健康度: `${device.healthScore}%`,
        },
        relations: relations[device.id] || [],
        searchable: `${device.name} ${device.type} ${device.coverage} ${device.capability}`,
        geometry: { position: device.position },
      });
    }

    for (const signal of seed.signals) {
      entities.push({
        id: signal.id,
        name: signal.name,
        type: "signalController",
        displayType: "signalController",
        status: signal.currentColor === "red" ? "monitoring" : "online",
        description: `当前相位 ${signal.currentPhase}`,
        severity: signal.currentColor === "red" ? 2 : 1,
        state: signal.currentPhase,
        stats: {
          相位: signal.currentPhase,
          周期: `${signal.cycleLength} s`,
          协调组: signal.coordinationGroup,
        },
        relations: relations[signal.id] || [],
        searchable: `${signal.name} ${signal.currentPhase} ${signal.coordinationGroup}`,
        geometry: { position: signal.position },
      });
    }

    for (const vehicle of seed.fleet) {
      const road = roadOf(vehicle.roadId);
      entities.push({
        id: vehicle.id,
        name: vehicle.name,
        type: "vehicle",
        displayType: vehicle.subType === "bus" ? "bus" : vehicle.priority === "emergency" ? "emergencyVehicle" : vehicle.subType === "truck" ? "logisticsVehicle" : "vehicle",
        subType: vehicle.subType,
        priority: vehicle.priority,
        status: vehicle.status,
        description: `${roadName(road, vehicle.roadId)} 运行中`,
        severity: vehicle.priority === "emergency" || vehicle.delayMinutes > 3 ? 2 : 1,
        stats: {
          速度: `${Math.round(vehicle.effectiveSpeed || vehicle.speed)} km/h`,
          优先级: vehicle.priority,
          延误: `${Number(vehicle.delayMinutes || 0).toFixed(1)} min`,
        },
        relations: relations[vehicle.id] || [],
        searchable: `${vehicle.name} ${vehicle.priority} ${vehicle.subType} ${roadName(road, vehicle.roadId)}`,
        geometry: { position: vehicle.position, route: vehicle.route },
      });
    }

    for (const event of seed.events) {
      const road = roadOf(event.roadId);
      entities.push({
        id: event.id,
        name: event.name,
        type: "incident",
        displayType: "incident",
        status: event.status,
        description: event.description,
        severity: event.status === "cleared" ? 1 : event.severity,
        stats: {
          类别: event.category,
          风险等级: `S${event.severity}`,
          影响道路: roadName(road, event.roadId),
          责任单位: event.owner || "指挥中心",
        },
        relations: relations[event.id] || [],
        searchable: `${event.name} ${event.category} ${event.description} ${roadName(road, event.roadId)}`,
        geometry: { position: event.position },
      });
    }

    for (const zone of seed.zones) {
      entities.push({
        id: zone.id,
        name: zone.name,
        type: "trafficZone",
        displayType: "trafficZone",
        status: zone.demandIndex > 78 ? "monitoring" : "online",
        description: "交通需求分区",
        severity: zone.demandIndex > 82 ? 2 : 1,
        stats: {
          需求指数: `${zone.demandIndex}%`,
          停车压力: `${zone.parkingPressure}%`,
          慢行客流: `${zone.pedestrianFlow} 人次/h`,
        },
        relations: relations[zone.id] || [],
        searchable: `${zone.name} 需求 分区 停车 慢行`,
        geometry: { position: zone.position },
      });
    }

    return entities;
  }

  buildSemanticGraph() {
    const seed = this.state.seed;
    const nodes = [];
    const edges = [];
    const hasNode = (id) => nodes.some((node) => node.id === id);

    // 只放重要道路和异常要素,不然图太密没法看
    const rankedRoads = seed.roads.slice().sort(byRankDesc);
    for (const road of rankedRoads.slice(0, 18)) {
      const metric = this.state.derived.roadMetrics[road.id];
      nodes.push({ id: road.id, label: road.name, type: "roadSegment", severity: metric.load > 0.82 ? 3 : metric.load > 0.68 ? 2 : 1 });
    }

    for (const intersection of seed.intersections.slice(0, 12)) {
      nodes.push({ id: intersection.id, label: intersection.name.replace("协同路口", ""), type: "intersection", severity: 1 });
      for (const roadId of intersection.connectedRoads) {
        if (hasNode(roadId)) edges.push({ source: intersection.id, target: roadId, predicate: "连接", weight: 2 });
      }
    }

    const abnormalDevices = seed.devices.filter((device) => device.status !== "online");
    for (const device of abnormalDevices.slice(0, 8)) {
      nodes.push({
        id: device.id,
        label: device.name.replace("视频结构化相机", "相机").replace("毫米波雷达", "雷达"),
        type: "sensor",
        severity: device.status === "offline" ? 3 : 2,
      });
      if (hasNode(device.roadId)) edges.push({ source: device.id, target: device.roadId, predicate: "监测", weight: 2 });
    }

    for (const event of seed.events) {
      if (event.status === "cleared") continue;
      nodes.push({ id: event.id, label: event.name, type: "incident", severity: event.severity });
      if (hasNode(event.roadId)) edges.push({ source: event.id, target: event.roadId, predicate: "影响", weight: event.severity });
    }

    for (const signal of seed.signals.slice(0, 8)) {
      nodes.push({ id: signal.id, label: signal.name.replace("信号控制机", ""), type: "signalController", severity: signal.currentColor === "red" ? 2 : 1 });
      edges.push({ source: signal.id, target: signal.intersectionId, predicate: "控制", weight: 2 });
    }

    return { nodes, edges };
  }

  pushHistorySnapshot(reason) {
    const metrics = this.state.derived.metrics || [];
    const frame = {
      tick: this.state.meta.tick,
      clockLabel: formatClock(this.state.meta.clockMinutes),
      reason,
      congestionIndex: metrics[0] ? metrics[0].value : 0,
      avgSpeed: metrics[1] ? metrics[1].value : 0,
      onlineRate: metrics[2] ? metrics[2].value : 0,
      punctuality: metrics[3] ? metrics[3].value : 0,
      criticalAlerts: metrics[4] ? metrics[4].value : 0,
      confidence: metrics[5] ? metrics[5].value : 0,
      playback: this.state.meta.playback,
      strategy: this.state.control.activeStrategy,
      recordedAt: Date.now(),
    };
    this.state.history.unshift(frame);

    if (this.state.history.length > this.maxHistory) this.state.history.length = this.maxHistory;
    this.state.meta.historySamples = this.state.history.length;

    // 指标帧同步写进台账,库里留最近 600 帧,内存里还是 180 帧
    if (this.store) this.store.appendHistory(frame);
  }

  refresh(reason) {
    this.state.derived = this.computeDerived();
    this.state.entities = this.buildEntities();
    this.state.entityMap = {};
    for (const entity of this.state.entities) {
      this.state.entityMap[entity.id] = entity;
    }
    this.state.semanticGraph = this.buildSemanticGraph();
    this.state.meta.streamVersion += 1;
    this.pushHistorySnapshot(reason || "refresh");
    this.emit(reason || "refresh");
  }

  tick(seconds) {
    if (this.state.meta.playback !== "running") {
      this.refresh("paused-refresh");
      return;
    }

    this.state.meta.tick += 1;
    this.state.meta.clockMinutes += seconds / 6;
    this.state.meta.lastTickAt = Date.now();

    const strategy = this.getActiveStrategy();
    const seed = this.state.seed;

    // 信号机走相位,绿灯按策略加时
    for (const signal of seed.signals) {
      signal.elapsed += seconds * (1 + strategy.parameters.signalBias * 0.2);
      let current = signal.phases[signal.phaseIndex];
      const greenBonus = current.color === "green" ? strategy.parameters.signalBias * 8 : 0;
      if (signal.elapsed >= current.duration + greenBonus) {
        signal.elapsed = 0;
        signal.phaseIndex = (signal.phaseIndex + 1) % signal.phases.length;
        current = signal.phases[signal.phaseIndex];
      }
      signal.currentPhase = current.code;
      signal.currentColor = current.color;
    }

    // 车辆按有效速度推进,同路事件越多越慢
    seed.fleet.forEach((vehicle, index) => {
      let incidentPenalty = 0;
      for (const event of seed.events) {
        if (event.roadId === vehicle.roadId && event.status !== "cleared") incidentPenalty += event.severity;
      }
      const paceFactor = clamp(1 - incidentPenalty * 0.06 + strategy.parameters.incidentRelief * 0.18, 0.55, 1.15);
      vehicle.progress += ((vehicle.effectiveSpeed || vehicle.speed) / vehicle.routeLength / 7.4) * paceFactor * seconds;
      vehicle.position = pointAlongRoute(vehicle.route, vehicle.progress);

      if (vehicle.subType === "bus" || vehicle.priority === "transit") {
        // 公交延误小幅漂移,公交优先策略能压下来
        const delayDrift = index % 2 === 0 ? 0.025 : -0.018;
        vehicle.delayMinutes = clamp((vehicle.delayMinutes || 0) + delayDrift - strategy.parameters.busPriority * 0.035, 0, 7);
      }
    });

    // 事件等级随时间波动
    seed.events.forEach((event, index) => {
      if (event.status === "cleared") return;
      event.pulse += seconds * 0.8;
      if (event.category === "congestion") {
        event.severity = clamp(2 + Math.round((Math.sin(this.state.meta.tick / 4 + index) + 1) / 2), 1, 3);
      }
      if (event.category === "construction") {
        event.severity = this.state.meta.tick % 18 > 12 ? 3 : 2;
      }
      if (event.category === "device") {
        const vms = findById(seed.devices, "D-VMS-01");
        const vmsOffline = Boolean(vms && vms.status === "offline");
        event.severity = vmsOffline ? 2 : 1;
        if (event.severity === 1) event.status = "monitoring";
      }
    });

    // 每 20 个 tick 抽查一次设备健康,在线的偶尔降级、降级的偶尔恢复
    if (this.state.meta.tick % 20 === 0) {
      seed.devices.forEach((device, index) => {
        if (device.id === "D-VMS-01" && device.status === "offline") return;
        const pulse = seeded01(`${device.id}-${this.state.meta.tick}`);
        if (device.status === "online" && pulse > 0.93 && index % 3 === 0) {
          device.status = "degraded";
          device.healthScore = clamp(device.healthScore - 16, 42, 96);
        } else if (device.status === "degraded" && pulse > 0.45) {
          device.status = "online";
          device.healthScore = clamp(device.healthScore + 12, 70, 98);
        }
      });
    }

    this.refresh("tick");

    // 检查点节流落盘:每 12 拍存一次,最坏丢 12 秒现场,换来磁盘安生
    if (this.store && this.state.meta.tick % 12 === 0) this.persistCheckpoint();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick(this.state.meta.tickIntervalSeconds);
    }, this.state.meta.tickIntervalSeconds * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 停机前把现场刷进库,下次启动从这里接着跑
    this.persistCheckpoint();
  }

  togglePlayback() {
    this.state.meta.playback = this.state.meta.playback === "running" ? "paused" : "running";
    this.refresh("toggle-playback");
    this.persistCheckpoint();
    return { playback: this.state.meta.playback };
  }

  setStrategy(strategyId) {
    const strategy = this.state.control.strategies.find((s) => s.id === strategyId);
    if (!strategy) {
      const error = new Error("Unknown strategy");
      error.status = 404;
      throw error;
    }
    this.state.control.activeStrategy = strategyId;
    this.addCommandLog({
      type: "STRATEGY_SWITCH",
      targetId: strategyId,
      title: `切换策略:${strategy.name}`,
      status: "completed",
      impact: strategy.description,
    });
    this.refresh("strategy-change");
    this.persistCheckpoint();
    return this.getControlState();
  }

  executeCommand(payload) {
    const commandType = payload.commandType || payload.type || "MANUAL";
    const targetId = payload.targetId || payload.id || "";
    let title = payload.title || "人工调度指令";
    let impact = payload.impact || "已写入指挥调度日志";

    switch (commandType) {
      case "SIGNAL_GREEN_WAVE":
        this.state.control.activeStrategy = "green_wave";
        title = title || "启用干线绿波";
        impact = "已提升相关协调组主向绿信比";
        break;
      case "TRANSIT_PRIORITY":
        this.state.control.activeStrategy = "transit_priority";
        impact = "已对公交优先请求增加相位权重";
        break;
      case "INCIDENT_RESPONSE":
        this.state.control.activeStrategy = "incident_response";
        {
          const event = findById(this.state.seed.events, targetId);
          if (event) {
            event.status = "monitoring";
            event.severity = clamp(event.severity - 1, 1, 3);
          }
        }
        impact = "已生成事件联动处置、绕行诱导与现场派单";
        break;
      case "DEVICE_REPAIR":
        {
          const device = findById(this.state.seed.devices, targetId);
          if (device) {
            device.status = "online";
            device.healthScore = Math.max(device.healthScore, 92);
          }
          // 设备修好了,顺带把设备类事件转监测
          const event = this.state.seed.events.find((e) => e.category === "device");
          if (event) {
            event.status = "monitoring";
            event.severity = 1;
          }
        }
        impact = "已恢复设备状态并启用数据质量回补";
        break;
      case "DEMAND_DIVERSION":
        this.state.control.activeStrategy = "demand_balance";
        impact = "已对停车、公交接驳与外围诱导进行削峰";
        break;
    }

    const log = this.addCommandLog({
      type: commandType,
      targetId,
      title,
      status: "completed",
      impact,
    });

    this.refresh("command-executed");
    this.persistCheckpoint();
    return { command: log, control: this.getControlState() };
  }

  addCommandLog(entry) {
    this.state.control.commandSeq += 1;
    const log = {
      id: `CMD-${pad(this.state.control.commandSeq, 4)}`,
      at: Date.now(),
      clockLabel: formatClock(this.state.meta.clockMinutes),
      operator: "数字孪生调度引擎",
      ...entry,
    };
    this.state.control.commandLog.unshift(log);
    if (this.state.control.commandLog.length > 80) this.state.control.commandLog.length = 80;
    // 指令是审计证据,除了内存日志再追加一份到台账
    if (this.store) this.store.appendCommand(log);
    return log;
  }

  resolveAlert(id) {
    const event = findById(this.state.seed.events, id);
    if (event) {
      event.status = "cleared";
      event.severity = 1;
      this.addCommandLog({
        type: "ALERT_RESOLVE",
        targetId: id,
        title: `解除告警:${event.name}`,
        status: "completed",
        impact: "事件状态已闭环归档",
      });
      this.refresh("alert-resolved");
      this.persistCheckpoint();
      return { resolved: true, id };
    }

    // 告警 id 带 ALERT- 前缀,解出来是设备 id
    const device = findById(this.state.seed.devices, id.replace(/^ALERT-/, ""));
    if (device) {
      device.status = "online";
      device.healthScore = Math.max(device.healthScore, 90);
      this.addCommandLog({
        type: "DEVICE_REPAIR",
        targetId: device.id,
        title: `恢复设备:${device.name}`,
        status: "completed",
        impact: "设备告警已关闭",
      });
      this.refresh("device-resolved");
      this.persistCheckpoint();
      return { resolved: true, id };
    }

    return { resolved: false, id };
  }

  // 管理接口用:放弃当前现场,按原始种子重建场景,台账全量重写
  resetToSeed() {
    this.stop();
    this.state.seed = clone(this.originSeed);
    this.state.meta.tick = 0;
    this.state.meta.clockMinutes = 8 * 60 + 5;
    this.state.meta.playback = "running";
    this.state.meta.startedAt = Date.now();
    this.state.meta.streamVersion = 0;
    this.state.meta.historySamples = 0;
    this.state.control.activeStrategy = "balanced";
    this.state.control.commandSeq = 0;
    this.state.control.commandLog = [];
    this.state.history = [];

    this.prepareSeed();
    this.topology = this.buildTopology(this.state.seed);
    this.seedRuntimeDefaults();
    if (this.store) this.store.resetScene(this.state.seed, this.topology.fingerprint);

    this.refresh("scene-reset");
    this.start();
    return { reset: true, fingerprint: this.topology.fingerprint, entities: this.state.entities.length };
  }

  getOverview() {
    return {
      scenarioName: this.state.seed.scenarioName || "大规模语义化交通全要素数字孪生体建模系统",
      metadata: clone(this.state.seed.metadata),
      meta: {
        tick: this.state.meta.tick,
        playback: this.state.meta.playback,
        clockMinutes: this.state.meta.clockMinutes,
        clockLabel: formatClock(this.state.meta.clockMinutes),
        uptimeSeconds: Math.floor((Date.now() - this.state.meta.startedAt) / 1000),
        tickIntervalSeconds: this.state.meta.tickIntervalSeconds,
        streamVersion: this.state.meta.streamVersion,
        historySamples: this.state.meta.historySamples,
      },
      derived: clone(this.state.derived),
      control: this.getControlState(),
      backend: {
        service: "本地仿真服务",
        dataSource: "虚构路网 + 程序生成 + 实时推演",
        persistence: this.store ? "sqlite" : "memory",
        apiVersion: "v3",
        stream: "/socket.io",
      },
    };
  }

  getMapSnapshot() {
    return {
      scenarioName: this.state.seed.scenarioName,
      meta: {
        tick: this.state.meta.tick,
        playback: this.state.meta.playback,
        clockLabel: formatClock(this.state.meta.clockMinutes),
      },
      roads: clone(this.state.seed.roads),
      intersections: clone(this.state.seed.intersections),
      stops: clone(this.state.seed.stops),
      devices: clone(this.state.seed.devices),
      signals: clone(this.state.seed.signals),
      fleet: clone(this.state.seed.fleet),
      events: clone(this.state.seed.events),
      zones: clone(this.state.seed.zones),
      roadMetrics: clone(this.state.derived.roadMetrics),
    };
  }

  getEntities(filter, search) {
    const keyword = (search || "").trim().toLowerCase();
    const items = this.state.entities.filter((entity) => {
      const matchesFilter = !filter || filter === "all" || entity.type === filter;
      const matchesSearch = !keyword || entity.searchable.toLowerCase().indexOf(keyword) >= 0;
      return matchesFilter && matchesSearch;
    });

    items.sort((a, b) => (b.severity || 0) - (a.severity || 0) || a.name.localeCompare(b.name, "zh-CN"));
    return { total: items.length, items: clone(items) };
  }

  getEntityById(id) {
    return this.state.entityMap[id] ? clone(this.state.entityMap[id]) : null;
  }

  // ---------- 因果解释器 ----------
  // 与 getEntityById 的区别:那个回答"是什么",这里回答"为什么"——
  // 归因分量、传播链、证据和可执行建议,全部由当前实时状态推导,不落库。

  explainEntity(id) {
    const entity = this.state.entityMap[id];
    if (!entity) return null;

    const common = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      displayType: entity.displayType,
      clockLabel: formatClock(this.state.meta.clockMinutes),
      generatedAt: Date.now(),
      fingerprint: this.topology ? this.topology.fingerprint : "TG-NA",
    };

    if (entity.type === "roadSegment") return Object.assign(common, this.explainRoad(id));
    if (entity.type === "vehicle") return Object.assign(common, this.explainVehicle(id));
    if (entity.type === "incident") return Object.assign(common, this.explainIncident(id));
    if (entity.type === "sensor") return Object.assign(common, this.explainDevice(id));
    if (entity.type === "intersection" || entity.type === "signalController") return Object.assign(common, this.explainSignalSide(id, entity.type));
    return Object.assign(common, this.explainBrief(id, entity));
  }

  // 道路归因:把负载拆回各个分量,按占比排序,负分量单独作为"策略缓解"呈现
  roadAttribution(roadId) {
    const metric = this.state.derived.roadMetrics[roadId];
    if (!metric || !metric.components) return { factors: [], mitigation: null };

    const labels = {
      base: "路网底载",
      classPressure: "道路等级吸引",
      tide: "潮汐波动",
      flowLoad: "车流占用",
      event: "事件冲击",
    };
    const entries = Object.entries(metric.components).filter(([key, value]) => key !== "relief" && value > 0.015);
    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;

    const factors = entries
      .map(([key, value]) => ({
        key,
        label: labels[key] || key,
        share: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 4);

    const relief = -metric.components.relief;
    const mitigation = relief > 0.01 ? { label: "策略缓解", share: Math.round((relief / total) * 100) } : null;
    return { factors, mitigation };
  }

  // 拓扑邻居:与本路段共享端点的其他路段,因果传播链的骨架
  neighborRoads(roadId) {
    if (!this.topology) return [];
    const edge = this.topology.graph.edges.get(roadId);
    if (!edge) return [];

    const seen = new Set([roadId]);
    const list = [];
    for (const nodeId of [edge.from, edge.to]) {
      for (const link of this.topology.graph.adjacency.get(nodeId)) {
        if (seen.has(link.roadId)) continue;
        seen.add(link.roadId);
        const metric = this.state.derived.roadMetrics[link.roadId];
        list.push({ roadId: link.roadId, load: metric ? metric.load : 0 });
      }
    }
    return list;
  }

  explainRoad(roadId) {
    const seed = this.state.seed;
    const metric = this.state.derived.roadMetrics[roadId];
    const road = findById(seed.roads, roadId);
    if (!road || !metric) {
      return { summary: "该路段暂无实时指标。", factors: [], chain: [], evidence: [], actions: [] };
    }

    const { factors, mitigation } = this.roadAttribution(roadId);
    const neighbors = this.neighborRoads(roadId)
      .map((n) => {
        const neighborRoad = findById(seed.roads, n.roadId);
        return { roadId: n.roadId, load: n.load, name: roadName(neighborRoad, n.roadId) };
      })
      .sort((a, b) => b.load - a.load);

    // 传播链:谁把压力传过来(hop 正数),压力还能往哪撒(hop 负数)
    const upstream = neighbors.filter((n) => n.load > metric.load + 0.06).slice(0, 3);
    const spillTargets = neighbors.filter((n) => n.load < metric.load - 0.06).slice(0, 2);
    const chain = upstream.map((n, i) => ({ hop: i + 1, id: n.roadId, name: n.name, relation: "上游传导", load: Math.round(n.load * 100) }));
    chain.push({ hop: 0, id: roadId, name: road.name, relation: "当前路段", load: Math.round(metric.load * 100) });
    spillTargets.forEach((n, i) => chain.push({ hop: -(i + 1), id: n.roadId, name: n.name, relation: "可分流去向", load: Math.round(n.load * 100) }));

    // 证据:本段事件、邻段事件、感知缺口
    const evidence = [];
    for (const event of seed.events) {
      if (event.status === "cleared") continue;
      if (event.roadId === roadId) evidence.push({ kind: "event", text: `${event.name}:等级 S${event.severity},状态 ${event.status}` });
      else if (neighbors.some((n) => n.roadId === event.roadId)) evidence.push({ kind: "adjacent-event", text: `邻段 ${event.name}:等级 S${event.severity},可能向本段传导` });
    }
    const devices = seed.devices.filter((d) => d.roadId === roadId);
    const onlineDevices = devices.filter((d) => d.status === "online").length;
    const sensingGap = devices.length - onlineDevices;
    if (devices.length) {
      evidence.push({ kind: "sensing", text: `感知覆盖 ${onlineDevices}/${devices.length} 台在线${sensingGap ? `,${sensingGap} 台异常,本段数据置信度下降` : ",数据完整"}` });
    }

    const actions = [];
    if (metric.components.event > 0.05) {
      const target = seed.events.find((e) => e.roadId === roadId && e.status !== "cleared");
      actions.push({ commandType: "INCIDENT_RESPONSE", targetId: target ? target.id : roadId, text: "对沿线事件启动联动处置,消除冲击源" });
    }
    if (metric.components.flowLoad > 0.16) {
      actions.push({ commandType: "SIGNAL_GREEN_WAVE", targetId: roadId, text: "申请干线绿波,扩大主向绿窗加速消散" });
    }
    if (metric.chokeRank >= 0.75 && metric.load > 0.7) {
      actions.push({ commandType: "DEMAND_DIVERSION", targetId: roadId, text: "该路段为路网咽喉,建议外围截流保护" });
    }
    if (sensingGap > 0) {
      const broken = devices.find((d) => d.status !== "online");
      actions.push({ commandType: "DEVICE_REPAIR", targetId: broken ? broken.id : roadId, text: `派单修复 ${broken ? broken.name : "异常设备"},恢复感知覆盖` });
    }
    if (!actions.length) actions.push({ commandType: "MANUAL", targetId: roadId, text: "各分量均处于正常区间,维持监测即可" });

    const parts = [];
    parts.push(`${road.name}当前饱和度 ${Math.round(metric.load * 100)}%、均速 ${Math.round(metric.avgSpeed)} km/h`);
    if (factors.length) parts.push(`压力主要来自${factors[0].label}(${factors[0].share}%)`);
    if (upstream.length) parts.push(`${upstream.length} 条上游路段正高压传导`);
    if (metric.chokeRank >= 0.75) parts.push(`该路段为路网咽喉(介数全网前 ${Math.round((1 - metric.chokeRank) * 100)}%)`);
    const summary = parts.join(";") + "。";

    return { summary, factors, mitigation, chain, evidence, actions };
  }

  explainVehicle(vehicleId) {
    const seed = this.state.seed;
    const derived = this.state.derived;
    const vehicle = findById(seed.fleet, vehicleId);
    if (!vehicle) return { summary: "车辆不在当前车队中。", factors: [], chain: [], evidence: [], actions: [] };

    const road = findById(seed.roads, vehicle.roadId);
    const metric = derived.roadMetrics[vehicle.roadId];
    const incidents = seed.events.filter((e) => e.roadId === vehicle.roadId && e.status !== "cleared");
    const freeFlow = road ? road.speedLimit || 50 : 50;
    const effective = vehicle.effectiveSpeed || vehicle.speed;
    const speedLoss = Math.max(0, Math.round((1 - effective / freeFlow) * 100));

    // 车辆的速度损失主要由道路状态决定,归因直接借用所在道路的分量
    const { factors, mitigation } = this.roadAttribution(vehicle.roadId);

    const chain = [{ hop: 0, id: vehicle.roadId, name: roadName(road, vehicle.roadId), relation: "所在道路", load: metric ? Math.round(metric.load * 100) : 0 }];
    if (metric) {
      this.neighborRoads(vehicle.roadId)
        .sort((a, b) => b.load - a.load)
        .slice(0, 2)
        .forEach((n, i) => {
          const neighborRoad = findById(seed.roads, n.roadId);
          chain.push({ hop: i + 1, id: n.roadId, name: roadName(neighborRoad, n.roadId), relation: "绕行可选", load: Math.round(n.load * 100) });
        });
    }

    const evidence = incidents.map((e) => ({ kind: "event", text: `${e.name}:等级 S${e.severity},车辆经过该段被拖累` }));
    if (vehicle.subType === "bus") evidence.push({ kind: "transit", text: `公交载客 ${vehicle.occupancy} 人,累计延误 ${Number(vehicle.delayMinutes || 0).toFixed(1)} 分钟` });

    const actions = [];
    if ((vehicle.delayMinutes || 0) > 2.5 || (vehicle.subType === "bus" && speedLoss > 45)) {
      actions.push({ commandType: "TRANSIT_PRIORITY", targetId: vehicle.id, text: "申请公交优先相位,压降串车与延误" });
    }
    if (incidents.length) {
      actions.push({ commandType: "INCIDENT_RESPONSE", targetId: incidents[0].id, text: `处置 ${incidents[0].name},恢复道路通行能力` });
    }
    if (!actions.length) actions.push({ commandType: "MANUAL", targetId: vehicle.id, text: "运行状态正常,无需干预" });

    const summary =
      `${vehicle.name}正沿 ${roadName(road, vehicle.roadId)} 运行,实效速度 ${Math.round(effective)} km/h(自由流 ${freeFlow} km/h,损失 ${speedLoss}%)` +
      `${incidents.length ? `,受 ${incidents.length} 起沿线事件拖累` : ",沿线无活跃事件"}` +
      `${(vehicle.delayMinutes || 0) > 2 ? `,累计延误 ${Number(vehicle.delayMinutes).toFixed(1)} 分钟` : ""}。`;

    return { summary, factors, mitigation, chain, evidence, actions };
  }

  explainIncident(eventId) {
    const seed = this.state.seed;
    const derived = this.state.derived;
    const event = findById(seed.events, eventId);
    if (!event) return { summary: "事件不存在或已归档。", factors: [], chain: [], evidence: [], actions: [] };

    const road = findById(seed.roads, event.roadId);
    const metric = derived.roadMetrics[event.roadId];
    const neighbors = this.neighborRoads(event.roadId).sort((a, b) => b.load - a.load);

    const chain = [{ hop: 0, id: event.id, name: event.name, relation: "冲击源", load: event.severity }];
    if (metric) chain.push({ hop: 1, id: event.roadId, name: roadName(road, event.roadId), relation: "直接受影响", load: Math.round(metric.load * 100) });
    neighbors.slice(0, 2).forEach((n, i) => {
      const neighborRoad = findById(seed.roads, n.roadId);
      chain.push({ hop: i + 2, id: n.roadId, name: roadName(neighborRoad, n.roadId), relation: "波及风险", load: Math.round(n.load * 100) });
    });

    const evidence = [{ kind: "event", text: `等级 S${event.severity},状态 ${event.status},责任单位 ${event.owner || "指挥中心"}` }];
    if (event.firstDetectedAt) {
      const minutes = Math.max(1, Math.round((Date.now() - event.firstDetectedAt) / 60000));
      evidence.push({ kind: "time", text: `首发于 ${minutes} 分钟前,持续越久波及面越大` });
    }
    const relatedDevices = seed.devices.filter((d) => d.roadId === event.roadId && d.status !== "online");
    if (event.category === "device" && relatedDevices.length) {
      evidence.push({ kind: "sensing", text: `${relatedDevices[0].name} 异常,影响事件确认与诱导发布` });
    }

    const actions = [];
    if (event.category === "device") {
      const target = relatedDevices[0];
      actions.push({ commandType: "DEVICE_REPAIR", targetId: target ? target.id : event.id, text: "派单修复设备,恢复事件确认闭环" });
    }
    actions.push({ commandType: "INCIDENT_RESPONSE", targetId: event.id, text: "生成截流、绕行与现场派单的联动处置" });
    if (metric && metric.chokeRank >= 0.75) {
      actions.push({ commandType: "DEMAND_DIVERSION", targetId: event.roadId, text: "受影响道路是路网咽喉,建议同步外围截流" });
    }

    const summary =
      `${event.name}当前等级 S${event.severity}(状态 ${event.status}),` +
      `落在 ${roadName(road, event.roadId)}` +
      `${metric ? `,该段饱和度 ${Math.round(metric.load * 100)}%` : ""}` +
      `${neighbors.length ? `,压力可能向 ${neighbors.slice(0, 2).map((n) => roadName(findById(seed.roads, n.roadId), n.roadId)).join("、")} 传导` : ""}。`;

    return { summary, factors: [], mitigation: null, chain, evidence, actions };
  }

  explainDevice(deviceId) {
    const seed = this.state.seed;
    const derived = this.state.derived;
    const device = findById(seed.devices, deviceId);
    if (!device) return { summary: "设备不在感知清单中。", factors: [], chain: [], evidence: [], actions: [] };

    const road = findById(seed.roads, device.roadId);
    const metric = derived.roadMetrics[device.roadId];
    const sameRoadDevices = seed.devices.filter((d) => d.roadId === device.roadId && d.id !== device.id);
    const redundant = sameRoadDevices.filter((d) => d.status === "online").length;

    const chain = [{ hop: 0, id: device.id, name: device.name, relation: "本机状态", load: device.healthScore }];
    if (metric) chain.push({ hop: 1, id: device.roadId, name: roadName(road, device.roadId), relation: "监测道路", load: Math.round(metric.load * 100) });

    const evidence = [
      { kind: "device", text: `能力 ${device.capability},采样 ${device.sampleRate},延迟 ${device.latencyMs} ms,健康度 ${device.healthScore}%` },
    ];
    if (sameRoadDevices.length) {
      evidence.push({ kind: "redundancy", text: `同路另有 ${redundant}/${sameRoadDevices.length} 台在线,${redundant ? "可补偿覆盖" : "无冗余,存在感知断点"}` });
    }

    const actions = [];
    if (device.status !== "online") {
      actions.push({ commandType: "DEVICE_REPAIR", targetId: device.id, text: `派单恢复 ${device.name}` });
      if (!redundant) actions.push({ commandType: "MANUAL", targetId: device.id, text: "无冗余覆盖,建议人工巡检补盲" });
    } else {
      actions.push({ commandType: "MANUAL", targetId: device.id, text: "运行正常,保持例行维护" });
    }

    const summary =
      `${device.name}当前${device.status === "online" ? "在线" : device.status === "degraded" ? "性能降级" : "离线"},` +
      `监测 ${roadName(road, device.roadId)}${metric ? `(饱和度 ${Math.round(metric.load * 100)}%)` : ""}` +
      `${sameRoadDevices.length ? `,同路冗余 ${redundant} 台` : ",为该路段唯一感知源"}。`;

    return { summary, factors: [], mitigation: null, chain, evidence, actions };
  }

  explainSignalSide(id, type) {
    const seed = this.state.seed;
    const derived = this.state.derived;

    let intersection = null;
    let signal = null;
    if (type === "signalController") {
      signal = findById(seed.signals, id);
      intersection = signal ? findById(seed.intersections, signal.intersectionId) : null;
    } else {
      intersection = findById(seed.intersections, id);
      signal = seed.signals.find((s) => s.intersectionId === id) || null;
    }
    if (!intersection && !signal) return { summary: "未找到对应路口。", factors: [], chain: [], evidence: [], actions: [] };

    const target = intersection || { id, name: "未知路口", connectedRoads: [] };

    // 进口道负载排行,最堵的那条就是归因主源
    const approaches = (target.connectedRoads || [])
      .map((roadId) => {
        const road = findById(seed.roads, roadId);
        const metric = derived.roadMetrics[roadId];
        return { roadId, name: roadName(road, roadId), load: metric ? metric.load : 0, choke: metric ? metric.chokeRank || 0 : 0 };
      })
      .sort((a, b) => b.load - a.load);

    const { factors, mitigation } = approaches.length ? this.roadAttribution(approaches[0].roadId) : { factors: [], mitigation: null };

    const chain = approaches.slice(0, 3).map((a, i) => ({ hop: i + 1, id: a.roadId, name: a.name, relation: i === 0 ? "最重进口道" : "进口道", load: Math.round(a.load * 100) }));
    const approachAvg = approaches.length ? Math.round((approaches.reduce((sum, a) => sum + a.load, 0) / approaches.length) * 100) : 0;
    chain.push({ hop: 0, id: target.id, name: target.name, relation: "路口", load: approachAvg });

    const evidence = [];
    if (signal) evidence.push({ kind: "signal", text: `当前相位 ${signal.currentPhase},周期 ${signal.cycleLength}s,协调组 ${signal.coordinationGroup}` });
    const corridor = (this.topology ? this.topology.corridors : []).find((c) =>
      c.roadIds.some((rid) => (target.connectedRoads || []).indexOf(rid) >= 0)
    );
    if (corridor) {
      const state = (derived.corridors || []).find((cs) => cs.id === corridor.id);
      evidence.push({ kind: "corridor", text: `位于 ${corridor.name}${state ? `,当前带宽 ${state.bandwidthPercent}%(${state.bandwidthLabel})` : ""}` });
    }

    const actions = [];
    if (approaches.length && approaches[0].load > 0.8) {
      actions.push({ commandType: "SIGNAL_GREEN_WAVE", targetId: approaches[0].roadId, text: `${approaches[0].name}进口饱和,建议放行加权或干线协调` });
    }
    if (corridor) {
      const state = (derived.corridors || []).find((cs) => cs.id === corridor.id);
      if (state && state.bandwidthPercent < 40) {
        actions.push({ commandType: "SIGNAL_GREEN_WAVE", targetId: approaches.length ? approaches[0].roadId : target.id, text: `所在干线带宽仅 ${state.bandwidthPercent}%,建议切入绿波协调` });
      }
    }
    if (!actions.length) actions.push({ commandType: "MANUAL", targetId: target.id, text: "各进口道负载正常,维持当前配时" });

    const summary =
      `${target.name}${approaches.length ? `最重进口道为 ${approaches[0].name}(饱和度 ${Math.round(approaches[0].load * 100)}%)` : ""}` +
      `${signal ? `,当前相位 ${signal.currentPhase}` : ""}` +
      `${approaches.some((a) => a.choke >= 0.75) ? ",有进口道处于路网咽喉" : ""}。`;

    return { summary, factors, mitigation, chain, evidence, actions };
  }

  // 公交站 / 分区的轻量解释
  explainBrief(id, entity) {
    const seed = this.state.seed;
    const derived = this.state.derived;

    if (entity.type === "transitStop") {
      const stop = findById(seed.stops, id);
      const metric = derived.roadMetrics[stop.roadId];
      const buses = seed.fleet.filter((v) => v.roadId === stop.roadId && (v.subType === "bus" || v.priority === "transit")).length;
      const actions = [];
      if (stop.passengerLoad > 120 || buses >= 3) {
        actions.push({ commandType: "TRANSIT_PRIORITY", targetId: stop.id, text: "客流偏高或串车,建议公交优先相位" });
      } else {
        actions.push({ commandType: "MANUAL", targetId: stop.id, text: "站点运行平稳,维持监测" });
      }
      return {
        summary: `${stop.name}客流 ${stop.passengerLoad} 人次,停站 ${stop.dwellSeconds}s,线路 ${stop.line}${metric ? `,所在道路饱和度 ${Math.round(metric.load * 100)}%` : ""}${buses >= 3 ? `,同路 ${buses} 台公交存在串车风险` : ""}。`,
        factors: [],
        mitigation: null,
        chain: metric ? [{ hop: 0, id: stop.roadId, name: roadName(findById(seed.roads, stop.roadId), stop.roadId), relation: "所在道路", load: Math.round(metric.load * 100) }] : [],
        evidence: [{ kind: "transit", text: `服务线路 ${stop.line},站台客流 ${stop.passengerLoad} 人次` }],
        actions,
      };
    }

    if (entity.type === "trafficZone") {
      const zone = findById(seed.zones, id);
      const memberLoads = zone.roads.map((rid) => derived.roadMetrics[rid]).filter(Boolean);
      const avgLoad = memberLoads.length ? Math.round((memberLoads.reduce((s, m) => s + m.load, 0) / memberLoads.length) * 100) : 0;
      const actions = [];
      if (zone.demandIndex > 75 || avgLoad > 75) {
        actions.push({ commandType: "DEMAND_DIVERSION", targetId: zone.id, text: "需求或负载偏高,建议跨区削峰与停车诱导" });
      } else {
        actions.push({ commandType: "MANUAL", targetId: zone.id, text: "分区需求平稳,维持监测" });
      }
      return {
        summary: `${zone.name}需求指数 ${zone.demandIndex}%,停车压力 ${zone.parkingPressure}%,覆盖 ${zone.roads.length} 条道路,区内均载 ${avgLoad}%。`,
        factors: [],
        mitigation: null,
        chain: [],
        evidence: [
          { kind: "zone", text: `慢行客流 ${zone.pedestrianFlow} 人次/h,停车压力 ${zone.parkingPressure}%` },
          { kind: "zone", text: `区内道路平均饱和度 ${avgLoad}%` },
        ],
        actions,
      };
    }

    return { summary: "该类型实体暂不支持深度归因。", factors: [], mitigation: null, chain: [], evidence: [], actions: [] };
  }

  getAlerts() {
    return { total: this.state.derived.alerts.length, items: clone(this.state.derived.alerts) };
  }

  getHistory(limit) {
    const normalizedLimit = clamp(Number(limit) || 20, 1, this.maxHistory);
    return { total: this.state.history.length, items: clone(this.state.history.slice(0, normalizedLimit)) };
  }

  getDiagnostics() {
    return {
      streamClients: this.listeners.length,
      streamVersion: this.state.meta.streamVersion,
      historySamples: this.state.meta.historySamples,
      uptimeSeconds: Math.floor((Date.now() - this.state.meta.startedAt) / 1000),
      lastTickAt: this.state.meta.lastTickAt,
      memory: process.memoryUsage(),
      playback: this.state.meta.playback,
      modelVersion: MODEL_VERSION,
      activeStrategy: this.state.control.activeStrategy,
      entityCount: this.state.entities.length,
      networkFingerprint: this.topology ? this.topology.fingerprint : "TG-NA",
      storage: this.store ? this.store.describe() : null,
      apiSurface: [
        "/api/overview",
        "/api/map",
        "/api/entities",
        "/api/entities/:id",
        "/api/explain/:id",
        "/api/alerts",
        "/api/forecast",
        "/api/semantic-graph",
        "/api/control",
        "/api/commands",
        "/api/admin/reset",
      ],
    };
  }

  getForecast() {
    return clone(this.state.derived.forecast);
  }

  getSemanticGraph() {
    return clone(this.state.semanticGraph);
  }

  getControlState() {
    return {
      activeStrategy: this.state.control.activeStrategy,
      strategies: clone(this.state.control.strategies),
      plan: clone(this.state.derived.controlPlan || null),
      commandLog: clone(this.state.control.commandLog.slice(0, 20)),
      recommendations: clone(this.state.derived.recommendations || []),
    };
  }

  getStreamFrame(reason) {
    return {
      type: "state",
      reason: reason || "stream",
      overview: this.getOverview(),
      map: this.getMapSnapshot(),
      entities: this.getEntities("all", "").items,
      alerts: this.getAlerts().items,
      history: this.getHistory(24).items,
      diagnostics: this.getDiagnostics(),
      forecast: this.getForecast(),
      semanticGraph: this.getSemanticGraph(),
      control: this.getControlState(),
    };
  }
}

module.exports = { TwinEngine };

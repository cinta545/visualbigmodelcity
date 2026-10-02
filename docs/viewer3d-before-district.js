// 三维视图层:Three.js 场景搭建与实体网格的增删同步。
// 地图(分区/路段/路口)只在第一帧构建一次;实体每帧增量更新,车辆位置做插值平滑。
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 饱和度 -> 路面颜色:>0.86 红,>0.68 橙,>0.48 蓝,其余灰
function colorForLoad(load) {
  if (load > 0.86) return 0xc53632;
  if (load > 0.68) return 0xd4861f;
  if (load > 0.48) return 0x0a84b8;
  return 0x5f7488;
}

function colorForStatus(status) {
  if (status === "online" || status === "moving" || status === "cleared") return 0x178f62;
  if (status === "degraded" || status === "monitoring" || status === "active") return 0xd4861f;
  return 0xc53632;
}

// 实体坐标可能是数组 [x, z],也可能是 {x, y} 对象,统一取出来
function getPoint(entity) {
  if (!entity || !entity.geometry || !entity.geometry.position) return null;
  const pos = entity.geometry.position;
  if (Array.isArray(pos)) return { x: Number(pos[0]), z: Number(pos[1]) };
  return { x: Number(pos.x), z: Number(pos.y) };
}

export class SemanticTwin3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.mapConstructed = false;
    this.entityObjects = new Map();
    this.roadMaterials = new Map();
    this.clock = new THREE.Clock();
    this.bounds = { minX: 0, maxX: 1000, minZ: 0, maxZ: 700, cx: 500, cz: 350 };
    this.selectedId = null;
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe8eef4);
    this.scene.fog = new THREE.FogExp2(0xe8eef4, 0.00115);

    const width = Math.max(this.canvas.clientWidth, 1);
    const height = Math.max(this.canvas.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    this.camera.position.set(260, 520, 720);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // 不许钻到地面以下
    this.controls.target.set(this.bounds.cx, 0, this.bounds.cz);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c9d9, 0.95);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff7e8, 1.55);
    sun.position.set(220, 860, 340);
    sun.castShadow = true;
    sun.shadow.camera.left = -900;
    sun.shadow.camera.right = 900;
    sun.shadow.camera.top = 900;
    sun.shadow.camera.bottom = -900;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: 0xf5f8fb, roughness: 0.85, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.set(500, -0.2, 350);
    this.scene.add(ground);

    const grid = new THREE.GridHelper(4000, 160, 0xb9c9d9, 0xdbe4ec);
    grid.material.opacity = 0.45;
    grid.material.transparent = true;
    grid.position.set(500, 0.05, 350);
    this.scene.add(grid);

    this.createAmbientCity();
    window.addEventListener("resize", this.onResize.bind(this));
    this.animate();
  }

  // 背景城市氛围:随机撒楼块 + 一层缓慢旋转的数据粒子。
  // random 用固定种子的线性同余,保证每次刷新城市轮廓一致。
  createAmbientCity() {
    const group = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.08 }),
      new THREE.MeshStandardMaterial({ color: 0xe5ecf3, roughness: 0.7, metalness: 0.12 }),
      new THREE.MeshStandardMaterial({ color: 0xd8e2eb, roughness: 0.65, metalness: 0.1 }),
    ];

    let seed = 30241;
    function random() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    for (let i = 0; i < 170; i += 1) {
      const x = 500 + (random() - 0.5) * 1900;
      const z = 350 + (random() - 0.5) * 1400;
      if (Math.abs(x - 500) < 130 && Math.abs(z - 350) < 130) continue; // 中心留给主路网
      const h = 14 + random() * 95 + (random() > 0.93 ? 130 : 0); // 偶尔来一栋超高层
      const mesh = new THREE.Mesh(box, mats[Math.floor(random() * mats.length)]);
      mesh.position.set(x, h / 2, z);
      mesh.scale.set(18 + random() * 46, h, 18 + random() * 46);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 900;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = 500 + (random() - 0.5) * 2100;
      positions[i * 3 + 1] = 35 + random() * 260;
      positions[i * 3 + 2] = 350 + (random() - 0.5) * 1500;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dataParticles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({ color: 0x0a84b8, size: 3.2, transparent: true, opacity: 0.42 })
    );
    group.add(this.dataParticles);

    this.cityGroup = group;
    this.scene.add(group);
  }

  computeBounds(mapData) {
    const xs = [];
    const zs = [];
    for (const road of mapData.roads || []) {
      for (const point of road.points || []) {
        xs.push(point[0]);
        zs.push(point[1]);
      }
    }
    if (!xs.length) return;

    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minZ = Math.min.apply(null, zs);
    const maxZ = Math.max.apply(null, zs);
    this.bounds = {
      minX,
      maxX,
      minZ,
      maxZ,
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
    };

    // 按路网范围把观察点和相机摆到能看全的位置
    this.controls.target.set(this.bounds.cx, 0, this.bounds.cz);
    const span = Math.max(maxX - minX, maxZ - minZ, 500);
    this.camera.position.set(this.bounds.cx - span * 0.42, span * 0.72, this.bounds.cz + span * 0.9);
  }

  buildMap(mapData) {
    if (!mapData || this.mapConstructed) return;
    this.computeBounds(mapData);

    this.mapGroup = new THREE.Group();
    this.roadMaterials.clear();

    // 分区:地面铺半透明圆盘,需求指数高的偏橙色
    for (const zone of mapData.zones || []) {
      const mat = new THREE.MeshBasicMaterial({
        color: zone.demandIndex > 78 ? 0xd4861f : 0x6d5bd0,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
      });
      const disk = new THREE.Mesh(new THREE.CircleGeometry(95 + zone.roads.length * 1.6, 64), mat);
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(zone.position[0], 0.12, zone.position[1]);
      this.mapGroup.add(disk);
    }

    // 路段:逐段拉 Box,材质按 id 存起来供后续刷色;上面再叠一条白色中线
    for (const road of mapData.roads || []) {
      const metric = (mapData.roadMetrics || {})[road.id] || { load: 0.35 };
      const material = new THREE.MeshStandardMaterial({
        color: colorForLoad(metric.load),
        roughness: 0.78,
        metalness: 0.05,
      });
      this.roadMaterials.set(road.id, material);

      const points = road.points || [];
      const width = clamp((road.laneCount || 2) * 4.6, 7, 28);
      for (let j = 1; j < points.length; j += 1) {
        const a = points[j - 1];
        const b = points[j];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length < 0.5) continue; // 太短的段画出来是碎片,跳过
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.42, width), material);
        mesh.position.set((a[0] + b[0]) / 2, 0.26, (a[1] + b[1]) / 2);
        mesh.rotation.y = Math.atan2(-dz, dx);
        mesh.receiveShadow = true;
        mesh.userData.roadId = road.id;
        this.mapGroup.add(mesh);
      }

      const linePoints = points.map((point) => new THREE.Vector3(point[0], 0.62, point[1]));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(linePoints),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 })
      );
      line.userData.roadId = road.id;
      this.mapGroup.add(line);
    }

    // 路口:淡蓝色圆环标记
    for (const intersection of mapData.intersections || []) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(10, 14, 40),
        new THREE.MeshBasicMaterial({ color: 0x0a84b8, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(intersection.position[0], 0.72, intersection.position[1]);
      this.mapGroup.add(ring);
    }

    this.scene.add(this.mapGroup);
    this.mapConstructed = true;
  }

  updateRoadMetrics(roadMetrics) {
    for (const [roadId, material] of this.roadMaterials) {
      const metric = roadMetrics[roadId];
      if (!metric) continue;
      material.color.setHex(colorForLoad(metric.load));
      material.emissive = new THREE.Color(colorForLoad(metric.load));
      material.emissiveIntensity = metric.load > 0.8 ? 0.08 : 0.02;
    }
  }

  updateEntities(entities, selectedId, visibleIds, filterActive, activeFilter) {
    this.selectedId = selectedId;
    this.visibleEntityIds = new Set(visibleIds || []);
    this.filterActive = Boolean(filterActive);
    this.activeFilter = activeFilter || "all";

    const current = new Set();
    const entityList = entities || [];

    for (const entity of entityList) {
      const point = getPoint(entity);
      if (!point) continue;
      current.add(entity.id);

      let object = this.entityObjects.get(entity.id);
      if (!object) {
        object = this.createEntityObject(entity);
        if (!object) continue; // 没有对应 3D 形态的类型直接跳过
        this.scene.add(object);
        this.entityObjects.set(entity.id, object);
      }

      object.userData.type = entity.type;
      object.userData.entityId = entity.id;
      object.userData.baseScale = object.userData.baseScale || object.scale.clone();
      const y = object.userData.baseY || object.position.y || 0;

      if (entity.type === "vehicle") {
        // 车辆只更新目标点,实际位置在 animate 里插值,避免跳变
        if (!object.userData.targetPosition) {
          object.position.set(point.x, y, point.z);
          object.userData.targetPosition = new THREE.Vector3(point.x, y, point.z);
        } else {
          const last = object.userData.targetPosition.clone();
          object.userData.targetPosition.set(point.x, y, point.z);
          const dx = point.x - last.x;
          const dz = point.z - last.z;
          if (Math.abs(dx) + Math.abs(dz) > 0.01) {
            object.userData.targetRotation = Math.atan2(-dz, dx);
          }
        }
      } else {
        object.position.set(point.x, y, point.z);
      }

      this.applyEntityState(object, entity, entity.id === selectedId);
    }

    // 清理这一帧没再出现的实体
    const staleIds = [];
    for (const id of this.entityObjects.keys()) {
      if (!current.has(id)) staleIds.push(id);
    }
    for (const id of staleIds) {
      this.scene.remove(this.entityObjects.get(id));
      this.entityObjects.delete(id);
    }

    this.applyFilterVisibility();
  }

  applyFilterVisibility() {
    const active = Boolean(this.filterActive);
    const visibleIds = this.visibleEntityIds || new Set();

    for (const [id, object] of this.entityObjects) {
      object.visible = !active || visibleIds.has(id) || id === this.selectedId;
    }

    // 可见集合里有路段,就认为筛选命中了路网,需要压暗未命中的路段
    let hasRoadMatches = false;
    for (const roadId of this.roadMaterials.keys()) {
      if (visibleIds.has(roadId)) {
        hasRoadMatches = true;
        break;
      }
    }
    const constrainRoads = this.activeFilter === "roadSegment" || (this.activeFilter === "all" && hasRoadMatches);

    for (const [roadId, material] of this.roadMaterials) {
      const roadVisible = !active || !constrainRoads || visibleIds.has(roadId) || roadId === this.selectedId;
      material.transparent = true;
      material.opacity = roadVisible ? (active && !constrainRoads ? 0.26 : 1) : 0.1;
      material.depthWrite = roadVisible;
    }

    if (this.mapGroup) {
      for (const child of this.mapGroup.children) {
        if (!child.userData || !child.userData.roadId) continue;
        child.visible =
          !active ||
          !constrainRoads ||
          visibleIds.has(child.userData.roadId) ||
          child.userData.roadId === this.selectedId;
      }
    }
  }

  createEntityObject(entity) {
    switch (entity.type) {
      case "vehicle":
        return this.createVehicle(entity);
      case "signalController":
        return this.createSignal(entity);
      case "sensor":
        return this.createSensor(entity);
      case "transitStop":
        return this.createTransitStop(entity);
      case "incident":
        return this.createIncident(entity);
      case "intersection":
        return this.createIntersection(entity);
      case "trafficZone":
        return this.createZone(entity);
      default:
        return null;
    }
  }

  createVehicle(entity) {
    const group = new THREE.Group();

    // 车型区分尺寸和配色:默认小车;公交加长紫色;货车灰色;应急车红色
    let length = 5;
    let width = 2;
    let height = 1.5;
    let color = 0xd8e2eb;
    let glow = 0x0a84b8;
    if (entity.subType === "bus" || entity.displayType === "bus") {
      length = 11.5; width = 2.8; height = 3.1;
      color = 0x6d5bd0; glow = 0x178f62;
    } else if (entity.subType === "truck" || entity.displayType === "logisticsVehicle") {
      length = 9.8; width = 2.7; height = 3.2;
      color = 0x8796a5; glow = 0xd4861f;
    } else if (entity.priority === "emergency") {
      color = 0xc53632;
      glow = 0xffffff;
    }

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(length, height, width),
      new THREE.MeshStandardMaterial({ color, roughness: 0.36, metalness: 0.28 })
    );
    body.position.y = height / 2 + 0.35;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.45, height * 0.52, width * 0.92),
      new THREE.MeshStandardMaterial({ color: 0x17212b, roughness: 0.22, metalness: 0.45 })
    );
    cabin.position.set(-length * 0.08, height + 0.38, 0);
    cabin.castShadow = true;
    group.add(cabin);

    // 车底发光条,夜里一眼能看到车流
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(length + 0.3, 0.09, width + 0.25),
      new THREE.MeshBasicMaterial({ color: glow })
    );
    strip.position.y = 0.42;
    group.add(strip);

    group.userData.baseY = 0;
    return group;
  }

  createSignal() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x6f7f8f, roughness: 0.32, metalness: 0.55 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 10, 16), metal);
    pole.position.y = 5;
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.2, 16), metal);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(3, 9.3, 0);
    group.add(arm);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.05, 1),
      new THREE.MeshStandardMaterial({ color: 0x17212b, roughness: 0.55 })
    );
    head.position.set(3.25, 9.3, 0);
    group.add(head);

    // 灯带颜色由 applyEntityState 按相位刷新
    const bulb = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.68), new THREE.MeshBasicMaterial({ color: 0x178f62 }));
    bulb.position.set(3.25, 9.3, 0.52);
    group.add(bulb);
    group.userData.bulbMaterial = bulb.material;
    group.userData.baseY = 0;
    return group;
  }

  createSensor(entity) {
    const group = new THREE.Group();
    const color = entity.displayType === "vms" ? 0xd4861f : entity.displayType === "rsu" ? 0x0a84b8 : 0x178f62;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.24, 5.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x8796a5, roughness: 0.42, metalness: 0.45 })
    );
    pole.position.y = 2.6;
    group.add(pole);

    const core = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
    core.position.y = 5.4;
    core.castShadow = true;
    group.add(core);

    // 底部光圈,颜色跟设备状态走
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.8, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.18;
    group.add(halo);
    group.userData.coreMaterial = core.material;
    group.userData.baseY = 0;
    return group;
  }

  createTransitStop() {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.25, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 0.7 })
    );
    base.position.y = 0.12;
    group.add(base);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.35, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x6d5bd0, roughness: 0.45, metalness: 0.1 })
    );
    roof.position.y = 3.2;
    group.add(roof);

    // 两侧立柱
    for (let i = -1; i <= 1; i += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 10), new THREE.MeshStandardMaterial({ color: 0x8796a5 }));
      pole.position.set(i * 3.4, 1.55, -1.3);
      group.add(pole);
    }
    group.userData.baseY = 0;
    return group;
  }

  createIncident(entity) {
    const group = new THREE.Group();
    const color = entity.severity >= 3 ? 0xc53632 : 0xd4861f;

    // 悬浮八面体 + 光柱 + 地面圆环,组成事件标记
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.0),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 })
    );
    core.position.y = 7;
    group.add(core);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 15, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 })
    );
    pillar.position.y = 7.5;
    group.add(pillar);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5, 8, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.35;
    group.add(ring);
    group.userData.isIncident = true;
    group.userData.coreMaterial = core.material;
    group.userData.baseY = 0;
    return group;
  }

  createIntersection() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6, 8.5, 36),
      new THREE.MeshBasicMaterial({ color: 0x0a84b8, transparent: true, opacity: 0.44, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.9;
    group.add(ring);
    group.userData.baseY = 0;
    return group;
  }

  createZone(entity) {
    const group = new THREE.Group();
    const radius = entity.stats && entity.stats["需求指数"] ? 52 : 45;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 4, 54),
      new THREE.MeshBasicMaterial({ color: 0x6d5bd0, transparent: true, opacity: 0.34, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.55;
    group.add(ring);
    group.userData.baseY = 0;
    return group;
  }

  // 每帧刷新实体显示状态:信号灯色、设备状态色、选中放大
  applyEntityState(object, entity, selected) {
    const statusColor = colorForStatus(entity.status);
    if (object.userData.bulbMaterial && entity.state) {
      const state = entity.state.toLowerCase();
      object.userData.bulbMaterial.color.setHex(state.indexOf("red") >= 0 ? 0xc53632 : state.indexOf("yellow") >= 0 ? 0xd4861f : 0x178f62);
    }
    if (object.userData.coreMaterial) {
      object.userData.coreMaterial.color.setHex(statusColor);
    }

    const base = object.userData.baseScale || new THREE.Vector3(1, 1, 1);
    const scale = selected ? 1.55 : 1;
    object.scale.set(base.x * scale, base.y * scale, base.z * scale);
  }

  // 镜头飞到指定实体附近
  focusEntity(id) {
    const object = this.entityObjects.get(id);
    if (!object) return;
    const target = object.position.clone();
    this.controls.target.lerp(target, 0.85);
    const desired = new THREE.Vector3(target.x - 95, target.y + 155, target.z + 165);
    this.camera.position.lerp(desired, 0.55);
  }

  onResize() {
    const width = Math.max(this.canvas.clientWidth, 1);
    const height = Math.max(this.canvas.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = performance.now() / 1000;
    const lerp = clamp(dt * 8, 0, 1);

    if (this.dataParticles) {
      this.dataParticles.rotation.y = time * 0.025;
      this.dataParticles.material.opacity = 0.34 + Math.sin(time * 1.6) * 0.08;
    }

    for (const object of this.entityObjects.values()) {
      // 车辆朝目标点做位置/朝向插值,消除数据帧之间的跳变
      if (object.userData.targetPosition && object.userData.type === "vehicle") {
        object.position.lerp(object.userData.targetPosition, lerp);
        if (typeof object.userData.targetRotation === "number") {
          // 角度先归一到 [-PI, PI] 再插值,避免绕远路
          let target = object.userData.targetRotation;
          let current = object.rotation.y;
          while (target - current > Math.PI) target -= Math.PI * 2;
          while (target - current < -Math.PI) target += Math.PI * 2;
          object.rotation.y += (target - current) * lerp;
        }
      }

      // 事件标记上下浮动 + 自转,一眼能认出来
      if (object.userData.isIncident) {
        object.children[0].rotation.x += dt * 0.8;
        object.children[0].rotation.y += dt * 1.2;
        object.position.y = Math.sin(time * 3.2) * 0.8;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

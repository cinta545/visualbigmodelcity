## 四城可视化首页（当前入口）

首页现为四城真实记录循环回放，带方向通过量、截图视角卡片与车辆跟随。交通圆环、方向流量、趋势、风险概览和车辆预测现已融合首页；原完整研究工具仍保留于 `/analysis.html`。车辆在真实观测段边缘柔和淡出，不补造延伸行驶。运行 `npm start`，访问 `http://127.0.0.1:4173/`。数据边界、流量口径和验证命令见 [四城数字可视化说明](docs/city-visualization.md)。

# SinD 真实交通三维项目

当前默认首页为 SinD 天津真实轨迹回放与四街角设计街区，包含分类交通参与者和五种视角；街景建筑为设计内容，道路、轨迹和已核验灯位来自数据。已移除首页的仿真工作台与 iframe 拼接。

执行 `npm start` 后访问 http://127.0.0.1:4173；执行 `npm test` 运行验证。默认服务不启动仿真引擎、数据库或调度写接口。

计划、进度及本轮限制详见 [真实数据项目计划](docs/real-data-project-plan.md) 和 [素材授权](assets/LICENSES.md)。当前仍为视觉初稿；恒速/恒加速度预测基线已接入，风险候选分析已接入，录像导出尚未实现。`npm run sind:prepare` 重新转换并审查场景，需要 Python 的 pyproj 3.8.0 和 shapely 2.1.2。

首页右上角“数据与对象”已接入真实指标、ID/类型检索、当前时刻/整段记录筛选、对象定位与首次观测跳转、过去 10 秒历史轨迹和 CSV 下载。统计范围为整个采集区域；汽车类均速仅覆盖轿车、公交和货车，低速数量不作为排队长度。CSV 为选中对象过去 10 秒的原始观测，不含未来数据。浏览器验收可执行 `node scripts/analysis-check.cjs`。

选中机动车后可切换恒速 CV / 恒加速度 CA，蓝线显示未来 3 秒预测，并显示 1/2/3 秒端点误差及下载预测 CSV。预测从最新已到达采样点开始；未来真值仅用于离线误差核对。`node scripts/evaluate-sind-baselines.mjs` 生成同起点比较报告 `data/sind/baseline-evaluation.json`；`node scripts/prediction-check.cjs` 验证页面与导出。

“风险候选”标签显示未来 3 秒恒速包络接触候选，区分追尾、交叉方向、行人/非机动车交互及当前重叠。点击可定位双方并展示外推位置，支持导出当前候选 CSV。该分析没有事故标签验证，不是事故概率。方法、假设与复现步骤见 [风险基线说明](docs/sind-risk-baseline.md)。

“风险候选 → 事件复核与整段统计”支持离线事件列表、按对象 ID/复核状态筛选、最小 TTC 跳转、前后 2 秒片段播放和人工备注。复核保存在当前浏览器，以源数据哈希和方法配置隔离，支持 CSV 备份。`npm run sind:events` 重建事件索引，`node scripts/event-check.cjs` 验证片段和持久化。

复核工具现支持 JSON 备份恢复：校验源数据 SHA256、事件配置、风险配置与事件 ID；默认保留已有记录，选择覆盖策略并应用后才替换。CSV 用于分析，JSON 用于恢复。事件类别筛选和类别涉及数量已接入；阈值敏感性面板显示 12 组 TTC 上限/合并间隔组合，报告随 `npm run sind:events` 生成。浏览器验收：`node scripts/review-backup-check.cjs`。

新增“交通指标 → 研究评估报告（离线）”：展示 CV/CA 的 ADE/FDE，支持速度分层、预测起点平均与对象等权平均，下载报告与逐起点误差。`npm run sind:evaluate` 从 `shared/research-datasets.json` 执行评估。当前只有 development 样例，尚无独立训练/验证/测试集或训练模型；详细口径见 [研究评估准备](docs/research-evaluation.md)。

已主动下载长春、重庆、西安公开样例至 `data/sind-public`，哈希与基础质量检查完成，尚未接入评估清单或替换天津首页。完整数据仍需官方申请，详见 [数据获取记录](docs/sind-data-access.md)。复现：`python scripts/download-sind-public.py`、`python scripts/audit-sind-public.py`。

四城市公开样例的第一轮研究已完成：972,997 行、2,757 条轨迹，486,176 行预测评估明细。首页离线报告支持按城市、车型和方向变化分层，天津回放不变。见 [四城市研究结果](docs/multicity-research-results.md)。运行 `npm run sind:public:prepare`、`npm run sind:evaluate`、`node scripts/report-sind-multicity.mjs` 复现。

第二轮已加入 DCA（衰减加速度）与 CTRV（恒转率），支持三维预测和离线四模型比较。结果见 [四基线研究](docs/four-baselines-results.md)，协议见 [固定参数](docs/four-baselines-protocol.md)。运行 `npm run sind:evaluate` 后执行 `node scripts/report-sind-four-baselines.mjs` 生成本轮报告。下方旧进度说明保留历史上下文；当前风险仍固定使用 CV。

以下为历史仿真系统说明，仅存档参考，不属于当前真实数据项目的已实现能力。

---

# 大规模语义化交通全要素数字孪生体建模系统

这是一个前后端一体的可运行交通数字孪生系统。系统以虚构城市路网为底座，自动生成路口、信号机、感知设备、公交站、车辆、交通事件、交通分区和语义关系，并提供实时推演、拓扑分析、绿波协调、因果解释、策略控制、指令下发和告警闭环。全部场景状态落单文件 SQLite 台账，服务重启后自动断点恢复。

## 已实现能力

- 全要素建模：道路、路口、信号、视频/雷达/RSU/VMS、公交站、公交/物流/社会/应急车辆、事件、分区。
- 路网拓扑分析：道路端点自动聚合成拓扑图，用 Brandes 算法计算介数中心性，识别"咽喉路段"；每条路都有全网分位的咽喉度，路网整体生成拓扑指纹（TG-XXXXXXXX），同构路网指纹一致、改动即变。
- 干线自动识别：在高等级路子图上做"最大延续"链式追踪（转向角最小优先、等级平手决胜），拼出走向自然的干线走廊，并挂载沿线信号机。
- 绿波带宽推演：按设计速度推理想时距，与现状车速的实际到达做相位比对，错位吃掉绿窗剩下的就是带宽；瓶颈信号对会被点名，切换干线绿波策略会同时抬高绿窗和车速、带宽随之变化。
- 因果解释器：`/api/explain/:id` 对任意实体回答"为什么"——道路负载按分量归因（事件冲击/车流占用/潮汐/等级吸引/策略缓解），传播链标注上游传导与可分流去向，附证据（事件、感知缺口）和可一键下发的处置建议。
- 实时孪生引擎：持续推演车辆位置、信号相位、道路饱和度、排队长度、设备状态、事件等级和公交延误。
- 语义化关系：实体详情包含"监测、连接、影响、控制、服务、拓扑邻接、干线归属"等关系，另提供语义图谱接口。
- 预测控制：生成 5/15/30 分钟拥堵、速度、风险和置信度预测。
- 策略调度：支持均衡协同、干线绿波、公交优先、事件联动、需求均衡；瓶颈告警和绿波建议均按"负载 × 咽喉度"加权排序。
- 指令闭环：前端可下发策略/派单/处置指令，并将结果写入调度日志。
- 告警闭环：支持重点告警定位和选中告警闭环。
- 三维可视化：Three.js 全屏路网场景，展示道路负载、车辆运动、信号、感知设备、公交站和事件。
- 双通道数据：Socket.IO 实时推送，异常时自动退化为轮询快照。
- 场景台账持久化：node:sqlite 单文件库（WAL 模式）承载全要素与运行状态；每 12 个推演周期写一次检查点，策略切换、指令下发、告警闭环时立即落档，停机兜底刷写；重启先做拓扑指纹校验，对得上就恢复现场，对不上自动按种子重建；`POST /api/admin/reset` 可随时全量重置。

## 运行

需要 Node.js 22.5+（使用内置 node:sqlite，无需另装数据库）。装好依赖后直接启动：

```bash
npm install
npm start
```

打开：

```text
http://127.0.0.1:4173
```

场景台账默认落在 `server/twin-scene.db`，可用 `DB_PATH` 环境变量指定其他位置。重启服务会从最近检查点恢复现场继续推演；要回到初始场景，调 `POST /api/admin/reset` 或删除库文件后重启。

前端交互提示：总览页顶部是自动识别的干线绿波卡（带宽、断点、建议）；选中任意实体后，实体详情页会追加"因果归因"卡片，传播链节点可点击跳转，建议动作可直接下发。

## 核心 API

- `GET /api/frame`：完整前端快照
- `GET /api/overview`：指标、统计、干线状态、拓扑指纹、控制摘要
- `GET /api/map`：路网和全要素地图快照
- `GET /api/entities?filter=all&search=`：实体检索
- `GET /api/entities/:id`：实体详情
- `GET /api/explain/:id`：因果解释（归因分量、传播链、证据、建议动作）
- `GET /api/alerts`：告警列表
- `GET /api/forecast`：多时域预测
- `GET /api/semantic-graph`：语义图谱
- `GET /api/control`：策略、建议和指令日志
- `POST /api/control/strategy`：切换策略，body: `{ "strategyId": "green_wave" }`
- `POST /api/commands`：下发调度指令
- `POST /api/alerts/:id/resolve`：告警闭环
- `POST /api/admin/reset`：按原始种子重建场景并全量重写台账
- `GET /api/export/snapshot`：导出当前快照

## 目录

```text
bigmodeltraffic/
├─ index.html
├─ package.json
├─ server.js
├─ README.md
├─ server/
│  ├─ seed.js
│  ├─ store.js
│  ├─ twin-engine.js
│  └─ twin-scene.db   # 运行时自动生成
└─ src/
   ├─ app.js
   ├─ model.js
   ├─ styles.css
   ├─ ui.js
   └─ viewer3d.js
```

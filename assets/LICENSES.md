# 场景素材来源

## SinD 东北街角样板
`src/sind-corner.mjs` 中建筑、店铺室内、树木、灯具及街道设施为项目自建程序模型，不是采集现场扫描资产。道路继续使用下述 Asphalt 01 CC0 材质。SinD 地图与轨迹来源、固定版本及数据许可证见 `docs/sind-stage-1.md` 与 `data/sind-source/LICENSE`。

四街角扩建及 `src/sind-actors.mjs` 的骑行者、三轮车、摩托车、行人均为项目自建程序模型；人物姿态和车辆外观为可视化设计，不是视频重建结果。

## Asphalt 01
- 来源：https://polyhaven.com/a/asphalt_01
- 授权：CC0；https://polyhaven.com/license
- 作者：Charlotte Baglioni（摄影），Dario Barresi（处理）
- 本地文件：assets/textures/asphalt_01/{Diffuse,nor_gl,rough}.jpg，2K
- 从官方文件 API 下载，并逐项校验官方 MD5。
- 修改：重复比例、颜色与法线强度在渲染器中调整。

## 本阶段自建模型
道路、建筑模块、树木、车辆、灯杆及灯具由本项目代码生成。尚未引入第三方车辆模型；当前阶段用于布局、交通逻辑与近景结构验证，不代表最终写实模型质量。

## Three.js
版本 0.150.1，MIT；许可证位于 node_modules/three/LICENSE。

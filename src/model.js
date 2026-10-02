// 展示层共用的文案与等级换算:类型名、状态名、状态三档分级、信号灯色、数字格式化。
(function () {
  var TYPE_LABELS = {
    roadSegment: "道路",
    intersection: "路口",
    signalController: "信号控制",
    sensor: "感知设备",
    camera: "视频相机",
    radar: "毫米波雷达",
    rsu: "车路协同 RSU",
    vms: "可变情报板",
    transitStop: "公交站",
    vehicle: "社会车辆",
    bus: "公交车辆",
    emergencyVehicle: "应急车辆",
    logisticsVehicle: "物流车辆",
    incident: "交通事件",
    trafficZone: "交通分区",
  };

  var STATUS_LABELS = {
    online: "在线",
    moving: "运行中",
    active: "处置中",
    monitoring: "监测中",
    degraded: "降级",
    offline: "离线",
    cleared: "已闭环",
    paused: "暂停",
  };

  // 状态归成 ok / warn / danger 三档,样式层按这个上色
  var OK_STATUSES = ["online", "moving", "cleared"];
  var WARN_STATUSES = ["degraded", "monitoring", "active"];

  function formatType(type) {
    return TYPE_LABELS[type] || type;
  }

  function statusText(status) {
    return STATUS_LABELS[status] || status || "未知";
  }

  function statusLevel(status) {
    if (OK_STATUSES.indexOf(status) >= 0) return "ok";
    if (WARN_STATUSES.indexOf(status) >= 0) return "warn";
    return "danger";
  }

  function severityLevel(severity) {
    if (severity >= 3) return "danger";
    if (severity === 2) return "warn";
    return "ok";
  }

  // 信号相位文本 -> 灯色,UI 徽标和 3D 灯泡共用
  function phaseToStatus(phase) {
    if (!phase) return "green";
    if (phase.indexOf("YELLOW") >= 0) return "yellow";
    if (phase.indexOf("RED") >= 0) return "red";
    return "green";
  }

  function formatNumber(value) {
    if (typeof value !== "number" || !isFinite(value)) return value;
    return value.toLocaleString("zh-CN");
  }

  window.SemanticTwinModel = {
    formatType: formatType,
    statusText: statusText,
    statusLevel: statusLevel,
    severityLevel: severityLevel,
    phaseToStatus: phaseToStatus,
    formatNumber: formatNumber,
  };
})();

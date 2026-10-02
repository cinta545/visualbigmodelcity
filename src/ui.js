// 渲染层:app.js 把 state 传进来,这里把各个面板的 DOM 全量刷一遍。
// 没上模板引擎,全是手拼字符串 + innerHTML,当前数据量下够用。
(function () {
  var model = window.SemanticTwinModel;

  function ref(id) {
    return document.getElementById(id);
  }

  // 后端某些字段可能缺省,统一按空数组兜底
  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 用在 HTML 属性里的场合,单引号也要转
  function attr(text) {
    return escapeHtml(text).replace(/'/g, "&#39;");
  }

  function statusClass(level) {
    return level === "ok" ? "is-ok" : level === "warn" ? "is-warn" : "is-danger";
  }

  function setText(id, value) {
    var el = ref(id);
    if (el) el.textContent = value;
  }

  // 通用进度条片段,宽度按 0-100 截断
  function bar(width, className) {
    var percent = Math.max(0, Math.min(100, Number(width) || 0));
    return '<div class="bar"><div class="' + (className || "bar-fill") + '" style="width:' + percent + '%"></div></div>';
  }

  // dock 按钮和浮动面板一一对应,切换时两边状态保持同步
  function switchPanel(targetId) {
    document.querySelectorAll(".dock-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-target") === targetId);
    });
    document.querySelectorAll(".floating-panel").forEach(function (panel) {
      panel.classList.toggle("hidden", panel.id !== targetId);
    });
  }

  // 顶部服务状态条:错误 > 连接中 > 轮询兜底 > 正常时隐藏
  function renderBanner(state) {
    var banner = ref("service-banner");
    if (!banner) return;

    if (state.error) {
      banner.className = "service-banner is-error";
      banner.textContent = "服务连接异常：" + state.error;
      return;
    }
    if (!state.connected) {
      banner.className = "service-banner";
      banner.textContent = "正在连接服务，请稍候...";
      return;
    }
    if (!state.streamConnected) {
      banner.className = "service-banner";
      banner.textContent = "实时推送暂时不可用，已改为自动定时刷新。";
      return;
    }

    banner.className = "service-banner hidden";
    banner.textContent = "";
  }

  function syncHeader(state) {
    var overview = state.data.overview;
    var meta = overview ? overview.meta : null;
    var backend = overview ? overview.backend : null;
    setText("scenario-name", overview ? overview.scenarioName : "加载中");
    setText("system-clock", meta ? meta.clockLabel : "--:--");
    setText("system-mode", meta && meta.playback === "running" ? "运行中" : "已暂停");
    setText("backend-source", backend ? backend.service : "连接中");
    setText("toggle-playback", meta && meta.playback === "running" ? "暂停仿真" : "继续仿真");
  }

  function renderSummary(state) {
    var overview = state.data.overview;
    var totals = overview && overview.derived ? overview.derived.totals : null;
    setText(
      "system-summary",
      totals
        ? "监测目标 " +
            model.formatNumber(totals.entities) +
            " 个 / 道路 " +
            totals.roads +
            " 条 / 红绿灯 " +
            totals.signals +
            " 个 / 监控 " +
            totals.devices +
            " 个 / 车辆 " +
            totals.vehicles +
            " 辆"
        : "等待数据"
    );
    setText("connection-status", state.connected ? "已连接" : "连接中");
    setText("stream-status", state.streamConnected ? "推送正常" : "推送未连接");
    setText("update-mode", state.updateMode);
  }

  function renderMetrics(state) {
    var overview = state.data.overview;
    var metrics = overview && overview.derived ? overview.derived.metrics : [];
    var rows = safeArray(metrics).map(function (metric) {
      var value = model.formatNumber(metric.value);
      return (
        '<article class="metric-card">' +
        '<p class="metric-label">' +
        escapeHtml(metric.label) +
        "</p>" +
        '<p class="metric-value">' +
        escapeHtml(value + metric.unit) +
        "</p>" +
        '<div class="metric-delta">' +
        escapeHtml(metric.delta) +
        "</div>" +
        "</article>"
      );
    });
    ref("metric-grid").innerHTML = rows.join("");
  }

  function renderModelHealth(state) {
    var overview = state.data.overview;
    var health = overview && overview.derived ? overview.derived.health : null;
    var control = state.data.control;
    var plan = control ? control.plan : null;
    if (!health || !plan) {
      ref("model-health").innerHTML = '<div class="empty-state">等待模型健康数据。</div>';
      return;
    }

    var layerRows = safeArray(plan.layers).map(function (layer) {
      return (
        '<div class="control-layer"><div><strong>' +
        escapeHtml(layer.name) +
        "</strong><span>" +
        escapeHtml(layer.status) +
        "</span></div>" +
        bar(layer.value) +
        "</div>"
      );
    });

    ref("model-health").innerHTML =
      '<div class="health-grid">' +
      '<article><span>风险指数</span><strong>' +
      escapeHtml(health.riskIndex + "%") +
      "</strong>" +
      bar(health.riskIndex, "bar-fill warn") +
      "</article>" +
      '<article><span>碳排指数</span><strong>' +
      escapeHtml(health.carbonIndex + "%") +
      "</strong>" +
      bar(health.carbonIndex, "bar-fill ok") +
      "</article>" +
      '<article><span>活跃策略</span><strong>' +
      escapeHtml(plan.strategyName) +
      "</strong><p>" +
      escapeHtml(plan.description) +
      "</p></article>" +
      "</div>" +
      '<div class="control-layer-list">' +
      layerRows.join("") +
      "</div>";
  }

  // 干线绿波卡:数据来自拓扑层自动识别的干线,带宽随实时车速和策略变化
  function renderArterials(state) {
    var el = ref("arterial-grid");
    if (!el) return;

    var overview = state.data.overview;
    var corridors = overview && overview.derived ? overview.derived.corridors : [];
    var list = safeArray(corridors);
    if (!list.length) {
      el.innerHTML = "";
      return;
    }

    var rows = list.map(function (c) {
      var bandClass = c.bandwidthPercent >= 55 ? "bar-fill ok" : c.bandwidthPercent >= 30 ? "bar-fill warn" : "bar-fill danger";
      var breakNote = c.worstPair
        ? '<div class="arterial-break">堵点:' +
          escapeHtml(c.worstPair.fromName + " 与 " + c.worstPair.toName) +
          " 的绿灯没对齐，相差 " +
          c.worstPair.driftSeconds +
          " 秒</div>"
        : "";
      return (
        '<article class="arterial-card">' +
        '<div class="card-head"><div><h3>' +
        escapeHtml(c.name) +
        "</h3><span>" +
        c.memberCount +
        " 段路 / " +
        c.signalCount +
        " 个红绿灯 / " +
        escapeHtml(c.lengthKm) +
        " 公里</span></div><strong>" +
        c.bandwidthPercent +
        "%</strong></div>" +
        bar(c.bandwidthPercent, bandClass) +
        '<div class="card-meta">' +
        escapeHtml(c.bandwidthLabel) +
        " / 理想时速 " +
        c.designSpeed +
        " / 实际时速 " +
        c.currentSpeed +
        " 公里 / 红绿灯一轮 " +
        c.cycle +
        " 秒 / 拥挤程度 " +
        c.avgLoadPercent +
        "%</div>" +
        breakNote +
        '<div class="arterial-advice">' +
        escapeHtml(c.advice) +
        "</div></article>"
      );
    });
    el.innerHTML =
      '<div class="section-title"><h3>重点道路绿灯通行情况<span>系统自动识别</span></h3></div>' + rows.join("");
  }

  // 道路等级的内部代号转成通俗中文
  var CLASS_LABELS = {
    motorway: "快速路",
    trunk: "主干道",
    primary: "主要道路",
    secondary: "次要道路",
    tertiary: "支路",
    tertiary_link: "支路连接",
    residential: "小区道路",
    unclassified: "普通道路",
    living_street: "生活街道",
    service: "内部道路",
  };
  function classLabel(cls) {
    return CLASS_LABELS[cls] || "普通道路";
  }

  function renderCorridors(state) {
    var mapData = state.data.map;
    if (!mapData) {
      ref("corridor-grid").innerHTML = '<div class="empty-state">等待道路数据。</div>';
      return;
    }

    var roadMetrics = mapData.roadMetrics || {};
    // 只展示有实时指标的路段,按拥挤程度从高到低取前 12 条
    var roads = safeArray(mapData.roads)
      .filter(function (road) {
        return roadMetrics[road.id];
      })
      .sort(function (a, b) {
        return roadMetrics[b.id].load - roadMetrics[a.id].load;
      })
      .slice(0, 12);

    var rows = roads.map(function (road) {
      var metric = roadMetrics[road.id];
      var loadPercent = Math.round(metric.load * 100);
      var loadClass = metric.load > 0.84 ? "bar-fill danger" : metric.load > 0.68 ? "bar-fill warn" : "bar-fill";
      return (
        '<article class="corridor-card" data-entity-id="' +
        attr(road.id) +
        '">' +
        '<div class="card-head"><div><h3>' +
        escapeHtml(road.name) +
        '</h3><span>' +
        escapeHtml(classLabel(road.functionalClass)) +
        "</span></div><strong>" +
        Math.round(metric.avgSpeed) +
        " 公里/小时</strong></div>" +
        bar(loadPercent, loadClass) +
        '<div class="card-meta">拥挤程度 ' +
        loadPercent +
        "% / 排队 " +
        metric.queueLength +
        " 米 / 车辆 " +
        metric.vehicleCount +
        " 辆</div></article>"
      );
    });
    ref("corridor-grid").innerHTML = rows.join("");
  }

  function renderEntityList(state) {
    // 实体可能上千,列表只渲染前 160 条,剩下的靠筛选/搜索缩小范围
    var visible = safeArray(state.data.entities).slice(0, 160);
    var rows = visible.map(function (entity) {
      return (
        '<article class="entity-row ' +
        (state.selectedId === entity.id ? "is-active" : "") +
        '" data-entity-id="' +
        attr(entity.id) +
        '">' +
        '<div class="entity-topline"><h3>' +
        escapeHtml(entity.name) +
        '</h3><span class="type-badge">' +
        escapeHtml(model.formatType(entity.displayType || entity.type)) +
        "</span></div>" +
        '<p class="entity-meta">' +
        escapeHtml(entity.description) +
        "</p>" +
        '<div class="entity-bottom"><span class="status-badge ' +
        statusClass(model.statusLevel(entity.status)) +
        '">' +
        escapeHtml(model.statusText(entity.status)) +
        '</span><span class="severity">S' +
        escapeHtml(entity.severity || 1) +
        "</span></div></article>"
      );
    });

    ref("entity-list").innerHTML = visible.length
      ? rows.join("")
      : '<div class="empty-state">当前筛选条件下没有匹配实体。</div>';
  }

  // 因果归因卡:summary + 分量占比 + 传播链 + 证据 + 可直接下发的建议动作
  function renderExplainCard(state, entityId) {
    var explain = state.data.explain;
    if (!explain || explain.id !== entityId) return "";

    var factorRows = safeArray(explain.factors)
      .map(function (f) {
        return (
          '<div class="explain-factor"><span>' +
          escapeHtml(f.label) +
          "</span>" +
          bar(f.share) +
          "<strong>" +
          f.share +
          "%</strong></div>"
        );
      })
      .join("");

    var mitigationRow = explain.mitigation
      ? '<div class="explain-factor is-mitigation"><span>' +
        escapeHtml(explain.mitigation.label) +
        "</span>" +
        bar(explain.mitigation.share, "bar-fill ok") +
        "<strong>-" +
        explain.mitigation.share +
        "%</strong></div>"
      : "";

    var chainRows = safeArray(explain.chain)
      .map(function (node) {
        var loadClass = node.load >= 80 ? "is-danger" : node.load >= 60 ? "is-warn" : "is-ok";
        return (
          '<button class="explain-chain-node ' +
          (node.hop === 0 ? "is-self " : "") +
          loadClass +
          '" data-entity-id="' +
          attr(node.id) +
          '"><span>' +
          escapeHtml(node.relation) +
          "</span><strong>" +
          escapeHtml(node.name) +
          "</strong><em>" +
          node.load +
          "</em></button>"
        );
      })
      .join("");

    var evidenceRows = safeArray(explain.evidence)
      .map(function (item) {
        return "<li>" + escapeHtml(item.text) + "</li>";
      })
      .join("");

    var actionRows = safeArray(explain.actions)
      .map(function (action) {
        return (
          '<button class="command-btn explain-action" data-command-type="' +
          attr(action.commandType) +
          '" data-target-id="' +
          attr(action.targetId || entityId) +
          '" data-command-title="' +
          attr(action.text) +
          '" data-command-impact="' +
          attr("来自因果归因建议") +
          '">' +
          escapeHtml(action.text) +
          "</button>"
        );
      })
      .join("");

    return (
      '<article class="explain-card">' +
      '<div class="explain-head"><h4>因果归因</h4><span>' +
      escapeHtml(explain.fingerprint + " / " + explain.clockLabel) +
      "</span></div>" +
      '<p class="explain-summary">' +
      escapeHtml(explain.summary) +
      "</p>" +
      (factorRows || mitigationRow
        ? '<div class="explain-factors">' + factorRows + mitigationRow + "</div>"
        : "") +
      (chainRows
        ? '<h4>传播链<span>点击节点跳转</span></h4><div class="explain-chain">' + chainRows + "</div>"
        : "") +
      (evidenceRows ? '<h4>证据</h4><ul class="explain-evidence">' + evidenceRows + "</ul>" : "") +
      (actionRows ? '<div class="explain-actions">' + actionRows + "</div>" : "") +
      "</article>"
    );
  }

  function renderDetail(state) {
    var entity = state.data.detail;
    if (!entity) {
      ref("detail-panel").innerHTML = '<div class="empty-state">请选择一个实体查看语义详情。</div>';
      setText("active-entity-title", "请选择实体");
      setText("active-entity-brief", "点击道路、车辆、设备或告警查看联动关系。");
      return;
    }

    setText("active-entity-title", entity.name);
    setText(
      "active-entity-brief",
      model.formatType(entity.displayType || entity.type) + " / " + model.statusText(entity.status) + " / " + entity.description
    );

    var stats = Object.keys(entity.stats || {})
      .map(function (key) {
        return '<div class="detail-stat"><span>' + escapeHtml(key) + "</span><strong>" + escapeHtml(entity.stats[key]) + "</strong></div>";
      })
      .join("");

    var relations = safeArray(entity.relations)
      .map(function (item) {
        return '<div class="relation-row"><span>' + escapeHtml(item.predicate) + "</span><strong>" + escapeHtml(item.object) + "</strong></div>";
      })
      .join("");

    ref("detail-panel").innerHTML =
      '<article class="detail-card">' +
      '<div class="detail-head"><div><h3>' +
      escapeHtml(entity.name) +
      '</h3><p>' +
      escapeHtml(model.formatType(entity.displayType || entity.type)) +
      '</p></div><span class="status-badge ' +
      statusClass(model.statusLevel(entity.status)) +
      '">' +
      escapeHtml(model.statusText(entity.status)) +
      "</span></div>" +
      '<p class="detail-desc">' +
      escapeHtml(entity.description) +
      "</p>" +
      '<div class="detail-grid">' +
      stats +
      "</div>" +
      '<h4>语义关系</h4><div class="relation-list">' +
      (relations || '<div class="empty-state compact">暂无语义关系。</div>') +
      "</div></article>" +
      renderExplainCard(state, entity.id);
  }

  function renderAlerts(state) {
    var rows = safeArray(state.data.alerts).map(function (alert) {
      return (
        '<article class="alert-row" data-entity-id="' +
        attr(alert.entityId || alert.id) +
        '">' +
        '<div class="alert-head"><h3>' +
        escapeHtml(alert.title) +
        '</h3><span class="severity-badge ' +
        statusClass(model.severityLevel(alert.severity)) +
        '">S' +
        escapeHtml(alert.severity) +
        "</span></div>" +
        '<div class="alert-meta">' +
        escapeHtml(alert.roadName + " / " + alert.category + " / " + alert.owner) +
        "</div>" +
        "<p>" +
        escapeHtml(alert.description) +
        "</p></article>"
      );
    });
    ref("alert-feed").innerHTML = rows.join("");
  }

  function renderForecast(state) {
    var forecast = state.data.forecast;
    if (!forecast) {
      ref("forecast-panel").innerHTML = '<div class="empty-state">等待预测数据。</div>';
      return;
    }

    var horizonRows = safeArray(forecast.horizons).map(function (item) {
      return (
        '<article class="forecast-card"><span>+' +
        item.minutes +
        ' min</span><strong>' +
        item.congestionIndex +
        '%</strong><p>均速 ' +
        item.avgSpeed +
        ' km/h / 风险 ' +
        item.alertRisk +
        "%</p>" +
        bar(item.confidence) +
        "</article>"
      );
    });

    var bottleneckRows = safeArray(forecast.bottlenecks).map(function (road) {
      return (
        '<article data-entity-id="' +
        attr(road.id) +
        '"><strong>' +
        escapeHtml(road.name) +
        "</strong><span>饱和度 " +
        road.load +
        "% / 排队 " +
        road.queueLength +
        "m</span></article>"
      );
    });

    ref("forecast-panel").innerHTML =
      '<div class="forecast-grid">' +
      horizonRows.join("") +
      "</div>" +
      '<div class="scenario-card"><div><span>无控制</span><strong>' +
      forecast.scenario.noAction +
      '%</strong></div><div><span>策略控制后</span><strong>' +
      forecast.scenario.withControl +
      '%</strong></div><div><span>节省延误</span><strong>' +
      forecast.scenario.savedDelayMinutes +
      " min</strong></div></div>" +
      '<div class="bottleneck-list">' +
      bottleneckRows.join("") +
      "</div>";
  }

  // 语义图节点太多面板塞不下,只取前 60 个节点、40 条边
  function renderGraph(state) {
    var graph = state.data.semanticGraph || { nodes: [], edges: [] };
    var nodes = safeArray(graph.nodes).slice(0, 60);
    var edges = safeArray(graph.edges).slice(0, 40);

    var nodeRows = nodes.map(function (node) {
      return (
        '<button class="graph-node severity-' +
        escapeHtml(node.severity || 1) +
        '" data-entity-id="' +
        attr(node.id) +
        '">' +
        escapeHtml(node.label) +
        "</button>"
      );
    });

    var edgeRows = edges.map(function (edge) {
      return (
        "<div><span>" +
        escapeHtml(edge.source) +
        "</span><strong>" +
        escapeHtml(edge.predicate) +
        "</strong><span>" +
        escapeHtml(edge.target) +
        "</span></div>"
      );
    });

    ref("graph-panel").innerHTML =
      '<div class="graph-summary"><strong>' +
      nodes.length +
      '</strong><span>语义节点</span><strong>' +
      edges.length +
      '</strong><span>关系边</span></div><div class="graph-nodes">' +
      nodeRows.join("") +
      '</div><div class="graph-edges">' +
      edgeRows.join("") +
      "</div>";
  }

  function renderControl(state) {
    var control = state.data.control;
    if (!control) {
      ref("strategy-tabs").innerHTML = '<div class="empty-state">等待控制策略。</div>';
      ref("recommendation-list").innerHTML = "";
      ref("command-log").innerHTML = "";
      return;
    }

    var strategyRows = safeArray(control.strategies).map(function (strategy) {
      return (
        '<button class="strategy-tab ' +
        (strategy.id === control.activeStrategy ? "active" : "") +
        '" data-strategy-id="' +
        attr(strategy.id) +
        '"><strong>' +
        escapeHtml(strategy.name) +
        "</strong><span>" +
        escapeHtml(strategy.description) +
        "</span></button>"
      );
    });
    ref("strategy-tabs").innerHTML = strategyRows.join("");

    var recommendationRows = safeArray(control.recommendations).map(function (item) {
      return (
        '<article class="recommendation-card"><div><span>' +
        escapeHtml(item.status) +
        "</span><h3>" +
        escapeHtml(item.title) +
        "</h3><p>" +
        escapeHtml(item.description) +
        "</p><small>" +
        escapeHtml(item.impact) +
        '</small></div><button class="command-btn" data-command-type="' +
        attr(item.commandType) +
        '" data-target-id="' +
        attr(item.targetId) +
        '" data-command-title="' +
        attr(item.title) +
        '" data-command-impact="' +
        attr(item.impact) +
        '">下发</button></article>'
      );
    });
    ref("recommendation-list").innerHTML = recommendationRows.join("");

    var commandRows = safeArray(control.commandLog).map(function (cmd) {
      return (
        "<article><span>" +
        escapeHtml(cmd.clockLabel) +
        "</span><strong>" +
        escapeHtml(cmd.title) +
        "</strong><p>" +
        escapeHtml(cmd.impact) +
        "</p></article>"
      );
    });
    ref("command-log").innerHTML = "<h3>指令日志</h3>" + commandRows.join("");
  }

  function renderDiagnostics(state) {
    var diagnostics = state.data.diagnostics;
    if (!diagnostics) {
      ref("diagnostics-panel").innerHTML = '<div class="empty-state">等待诊断数据。</div>';
      return;
    }

    var memory = diagnostics.memory || {};
    var apiTags = safeArray(diagnostics.apiSurface)
      .map(function (item) {
        return "<span>" + escapeHtml(item) + "</span>";
      })
      .join("");

    ref("diagnostics-panel").innerHTML =
      '<div class="diag-grid">' +
      '<article><span>推送客户端</span><strong>' +
      diagnostics.streamClients +
      "</strong></article>" +
      '<article><span>实体总量</span><strong>' +
      diagnostics.entityCount +
      "</strong></article>" +
      '<article><span>流版本</span><strong>' +
      diagnostics.streamVersion +
      "</strong></article>" +
      '<article><span>历史快照</span><strong>' +
      diagnostics.historySamples +
      "</strong></article>" +
      '<article><span>运行时长</span><strong>' +
      diagnostics.uptimeSeconds +
      " s</strong></article>" +
      '<article><span>堆内存</span><strong>' +
      Math.round((memory.heapUsed || 0) / 1024 / 1024) +
      " MB</strong></article>" +
      "</div>" +
      '<div class="api-list">' +
      apiTags +
      "</div>";
  }

  function renderHistory(state) {
    var history = safeArray(state.data.history);
    var rows = history.slice(0, 18).map(function (item) {
      return (
        '<article class="history-row"><div><strong>Tick ' +
        item.tick +
        "</strong><span>" +
        escapeHtml(item.clockLabel + " / " + item.reason + " / " + item.strategy) +
        "</span></div>" +
        bar(item.congestionIndex, item.congestionIndex > 70 ? "bar-fill danger" : "bar-fill") +
        "<p>拥堵 " +
        item.congestionIndex +
        "% / 在线 " +
        item.onlineRate +
        "% / 准点 " +
        item.punctuality +
        "% / 置信 " +
        item.confidence +
        "%</p></article>"
      );
    });

    ref("history-panel").innerHTML = history.length
      ? rows.join("")
      : '<div class="empty-state">等待时序快照。</div>';
  }

  function syncFilterChips(state) {
    document.querySelectorAll(".filter-chip").forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-filter") === state.filter);
    });
  }

  // 顶栏右侧的筛选反馈:当前条件下命中了多少实体
  function renderFilterFeedback(state) {
    var el = ref("filter-feedback");
    if (!el) return;
    var matched = safeArray(state.data.entities).length;
    var total = safeArray(state.data.allEntities).length;
    var filterName = state.filter === "all" ? "全部对象" : model.formatType(state.filter);
    var term = state.searchTerm ? " / 关键词：" + state.searchTerm : "";
    el.textContent = filterName + "：找到 " + matched + " / " + total + " 个" + term;
    el.classList.toggle("is-empty", matched === 0 && total > 0);
  }

  function bindControls(handlers) {
    ref("filter-group").addEventListener("click", function (event) {
      var chip = event.target.closest(".filter-chip");
      if (chip) {
        switchPanel("panel-explorer");
        handlers.onFilter(chip.getAttribute("data-filter"));
      }
    });

    ref("toggle-playback").addEventListener("click", handlers.onTogglePlayback);
    ref("focus-critical").addEventListener("click", handlers.onFocusCritical);
    ref("resolve-selected").addEventListener("click", handlers.onResolveSelected);

    ref("search-input").addEventListener("input", function (event) {
      switchPanel("panel-explorer");
      handlers.onSearch(event.target.value);
    });

    // 面板内容是 innerHTML 全量重绘的,子元素事件只能挂在 body 上做委托
    document.body.addEventListener("click", function (event) {
      var dock = event.target.closest(".dock-btn");
      if (dock) {
        switchPanel(dock.getAttribute("data-target"));
        return;
      }

      var strategy = event.target.closest(".strategy-tab");
      if (strategy) {
        handlers.onStrategy(strategy.getAttribute("data-strategy-id"));
        return;
      }

      var command = event.target.closest(".command-btn");
      if (command) {
        handlers.onCommand({
          commandType: command.getAttribute("data-command-type"),
          targetId: command.getAttribute("data-target-id"),
          title: command.getAttribute("data-command-title"),
          impact: command.getAttribute("data-command-impact"),
        });
        return;
      }

      var target = event.target.closest("[data-entity-id]");
      if (target) {
        handlers.onSelect(target.getAttribute("data-entity-id"));
      }
    });
  }

  function render(state) {
    renderBanner(state);
    syncHeader(state);
    renderSummary(state);
    syncFilterChips(state);
    renderFilterFeedback(state);
    renderMetrics(state);
    renderModelHealth(state);
    renderArterials(state);
    renderCorridors(state);
    renderEntityList(state);
    renderDetail(state);
    renderAlerts(state);
    renderForecast(state);
    renderGraph(state);
    renderControl(state);
    renderDiagnostics(state);
    renderHistory(state);
  }

  window.SemanticTwinUI = {
    bindControls: bindControls,
    render: render,
  };
})();

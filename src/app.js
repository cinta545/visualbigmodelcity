// 前端入口:负责拉取快照、维持 Socket.IO 实时流、维护全局 state,
// 再把 state 交给 SemanticTwinUI 全量重绘。没上框架,逻辑都收在这一个闭包里。
(function () {
  var ui = window.SemanticTwinUI;
  var searchTimer = null; // 搜索输入防抖
  var fallbackTimer = null; // 实时通道断开后的轮询定时器
  var stream = null;
  var twin3d = null;

  var state = {
    filter: "all",
    searchTerm: "",
    selectedId: null,
    explainFor: null, // 当前因果解释对应的实体 id,防止重复拉取
    connected: false,
    streamConnected: false,
    updateMode: "定时刷新",
    error: "",
    data: {
      overview: null,
      map: null,
      allEntities: [],
      entities: [],
      alerts: [],
      detail: null,
      explain: null,
      history: [],
      diagnostics: null,
      forecast: null,
      semanticGraph: { nodes: [], edges: [] },
      control: null,
    },
  };

  // 3D 视图异步加载,挂了也不影响 2D 面板正常工作
  import("./viewer3d.js?v=district-v1")
    .then(function (module) {
      var canvas = document.getElementById("twin-canvas");
      if (!canvas) return;
      twin3d = new module.SemanticTwin3D(canvas);
      canvas.addEventListener("entity-pick", function(event) {state.selectedId = event.detail; state.explainFor = null; syncSelection(); syncViewer(); render(true);});
      // 如果这时快照已经先到了,补一次地图构建
      if (state.data.map) {
        twin3d.buildMap(state.data.map);
        syncViewer();
      }
    })
    .catch(function (error) {
      console.warn("3D viewer unavailable, UI will continue.", error); var loading=document.getElementById("scene-loading"); if(loading) { loading.querySelector("p").textContent="三维场景加载失败："+error.message; }
    });

  function fetchJson(url, options) {
    return window.fetch(url, options).then(function (response) {
      // 非 2xx 就把响应体原样抛给上层展示
      if (!response.ok) {
        return response.text().then(function (text) {
          throw new Error(text || "HTTP " + response.status);
        });
      }
      return response.json();
    });
  }

  function postJson(url, payload) {
    return fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
  }

  // 类型 + 关键词双重过滤,再按严重度从高到低排
  function applyFilter() {
    var keyword = state.searchTerm.toLowerCase();
    var list = state.data.allEntities.filter(function (entity) {
      var typeOk = state.filter === "all" || entity.type === state.filter;
      var textOk = !keyword || String(entity.searchable || "").toLowerCase().indexOf(keyword) >= 0;
      return typeOk && textOk;
    });

    list.sort(function (a, b) {
      return (b.severity || 0) - (a.severity || 0) || a.name.localeCompare(b.name, "zh-CN");
    });

    state.data.entities = list;
  }

  // 选中项被过滤条件藏掉时,自动回落到列表第一项,保证详情面板始终有内容
  function syncSelection() {
    var detail = null;
    var visibleIds = new Set(
      state.data.entities.map(function (item) {
        return item.id;
      })
    );

    if (state.selectedId) {
      var stillVisible = visibleIds.has(state.selectedId) || (state.filter === "all" && !state.searchTerm);
      if (stillVisible) {
        detail = state.data.allEntities.find(function (item) {
          return item.id === state.selectedId;
        });
      }
    }

    if (!detail) {
      state.selectedId = state.data.entities.length ? state.data.entities[0].id : null;
      if (state.selectedId) {
        detail = state.data.allEntities.find(function (item) {
          return item.id === state.selectedId;
        });
      }
    }

    state.data.detail = detail || null;
  }

  // 把当前状态同步进 3D 场景:地图只建一次,实体和路况指标每帧都刷
  function syncViewer() {
    if (!twin3d) return;
    if (state.data.map && !twin3d.mapConstructed) {
      twin3d.buildMap(state.data.map);
    }
    var visibleIds = state.data.entities.map(function (item) {
      return item.id;
    });
    var filterActive = state.filter !== "all" || Boolean(state.searchTerm);
    twin3d.updateEntities(state.data.allEntities, state.selectedId, visibleIds, filterActive, state.filter);
    if (state.data.map) {
      twin3d.updateRoadMetrics(state.data.map.roadMetrics || {});
      twin3d.updateMapState(state.data.map);
    }
  }

  // 一帧数据进来:先落库,再走 过滤 -> 选中 -> 3D -> 渲染 这条流水线
  function applyFrame(frame) {
    state.data.overview = frame.overview || null;
    state.data.map = frame.map || null;
    state.data.allEntities = frame.entities || [];
    state.data.alerts = frame.alerts || [];
    state.data.history = frame.history || [];
    state.data.diagnostics = frame.diagnostics || null;
    state.data.forecast = frame.forecast || (frame.overview && frame.overview.derived ? frame.overview.derived.forecast : null);
    state.data.semanticGraph = frame.semanticGraph || { nodes: [], edges: [] };
    state.data.control = frame.control || (frame.overview ? frame.overview.control : null);
    state.connected = true;
    state.error = "";
    applyFilter();
    syncSelection();
    syncViewer();
    render();
  }

  function loadSnapshot() {
    return fetchJson("/api/frame")
      .then(applyFrame)
      .catch(function (error) {
        state.connected = false;
        state.error = error.message || "后端连接异常";
        render();
      });
  }

  function stopFallbackPolling() {
    if (fallbackTimer) {
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  // 实时通道不可用就退回 2.5s 轮询,别让页面干等
  function startFallbackPolling() {
    if (fallbackTimer) return;
    state.updateMode = "定时刷新";
    fallbackTimer = window.setInterval(loadSnapshot, 2500);
  }

  function markStreamAlive() {
    state.streamConnected = true;
    state.updateMode = "实时推送";
    stopFallbackPolling();
  }

  function connectStream() {
    // 引不到 socket.io 客户端脚本时,直接走轮询
    if (typeof io !== "function") {
      startFallbackPolling();
      return;
    }

    if (stream) stream.disconnect();
    stream = io();

    stream.on("connect", function () {
      markStreamAlive();
      render();
    });

    // 连上先收一帧全量快照,之后每 tick 收增量
    stream.on("snapshot", function (frame) {
      markStreamAlive();
      applyFrame(frame);
    });

    stream.on("state", function (frame) {
      markStreamAlive();
      applyFrame(frame);
    });

    stream.on("disconnect", function () {
      state.streamConnected = false;
      state.updateMode = "定时刷新";
      startFallbackPolling();
      render();
    });

    stream.on("connect_error", function () {
      state.streamConnected = false;
      startFallbackPolling();
      render();
    });
  }

  function runCommand(payload) {
    return postJson("/api/commands", payload)
      .then(loadSnapshot)
      .catch(function (error) {
        state.error = error.message || "指令下发失败";
        render();
      });
  }

  // 选中实体变了就去拉一份因果解释;同 id 只拉一次,tick 推送不会重复请求
  function maybeLoadExplain() {
    var id = state.selectedId;
    if (!id || state.explainFor === id) return;
    state.explainFor = id;

    fetchJson("/api/explain/" + encodeURIComponent(id))
      .then(function (data) {
        state.data.explain = data;
        ui.render(state);
      })
      .catch(function () {
        state.data.explain = null;
      });
  }

  var lastUiRender=0;
  function render(force) {
    maybeLoadExplain();
    if(!force && performance.now()-lastUiRender<450)return;
    lastUiRender=performance.now();ui.render(state);
  }

  ui.bindControls({
    onSelect: function (entityId) {
      state.selectedId = entityId;
      syncSelection();
      syncViewer();
      if (twin3d) twin3d.focusEntity(entityId);
      render();
    },
    onFilter: function (filter) {
      state.filter = filter;
      applyFilter();
      syncSelection();
      syncViewer();
      render();
    },
    onTogglePlayback: function () {
      postJson("/api/playback/toggle").catch(function (error) {
        state.error = error.message || "播放控制失败";
        render();
      });
    },
    // 一键定位到优先级最高的告警
    onFocusCritical: function () {
      if (!state.data.alerts[0]) return;
      state.selectedId = state.data.alerts[0].entityId || state.data.alerts[0].id;
      syncSelection();
      syncViewer();
      if (twin3d) twin3d.focusEntity(state.selectedId);
      render();
    },
    onResolveSelected: function () {
      // 优先闭环当前选中实体挂着的告警,选不中就处理第一条
      var alert = state.data.alerts.find(function (item) {
        return item.id === state.selectedId || item.entityId === state.selectedId;
      });
      if (!alert) alert = state.data.alerts[0];
      if (!alert) return;

      postJson("/api/alerts/" + encodeURIComponent(alert.id) + "/resolve")
        .then(loadSnapshot)
        .catch(function (error) {
          state.error = error.message || "告警闭环失败";
          render();
        });
    },
    onSearch: function (term) {
      state.searchTerm = term.trim();
      // 120ms 防抖,不然每敲一个字符就全量重绘一次,太卡
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        applyFilter();
        syncSelection();
        syncViewer();
        render();
      }, 120);
    },
    onStrategy: function (strategyId) {
      postJson("/api/control/strategy", { strategyId: strategyId })
        .then(loadSnapshot)
        .catch(function (error) {
          state.error = error.message || "策略切换失败";
          render();
        });
    },
    onCommand: runCommand,
  });

  // 先渲染一次空态,再拉快照,最后尝试升级成实时推送
  render();
  loadSnapshot().finally(connectStream);
})();

import { useShallow } from "zustand/react/shallow";
import { useState, useMemo } from "react";
import { useStore } from "../../store/useStore";
import type { ErrorLevel } from "../../types";
import {
  getNodeName,
  GANGNAM_ROOM_1_NODE_ID,
  DAEJEON_ROOM_NODE_ID,
} from "../../utils/nodeUtils";
import { Icon } from "@iconify/react";

// Responsive Water Drop SVG component
const WaterDropIcon = ({ percentage }: { percentage: number }) => {
  // Map 0-100% to fill level (SVG Y coordinates roughly from 22 down to 2)
  const fillY = 22 - (percentage / 100) * 20;

  return (
    <svg
      width="18"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="weather-drop-svg"
    >
      <defs>
        <clipPath id={`drop-clip-${percentage.toFixed(0)}`}>
          <path d="M12 2.1C12 2.1 5 10 5 15.5C5 19.1 7.9 22 11.5 22C15.1 22 18 19.1 18 15.5C18 10 11 2.1 11 2.1H12Z" />
        </clipPath>
      </defs>
      {/* Background/Outline */}
      <path
        d="M12 2.1C12 2.1 5 10 5 15.5C5 19.1 7.9 22 11.5 22C15.1 22 18 19.1 18 15.5C18 10 11 2.1 11 2.1H12Z"
        stroke="var(--border-medium)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Filling Rect */}
      <rect
        x="0"
        y={fillY}
        width="24"
        height="24"
        fill="var(--theme-primary)"
        clipPath={`url(#drop-clip-${percentage.toFixed(0)})`}
      />
    </svg>
  );
};

// Error item for table display
interface ErrorItem {
  nodeId: string;
  nodeName: string;
  rackId: string;
  rackName: string;
  deviceId: string;
  deviceName: string;
  portId: string;
  displayPort: string;
  severity: ErrorLevel;
  errorClass: "DEV" | "PORT" | "LINE";
  errorTitle: string;
  errorDescription: string;
}

// Severity config for display - STN style
const severityConfig: Record<
  ErrorLevel,
  {
    label: string;
    shortLabel: string;
    bgClass: string;
    chipClass: string;
    statBg: string;
    statColor: string;
    icon: string;
  }
> = {
  critical: {
    label: "Critical",
    shortLabel: "CRIT",
    bgClass: "severity-critical",
    chipClass: "comm-chip-critical",
    statBg: "var(--severity-critical-bg)",
    statColor: "var(--severity-critical)",
    icon: "ph:x-circle-fill",
  },
  major: {
    label: "Major",
    shortLabel: "MAJ",
    bgClass: "severity-major",
    chipClass: "comm-chip-major",
    statBg: "var(--severity-major-bg)",
    statColor: "var(--severity-major)",
    icon: "ph:warning-fill",
  },
  minor: {
    label: "Minor",
    shortLabel: "MIN",
    bgClass: "severity-minor",
    chipClass: "comm-chip-minor",
    statBg: "var(--severity-minor-bg)",
    statColor: "var(--severity-minor)",
    icon: "ph:warning-fill",
  },
  warning: {
    label: "Warning",
    shortLabel: "WRN",
    bgClass: "severity-warning",
    chipClass: "comm-chip-warning",
    statBg: "var(--severity-warning-bg)",
    statColor: "var(--severity-warning)",
    icon: "mdi:alert-circle",
  },
};

// Sensor data type (mock for now)
export interface SensorData {
  temperature: number | null;
  humidity: number | null;
}

// Mock sensor data per known node ID
export const MOCK_SENSOR_DATA: Record<string, SensorData> = {
  [GANGNAM_ROOM_1_NODE_ID]: { temperature: 31.5, humidity: 45.0 },
  [GANGNAM_ROOM_1_NODE_ID.replace("-1", "-2")]: {
    temperature: 22.1,
    humidity: 39.0,
  }, // gangnam-room-2
  [DAEJEON_ROOM_NODE_ID]: { temperature: 23.8, humidity: 42.0 },
  ["gwacheon-center"]: { temperature: 23.2, humidity: 41.0 },
  ["daejeon-center"]: { temperature: 23.1, humidity: 54.0 },
  ["sudogwon"]: { temperature: 24.4, humidity: 43.0 },
  ["chungcheong"]: { temperature: 21.0, humidity: 62.0 },
  ["gyeonggi"]: { temperature: 23.8, humidity: 44.0 },
  ["daejeon-city"]: { temperature: 21.3, humidity: 43.0 },
};

/** 노드 ID에 대한 결정론적 센서 데이터 반환 (MOCK_SENSOR_DATA 우선, 없으면 해시 기반 생성) */
export const getNodeSensorData = (nodeId: string): SensorData => {
  if (MOCK_SENSOR_DATA[nodeId]) return MOCK_SENSOR_DATA[nodeId];
  // Deterministic hash-based fallback for unknown nodes
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0;
  }
  const t = 20 + (Math.abs(hash) % 50) / 10; // 20.0 ~ 24.9
  const h = 30 + (Math.abs(hash >> 8) % 400) / 10; // 30.0 ~ 69.9
  return { temperature: Math.round(t * 10) / 10, humidity: Math.round(h) };
};


const getErrorClass = (deviceName: string, portId: string): "DEV" | "PORT" | "LINE" => {
  const p = portId.toLowerCase();
  if (p.includes("pwr") || p.includes("fan") || deviceName.toLowerCase().includes("server") || deviceName.includes("스토리지")) return "DEV";
  if (p.includes("uplink") || p.includes("line")) return "LINE";
  return "PORT";
};

const getErrorDescription = (severity: ErrorLevel, errorClass: string) => {
  if (errorClass === "DEV") {
    if (severity === "critical") return "메인 전원 공급 장치(PSU) 팬 결함 및 급격한 보드 온도 상승 경보 (78°C)";
    if (severity === "major") return "OS 커널 패닉 감지 및 이중화 시스템 백업 강제 세그먼테이션 오류 복구 루프";
    if (severity === "minor") return "CPU 코어 점유율 98.4% 임계치 위험 초과 (미완성 백그라운드 프로세스 폭주)";
    return "커널 메모리 가용량 급감 경보 (시스템 가용 Memory < 4.2%)";
  }
  if (errorClass === "LINE") {
    return "회선 연결 불량 및 트래픽 유실 경보";
  }
  if (severity === "critical") return "광 수신 레벨 저하 위험치 돌파 (RX Light Power < -29.2dBm) 및 전송 감쇄 오류";
  if (severity === "major") return "이더넷 프레임 정렬 에러(Align Error) 폭주 및 물리 포트 수신 버퍼 오버플로우";
  if (severity === "minor") return "인터페이스 라인 루프백(Loopback) 오설정 감지 및 포트 보안 위반 강제 비활성화";
  return "포트 수신 패킷 CRC 에러 유실률 폭주 (임계 패킷 드랍률 > 5.5% 돌파)";
};

export const DashboardWidgets = () => {
  const nodes = useStore((state) => state.nodes);
  const activeNodeId = useStore((state) => state.activeNodeId);
  const setActiveNode = useStore((state) => state.setActiveNode);
  const selectRack = useStore((state) => state.selectRack);
  const focusRack = useStore((state) => state.focusRack);
  const selectDevice = useStore((state) => state.selectDevice);
  const [isErrorListExpanded, setIsErrorListExpanded] = useState(false);
  // Collect ALL racks from ALL nodes
  const allRacks = useStore(
    useShallow((state) => {
      const result = [...state.racks];
      Object.entries(state.layouts).forEach(([nid, layout]) => {
        if (nid !== state.activeNodeId) {
          result.push(...(layout.racks || []));
        }
      });
      return result;
    }),
  );

  // Collect all errors from all racks
  const allErrors = useMemo<ErrorItem[]>(() => {
    const errors: ErrorItem[] = [];
    allRacks.forEach((rack) => {
      const nodeName = getNodeName(nodes, rack.mapId);
      rack.devices.forEach((device) => {
        device.portStates.forEach((port) => {
          if (port.status === "error" && port.errorLevel) {
            let displayPort = port.portId;
            if (port.portName && port.portNumber) {
              if (port.portName.toLowerCase() === "port") {
                displayPort = String(port.portNumber);
              } else {
                displayPort = `${port.portNumber}\n${port.portName.toUpperCase()}`;
              }
            } else if (port.portName) {
              displayPort = port.portName.toUpperCase();
              if (displayPort === "PORT")
                displayPort = port.portId.replace("port-", "");
            } else if (port.portNumber) {
              displayPort = String(port.portNumber);
            } else {
              displayPort = port.portId.replace("port-", "");
            }

            const errClass = getErrorClass(device.title, port.portId);
            const errTitle = errClass === "DEV" ? device.title : (errClass === "LINE" ? `${displayPort} - ${displayPort} (Uplink)` : displayPort);
            errors.push({
              nodeId: rack.mapId,
              nodeName: nodeName,
              rackId: rack.rackId,
              rackName: rack.rackTitle || `Rack ${rack.rackId.slice(0, 4)}`,
              deviceId: device.itemId,
              deviceName: device.title,
              portId: port.portId,
              displayPort: displayPort,
              severity: port.errorLevel,
              errorClass: errClass,
              errorTitle: errTitle,
              errorDescription: getErrorDescription(port.errorLevel, errClass),
            });
          }
        });
      });
    });
    return errors;
  }, [allRacks, nodes]);

  // Handle error row click
  const handleErrorRowClick = (error: ErrorItem) => {
    // If from another node, switch first
    if (activeNodeId !== error.nodeId) {
      setActiveNode(error.nodeId);
    }

    // First select and focus the rack
    selectRack(error.rackId);
    focusRack(error.rackId);
    // Then open the device modal with highlighted port (use setTimeout to ensure state updates)
    setTimeout(() => {
      selectDevice(error.deviceId, error.portId);
    }, 50);
  };

  // Count errors by severity
  const errorCounts = useMemo(() => {
    const counts: Record<ErrorLevel, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      warning: 0,
    };
    allErrors.forEach((err) => {
      counts[err.severity]++;
    });
    return counts;
  }, [allErrors]);

  // Filter errors by selected severity
  const severityOrder: Record<ErrorLevel, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    warning: 3,
  };

  const displayErrors = useMemo(() => {
    return [...allErrors].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [allErrors]);

  // Collect sensor data for all nodes in the hierarchy
  const allNodeSensors = useMemo(() => {
    // Priority 1: Nodes that actually exist in hierarchy
    const sensorList = nodes
      .filter((node) => node.type === "room") // Only include server rooms
      .map((node) => ({
        id: node.nodeId,
        name: node.name,
        data: getNodeSensorData(node.nodeId),
      }));

    // Return only nodes that exist in hierarchy
    return sensorList;
  }, [nodes]);

  return (
    <div className="dashboard-widgets-container">

      {/* Widget 1 Wrapper to position list correctly */}
      <div className="dashboard-widgets-wrapper">
        {/* Widget 1: Error Summary - Redesigned Panel */}
        <div className="error-panel">
          <div className="error-panel-header">
            <h3 className="error-panel-title">전체 장애 현황</h3>
            <span className="error-panel-total">TOTAL ALARMS</span>
          </div>

          <div className="error-panel-content">
            <div className="error-stat-cards">
              {(Object.keys(severityConfig) as ErrorLevel[]).map((level) => {
                const config = severityConfig[level];
                const count = errorCounts[level];
                return (
                  <div key={level} className="error-stat-card">
                    <div className="error-stat-card-header">
                      <Icon icon={config.icon} className="error-stat-icon" style={{ color: config.statColor }} />
                      <span className="error-stat-label">{config.label}</span>
                    </div>
                    <div className="error-stat-count" style={{ color: config.statColor }}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="error-panel-footer">
              <div className="error-summary-text">
                발생 <span className="highlight-white">{allErrors.length}</span>
                <span className="spacer"></span>
                <span className="highlight-green-label">인지</span> <span className="highlight-white">{Math.floor(allErrors.length * 0.7)}</span>
                <span className="spacer"></span>
                <span className="highlight-blue-label">통보</span> <span className="highlight-white">{Math.floor(allErrors.length * 0.4)}</span>
              </div>
              <button
                className="error-toggle-btn"
                onClick={() => setIsErrorListExpanded(!isErrorListExpanded)}
              >
                <div className="error-toggle-btn-inner">
                  리스트 {isErrorListExpanded ? "접기" : "펼치기"}
                  <Icon
                    icon={isErrorListExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}
                    className="error-toggle-icon"
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Widget 1.5: Expandable Error List */}
        {isErrorListExpanded && (
          <div className="error-list-panel">
            <div className="error-list-header">
              <h3 className="error-list-title">장애 리스트</h3>
              <span className="error-list-total">총 {displayErrors.length}건</span>
            </div>
            <div className="error-list-table-container">
              <table className="error-list-table">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>분류</th>
                    <th>그룹</th>
                    <th className="ta_l">대상</th>
                    <th className="ta_l">장애 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {displayErrors.length > 0 ? (
                    displayErrors.map((err, idx) => {
                      const config = severityConfig[err.severity];
                      return (
                        <tr
                          key={idx}
                          onClick={() => handleErrorRowClick(err)}
                        >
                          <td>
                            <div className={`comm-chip ${config.chipClass} comm-chip-center`}>{config.shortLabel}</div>
                          </td>
                          <td>
                            <span className="error-list-class-text">
                              {err.errorClass}
                            </span>
                          </td>
                          <td>
                            <span className="error-list-node-text">
                              {err.nodeName}
                            </span>
                          </td>
                          <td className="ta_l">
                            <span className="error-list-title-text">
                              {err.errorTitle}
                            </span>
                          </td>
                          <td className="ta_l">
                            <span className="error-list-desc-text">
                              {err.errorDescription}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="error-list-empty">"No errors"</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Widget 2: Global Sensor Overview - Refined Weather Style */}
      <div className="error-panel">
        <div className="error-panel-header">
          <h3 className="error-panel-title">온·습도 현황</h3>
          <span className="error-panel-total">SYSTEM SENSORS</span>
        </div>
        <div className="error-panel-content">
          <div className="comm-sensor-widget">
            <div className="weather-list">
              {allNodeSensors.length > 0 ? (
                allNodeSensors.map((node) => {
                  const isActive = node.id === activeNodeId;
                  const temp = node.data.temperature || 0;
                  const hum = node.data.humidity || 0;

                  // Normalize temp for gauge bar (assuming 15°C - 35°C range)
                  const tempPercent = Math.min(
                    100,
                    Math.max(0, ((temp - 15) / 20) * 100),
                  );

                  let tempGradient =
                    "linear-gradient(to right, rgba(var(--theme-primary-rgb), 0.3), var(--theme-primary))";
                  let tempShadow = "0 0 8px rgba(var(--theme-primary-rgb), 0.5)";

                  if (tempPercent >= 80) {
                    // > 31°C
                    tempGradient =
                      "linear-gradient(to right, var(--theme-primary), #ef4444)";
                    tempShadow = "0 0 8px rgba(239, 68, 68, 0.6)";
                  } else if (tempPercent >= 60) {
                    // > 27°C
                    tempGradient =
                      "linear-gradient(to right, var(--theme-primary), #f97316)";
                    tempShadow = "0 0 8px rgba(249, 115, 22, 0.6)";
                  }

                  return (
                    <div
                      key={node.id}
                      className={`weather-row ${isActive ? "active" : ""}`}
                      onClick={() => setActiveNode(node.id)}
                    >
                      <div className="weather-node-name" title={node.name}>
                        <div className="weather-node-flex">
                          <div className="weather-dot-container">
                            {isActive && <div className="weather-active-dot" />}
                          </div>
                          <span className="weather-node-text">
                            {node.name}
                          </span>
                        </div>
                      </div>

                      {/* Temperature Info (Value & Gauge only) */}
                      <div className="weather-temp">{temp.toFixed(1)}°</div>
                      <div
                        className="weather-bar-container"
                        title={`Temperature: ${temp.toFixed(1)}°C`}
                      >
                        <div className="weather-track">
                          <div
                            className="weather-temp-gradient"
                            style={{
                              width: `${tempPercent}%`,
                              background: tempGradient,
                              boxShadow: tempShadow,
                            }}
                          />
                        </div>
                      </div>

                      {/* Humidity Info (Drop Icon & Percent) */}
                      <div
                        className="weather-drop-wrap"
                        title={`Humidity: ${hum.toFixed(0)}%`}
                      >
                        <WaterDropIcon percentage={hum} />
                      </div>
                      <div className="weather-humidity-percent">
                        {hum.toFixed(0)}%
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="weather-empty">
                  No sensor nodes found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

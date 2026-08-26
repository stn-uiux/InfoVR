import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useStore } from "../store/useStore";

const DUMMY_ACCOUNTS = [
  { id: 1, name: "김운영", email: "admin@infovr.local", role: "admin", status: "활성" },
  { id: 2, name: "박관리", email: "manager@infovr.local", role: "editor", status: "활성" },
  { id: 3, name: "이담당", email: "viewer1@infovr.local", role: "viewer", status: "정지" },
  { id: 4, name: "최엔지니어", email: "eng@infovr.local", role: "editor", status: "활성" },
];

export const AccountPermissionsModal = () => {
  const { settingsModalOpen, setSettingsModalOpen, settingsModalTab, setSettingsModalTab, showToast } = useStore();
  const [accounts, setAccounts] = useState(DUMMY_ACCOUNTS);

  if (!settingsModalOpen) return null;

  const handleClose = () => {
    setSettingsModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if(confirm("정말 이 계정을 삭제하시겠습니까?")) {
      setAccounts(accounts.filter(acc => acc.id !== id));
      showToast("계정이 성공적으로 삭제되었습니다.", "success");
    }
  };

  const handleRoleChange = (id: number, newRole: string) => {
    setAccounts(accounts.map(u => u.id === id ? { ...u, role: newRole } : u));
    showToast("권한이 성공적으로 변경되었습니다.", "success");
  };

  return createPortal(
    <>
      <div className="comm-modal-overlay" onClick={handleClose} style={{ backdropFilter: 'blur(8px)' }} />
      <div 
        className="comm-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ width: "900px", maxWidth: "90vw", background: "var(--panel-bg)", border: "1px solid var(--panel-border)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Icon icon="fluent:settings-24-filled" style={{ fontSize: "28px", color: "var(--theme-primary)" }} />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>시스템 설정</h2>
          </div>
          <button 
            onClick={handleClose} 
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <Icon icon="fluent:dismiss-24-regular" style={{ fontSize: "24px" }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-medium)", marginBottom: "24px" }}>
          <button
            onClick={() => setSettingsModalTab('accounts')}
            style={{ 
              padding: "12px 24px", 
              background: "transparent", 
              border: "none", 
              borderBottom: settingsModalTab === 'accounts' ? "3px solid var(--theme-primary)" : "3px solid transparent",
              color: settingsModalTab === 'accounts' ? "var(--theme-primary)" : "var(--text-secondary)",
              fontWeight: settingsModalTab === 'accounts' ? 700 : 500,
              cursor: "pointer",
              fontSize: "15px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <Icon icon="fluent:people-24-regular" style={{ fontSize: "20px" }} />
            계정 관리
          </button>
          <button
            onClick={() => setSettingsModalTab('permissions')}
            style={{ 
              padding: "12px 24px", 
              background: "transparent", 
              border: "none", 
              borderBottom: settingsModalTab === 'permissions' ? "3px solid var(--theme-primary)" : "3px solid transparent",
              color: settingsModalTab === 'permissions' ? "var(--theme-primary)" : "var(--text-secondary)",
              fontWeight: settingsModalTab === 'permissions' ? 700 : 500,
              cursor: "pointer",
              fontSize: "15px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <Icon icon="fluent:shield-keyhole-24-regular" style={{ fontSize: "20px" }} />
            권한 설정
          </button>
        </div>

        {/* Tab Content: Accounts */}
        {settingsModalTab === 'accounts' && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>전체 계정을 조회하고 계정을 수정, 삭제, 생성할 수 있습니다.</p>
              <button className="comm-btn comm-btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon icon="fluent:person-add-24-filled" /> 새 계정 추가
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {accounts.map(acc => (
                <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--bg-canvas)", border: "1px solid var(--border-weak)", borderRadius: "8px", transition: "background 0.2s ease" }} className="comm-list-item">
                  
                  {/* Left side: Avatar & Info */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
                    <div style={{ width: "40px", height: "40px", background: "rgba(12, 139, 223, 0.1)", color: "var(--theme-primary)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                      <Icon icon="fluent:person-24-filled" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "15px" }}>{acc.name}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{acc.email}</div>
                    </div>
                  </div>

                  {/* Right side: Role, Status, Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                    <div style={{ width: "80px", textAlign: "center" }}>
                      <span style={{ 
                        background: acc.role === "admin" ? "rgba(12, 139, 223, 0.1)" : (acc.role === "editor" ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.1)"), 
                        color: acc.role === "admin" ? "var(--theme-primary)" : (acc.role === "editor" ? "#10b981" : "var(--text-secondary)"),
                        padding: "4px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700 
                      }}>
                        {acc.role.toUpperCase()}
                      </span>
                    </div>
                    
                    <div style={{ width: "60px", textAlign: "center" }}>
                       <span style={{ color: acc.status === "활성" ? "#10b981" : "#ef4444", fontWeight: 600, fontSize: "14px" }}>
                          ● {acc.status}
                       </span>
                    </div>

                    <div style={{ display: "flex", gap: "12px", width: "70px", justifyContent: "flex-end" }}>
                      <button style={{ background: "transparent", border: "none", color: "var(--theme-primary)", cursor: "pointer" }} title="수정">
                        <Icon icon="fluent:edit-24-regular" style={{ fontSize: "20px" }} />
                      </button>
                      <button onClick={() => handleDelete(acc.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }} title="삭제">
                        <Icon icon="fluent:delete-24-regular" style={{ fontSize: "20px" }} />
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Permissions */}
        {settingsModalTab === 'permissions' && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>시스템 사용자들의 접근 및 편집 권한을 관리합니다.</p>
              
              <div className="role-help-tooltip-container" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Icon icon="fluent:question-circle-24-regular" style={{ fontSize: "18px", color: "var(--text-tertiary)", cursor: "help" }} />
                <div className="role-help-tooltip">
                  <div style={{ marginBottom: "8px" }}>
                    <strong style={{ color: "var(--theme-primary)" }}>관리자 (Admin)</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>모든 관리대상(모델, 장비, 계정, 권한)의 수정, 삭제, 생성 권한</div>
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <strong style={{ color: "#10b981" }}>편집자 (Editor)</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>에디트 모드에서 모델, 장비를 수정, 삭제, 생성 할 수 있음 (계정/권한 관리 불가)</div>
                  </div>
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>조회자 (Viewer)</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>모니터링만 가능</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {accounts.map(user => (
                <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--bg-canvas)", border: "1px solid var(--border-weak)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "40px", height: "40px", background: "rgba(12, 139, 223, 0.1)", color: "var(--theme-primary)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                      <Icon icon="fluent:person-24-filled" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "15px" }}>{user.name}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{user.email}</div>
                    </div>
                  </div>
                  
                  <div>
                    <select 
                      className="comm-select"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      <option value="admin">관리자 (Admin)</option>
                      <option value="editor">편집자 (Editor)</option>
                      <option value="viewer">조회자 (Viewer)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      
      <style>{`
        .comm-list-item:hover {
          background: var(--hover-bg) !important;
        }

        .comm-select {
          background: var(--bg-input, rgba(0, 0, 0, 0.1));
          color: var(--text-primary);
          border: 1px solid var(--border-medium);
          border-radius: 6px;
          padding: 8px 12px;
          min-width: 150px;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .comm-select:focus {
          border-color: var(--theme-primary);
        }

        /* Fix for select options dark/light mode */
        .comm-select option {
          background-color: var(--panel-bg);
          color: var(--text-primary);
        }

        /* Tooltip styling */
        .role-help-tooltip {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: 280px;
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s ease;
          z-index: 100;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .role-help-tooltip-container:hover .role-help-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
      `}</style>
    </>,
    document.body
  );
};

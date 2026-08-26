import React from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useStore } from "../store/useStore";

export const MyPageModal = () => {
  const { myPageModalOpen, setMyPageModalOpen, showToast } = useStore();

  if (!myPageModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("개인정보가 성공적으로 저장되었습니다.", "success");
    setMyPageModalOpen(false);
  };

  const handleClose = () => {
    setMyPageModalOpen(false);
  };

  return createPortal(
    <>
      <div className="comm-modal-overlay" onClick={handleClose} style={{ backdropFilter: 'blur(8px)' }} />
      <div 
        className="comm-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ width: "500px", maxWidth: "90vw", background: "var(--panel-bg)", border: "1px solid var(--panel-border)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Icon icon="fluent:contact-card-24-filled" style={{ fontSize: "28px", color: "var(--theme-primary)" }} />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>마이페이지</h2>
          </div>
          <button 
            onClick={handleClose} 
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <Icon icon="fluent:dismiss-24-regular" style={{ fontSize: "24px" }} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", marginBottom: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div 
              style={{ width: "100px", height: "100px", fontSize: "50px", border: "3px solid var(--theme-primary)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--theme-primary)", background: "rgba(12, 139, 223, 0.1)" }}
            >
              <Icon icon="fluent:person-24-filled" />
            </div>
            <div style={{ background: "rgba(12, 139, 223, 0.2)", color: "var(--theme-primary)", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 700 }}>
              관리자 (Admin)
            </div>
          </div>

          <form onSubmit={handleSave} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>이름</label>
              <div style={{ position: "relative" }}>
                <Icon icon="fluent:person-24-regular" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input 
                  type="text" 
                  className="comm-input" 
                  defaultValue="김운영"
                  required 
                  style={{ width: "100%", paddingLeft: "40px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>아이디 (이메일)</label>
              <div style={{ position: "relative" }}>
                <Icon icon="fluent:mail-24-regular" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input 
                  type="text" 
                  className="comm-input" 
                  defaultValue="admin@infovr.local"
                  readOnly
                  style={{ width: "100%", paddingLeft: "40px", opacity: 0.7, cursor: "not-allowed" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>새 비밀번호 (선택)</label>
              <div style={{ position: "relative" }}>
                <Icon icon="fluent:key-24-regular" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <input 
                  type="password" 
                  className="comm-input" 
                  placeholder="비밀번호 변경 시 입력" 
                  style={{ width: "100%", paddingLeft: "40px" }}
                />
              </div>
            </div>
          </form>
        </div>

        <div className="comm-modal-actions">
          <button type="button" className="comm-btn comm-btn-secondary" onClick={handleClose}>
            취소
          </button>
          <button type="button" className="comm-btn comm-btn-primary" onClick={handleSave}>
            저장하기
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};

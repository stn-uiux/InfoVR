import React from "react";
import { Icon } from "@iconify/react";
import { useStore } from "../../store/useStore";
import { StnModal } from "../ui/StnModal";
import { StnInput } from "../ui/StnInput";

export const MyPageModal = () => {
  const { myPageModalOpen, setMyPageModalOpen, showToast } = useStore();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("개인정보가 성공적으로 저장되었습니다.", "success");
    setMyPageModalOpen(false);
  };

  const handleClose = () => {
    setMyPageModalOpen(false);
  };

  return (
    <StnModal
      isOpen={myPageModalOpen}
      onClose={handleClose}
      title="마이페이지"
      icon="fluent:contact-card-24-filled"
      className="mypage-modal"
    >
      <div className="mypage-content">
        <div className="mypage-profile-col">
          <div className="profile-avatar-lg">
            <Icon icon="fluent:person-24-filled" />
          </div>
          <div className="profile-role-badge">
            관리자 (Admin)
          </div>
        </div>

        <form onSubmit={handleSave} className="mypage-form">
          <div>
            <label className="stn-form-label">이름</label>
            <StnInput 
              icon="fluent:person-24-regular"
              type="text" 
              defaultValue="김운영"
              required 
            />
          </div>

          <div>
            <label className="stn-form-label">아이디 (이메일)</label>
            <StnInput 
              icon="fluent:mail-24-regular"
              type="text" 
              defaultValue="admin@infovr.local"
              readOnly
              style={{ opacity: 0.7, cursor: "not-allowed" }}
            />
          </div>

          <div>
            <label className="stn-form-label">새 비밀번호 (선택)</label>
            <StnInput 
              icon="fluent:key-24-regular"
              type="password" 
              placeholder="비밀번호 변경 시 입력" 
            />
          </div>
        </form>
      </div>

      <div className="comm-modal-actions" style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <button type="button" className="comm-btn comm-btn-secondary" onClick={handleClose}>
          취소
        </button>
        <button type="button" className="comm-btn comm-btn-primary" onClick={handleSave}>
          저장하기
        </button>
      </div>
    </StnModal>
  );
};


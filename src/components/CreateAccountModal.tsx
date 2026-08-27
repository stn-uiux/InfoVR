import React, { useState } from "react";
import { StnModal } from "./StnModal";
import { StnSelect } from "./StnSelect";

interface CreateAccountModalProps {
  open: boolean;
  onClose: () => void;
  groups: { id: string; name: string }[];
  onSave: (data: {
    name: string;
    email: string;
    password: string;
    groupId: string;
    role: string;
  }) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  open,
  onClose,
  groups,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState("viewer");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !groupId || !role) {
      alert("모든 필드를 입력해주세요.");
      return;
    }
    onSave({ name, email, password, groupId, role });
    // Reset form
    setName("");
    setEmail("");
    setPassword("");
    setGroupId("");
    setRole("viewer");
  };

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));
  const roleOptions = [
    { value: "admin", label: "관리자 (Admin)" },
    { value: "editor", label: "편집자 (Editor)" },
    { value: "viewer", label: "조회자 (Viewer)" },
    { value: "pending", label: "승인대기 (Pending)" },
  ];

  return (
    <StnModal
      isOpen={open}
      onClose={onClose}
      title="새 계정 추가"
      style={{ width: 500, height: "auto" }}
    >
      <form onSubmit={handleSubmit} style={{ padding: "0" }} autoComplete="off">
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
          <div className="stn-form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="stn-form-label">이름</label>
            <input
              type="text"
              className="stn-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              autoComplete="off"
            />
          </div>

          <div className="stn-form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="stn-form-label">아이디 (이메일)</label>
            <input
              type="email"
              className="stn-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="stn-form-group" style={{ marginBottom: "16px" }}>
          <label className="stn-form-label">비밀번호</label>
          <input
            type="password"
            className="stn-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="new-password"
          />
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          <div className="stn-form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="stn-form-label">그룹</label>
            <StnSelect
              value={groupId}
              onChange={(val) => setGroupId(val as string)}
              options={groupOptions}
              placeholder="그룹 선택"
            />
          </div>

          <div className="stn-form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="stn-form-label">권한</label>
            <StnSelect
              value={role}
              onChange={(val) => setRole(val as string)}
              options={roleOptions}
              placeholder="권한 선택"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "24px",
            borderTop: "1px solid var(--border-medium)",
            paddingTop: "16px",
          }}
        >
          <button type="button" className="comm-btn comm-btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="comm-btn comm-btn-primary">
            계정 추가
          </button>
        </div>
      </form>
    </StnModal>
  );
};

import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Icon } from "@iconify/react";

export const SignupPage = () => {
  const navigate = useNavigate();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate signup success and return to login
    navigate("/");
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-orb primary"></div>
      <div className="auth-bg-orb secondary"></div>

      <div className="auth-card-wrapper">
        <div className="auth-card-glow"></div>
        <div className="auth-card">
          <div className="auth-card-content">
            <div className="auth-logo">
              <Icon icon="fluent:person-add-24-filled" className="auth-logo-icon" />
              <h1 className="auth-title">회원 가입</h1>
            </div>
            
            <p className="auth-subtitle">
              InfoVR 시스템을 이용하기 위한 계정을 생성합니다.
            </p>

            <form className="auth-form" onSubmit={handleSignup}>
              <div className="auth-form-group">
                <label className="auth-label">이름</label>
                <div className="auth-input-wrap">
                  <Icon icon="fluent:person-24-regular" className="auth-input-icon" />
                  <input 
                    type="text" 
                    className="auth-input" 
                    placeholder="이름을 입력하세요" 
                    required 
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">아이디</label>
                <div className="auth-input-wrap">
                  <Icon icon="fluent:mail-24-regular" className="auth-input-icon" />
                  <input 
                    type="text" 
                    className="auth-input" 
                    placeholder="사용할 아이디를 입력하세요" 
                    required 
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">비밀번호</label>
                <div className="auth-input-wrap">
                  <Icon icon="fluent:key-24-regular" className="auth-input-icon" />
                  <input 
                    type="password" 
                    className="auth-input" 
                    placeholder="비밀번호를 입력하세요" 
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="auth-btn">
                계정 생성하기 <Icon icon="fluent:checkmark-24-filled" />
              </button>
            </form>

            <div className="auth-link-text">
              이미 계정이 있으신가요? 
              <Link to="/" className="auth-link">로그인</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Icon } from "@iconify/react";

export const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login and go directly to dashboard
    navigate("/dashboard");
  };

  return (
    <div className="auth-container">
      {/* Background Animated Orbs */}
      <div className="auth-bg-orb primary"></div>
      <div className="auth-bg-orb secondary"></div>

      <div className="auth-card-wrapper">
        <div className="auth-card-glow"></div>
        <div className="auth-card">
          <div className="auth-card-content">
            <div className="auth-logo">
              <Icon icon="fluent:box-24-filled" className="auth-logo-icon" />
              <h1 className="auth-title">InfoVR</h1>
            </div>
            
            <p className="auth-subtitle">
              3D 데이터센터 통합 관리 시스템에 오신 것을 환영합니다.
            </p>

            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-form-group">
                <label className="auth-label">아이디</label>
                <div className="auth-input-wrap">
                  <Icon icon="fluent:person-24-regular" className="auth-input-icon" />
                  <input 
                    type="text" 
                    className="auth-input" 
                    placeholder="아이디를 입력하세요" 
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
                로그인 <Icon icon="fluent:arrow-right-24-filled" />
              </button>
            </form>

            <div className="auth-link-text">
              계정이 없으신가요? 
              <Link to="/signup" className="auth-link">회원가입</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

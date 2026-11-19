import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import logoDarkFull from "../assets/logo/InfoVR_dark_full.svg";

export const LoginPage = () => {
  const navigate = useNavigate();

  // InfoVR_데모실행.bat(로컬 데모 패키지)으로 실행한 화면인지 감지
  const isOfflineDemo =
    import.meta.env.VITE_OFFLINE_DEMO === "true" ||
    Boolean((window as unknown as { __INFOVR_OFFLINE_DEMO__?: boolean }).__INFOVR_OFFLINE_DEMO__) ||
    new URLSearchParams(window.location.search).get("mode") === "demo";

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
              <img src={logoDarkFull} alt="InfoVR Logo" style={{ height: "64px" }} />
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

            {!isOfflineDemo && (
              <div className="auth-demo-download-box">
                <div className="auth-demo-download-info">
                  <div className="auth-demo-download-badge">
                    <span>로컬 실행 권장</span>
                  </div>
                  <p className="auth-demo-download-desc">
                    PC 사양에 따라 웹 브라우저에서 3D 화면이 느릴 수 있습니다.<br />
                    데모파일을 내려받아 압축 해제 후 <strong>InfoVR_데모실행.bat</strong>을 실행하시면 별도 설치 없이 훨씬 쾌적하게 시연할 수 있습니다.
                  </p>
                </div>
                <a
                  href="/InfoVR_Offline_Demo.zip"
                  download="InfoVR_Offline_Demo.zip"
                  className="auth-demo-download-btn"
                >
                  <Icon icon="material-symbols:download" style={{ fontSize: "19px" }} />
                  <span>로컬 데모 실행파일 다운로드 (.zip)</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

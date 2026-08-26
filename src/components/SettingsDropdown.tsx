import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";

export const SettingsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    navigate("/");
  };

  const toggleDropdown = () => {
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="settings-dropdown-container" ref={dropdownRef}>
      <button 
        className="settings-dropdown-btn" 
        onClick={toggleDropdown}
        title="사용자 설정"
      >
        <Icon icon="fluent:settings-24-filled" style={{ fontSize: "16px" }} />
      </button>

      {isOpen && createPortal(
        <div 
          className="settings-dropdown-menu" 
          ref={menuRef}
          style={{ 
            position: 'fixed', 
            top: `${position.top}px`, 
            right: `${position.right}px`,
            margin: 0 /* Reset any margin used for animations earlier */
          }}
        >
          <button 
            className="settings-dropdown-item" 
            onClick={() => {
              useStore.getState().setMyPageModalOpen(true);
              setIsOpen(false);
            }}
          >
            <Icon icon="fluent:contact-card-24-regular" style={{ fontSize: "18px" }} />
            마이페이지
          </button>
          <button 
            className="settings-dropdown-item" 
            onClick={() => {
              useStore.getState().setSettingsModalTab('accounts');
              useStore.getState().setSettingsModalOpen(true);
              setIsOpen(false);
            }}
          >
            <Icon icon="fluent:people-24-regular" style={{ fontSize: "18px" }} />
            계정 관리
          </button>
          <button 
            className="settings-dropdown-item" 
            onClick={() => {
              useStore.getState().setSettingsModalTab('permissions');
              useStore.getState().setSettingsModalOpen(true);
              setIsOpen(false);
            }}
          >
            <Icon icon="fluent:shield-keyhole-24-regular" style={{ fontSize: "18px" }} />
            권한 설정
          </button>
          <button className="settings-dropdown-item logout" onClick={handleLogout}>
            <Icon icon="fluent:sign-out-24-regular" style={{ fontSize: "18px" }} />
            로그아웃
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

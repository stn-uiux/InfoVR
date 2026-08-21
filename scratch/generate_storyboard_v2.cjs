const fs = require('fs');
const md = fs.readFileSync('화면설계서_목차.md', 'utf-8');

const htmlStart = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArcVRack 화면설계서 (Storyboard)</title>
  <style>
    :root {
      --primary-color: #0f172a;
      --secondary-color: #3b82f6;
      --text-main: #334155;
      --text-light: #64748b;
      --bg-light: #f8fafc;
      --border-color: #e2e8f0;
    }
    
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-main);
      background-color: white;
      margin: 0;
      padding: 0;
      display: flex;
    }

    .sidebar-nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      overflow-y: auto;
      background: var(--bg-light);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem 1rem;
      box-sizing: border-box;
      transition: transform 0.3s ease;
      z-index: 999;
    }
    
    .sidebar-nav.hidden {
      transform: translateX(-100%);
    }

    .sidebar-toggle-btn {
      position: fixed;
      top: 1.5rem;
      left: 280px;
      width: 24px;
      height: 40px;
      background: var(--secondary-color);
      color: white;
      border: none;
      border-radius: 0 4px 4px 0;
      cursor: pointer;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: left 0.3s ease;
      box-shadow: 2px 0 4px rgba(0,0,0,0.1);
      font-size: 12px;
    }
    
    .sidebar-toggle-btn.hidden {
      left: 0;
    }

    .sidebar-nav h2 {
      margin-top: 0;
      color: var(--primary-color);
      font-size: 1.25rem;
      margin-bottom: 0.8rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--primary-color);
    }

    .sidebar-nav ul {
      list-style-type: none;
      padding-left: 0;
      margin: 0;
    }
    
    .sidebar-nav > ul > li {
      margin-bottom: 0.8rem;
    }
    
    .sidebar-nav > ul > li > strong {
      display: block;
      margin-bottom: 0.3rem;
      color: var(--primary-color);
      font-size: 1rem;
      cursor: pointer;
      user-select: none;
    }

    .sidebar-nav > ul > li > strong::after {
      content: ' ▼';
      font-size: 0.8em;
      float: right;
      transition: transform 0.2s;
    }

    .sidebar-nav > ul > li.collapsed > strong::after {
      transform: rotate(-90deg);
    }

    .sidebar-nav > ul > li.collapsed > ul {
      display: none;
    }

    .sidebar-nav ul ul {
      padding-left: 0.8rem;
      border-left: 1px solid #cbd5e1;
      margin-left: 0.4rem;
    }

    .sidebar-nav li {
      margin-bottom: 0.2rem;
    }

    .sidebar-nav a {
      color: var(--text-light);
      text-decoration: none;
      font-size: 0.85rem;
      display: block;
      padding: 0.3rem 0.5rem;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .sidebar-nav a:hover {
      color: var(--secondary-color);
      font-weight: 600;
      background-color: #f1f5f9;
    }
    
    .sidebar-nav a.active {
      color: var(--secondary-color);
      font-weight: 700;
      background-color: #eff6ff;
      border-left: 3px solid var(--secondary-color);
      border-radius: 0 4px 4px 0;
    }

    .main-content {
      margin-left: 280px;
      padding: 1.5rem 2rem;
      width: calc(100% - 280px);
      box-sizing: border-box;
      transition: margin-left 0.3s ease, width 0.3s ease;
    }

    .main-content.expanded {
      margin-left: 0;
      width: 100%;
    }

    header {
      margin-bottom: 1.5rem;
    }

    h1 {
      color: var(--primary-color);
      font-size: 2rem;
      margin-bottom: 0.3rem;
    }

    .meta-info {
      color: var(--text-light);
      font-size: 0.85rem;
    }

    .page {
      margin-bottom: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px dashed var(--border-color);
    }

    .page-title {
      font-size: 1.5rem;
      color: var(--primary-color);
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: 0;
    }

    .page-id {
      background: var(--secondary-color);
      color: white;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 1rem;
    }

    .page-content-split {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
      margin-top: 1rem;
    }

    .page-left {
      flex: 2.2;
      min-width: 0;
    }

    .page-right {
      flex: 1;
      min-width: 0;
    }

    .page-right h3 {
      margin-top: 0;
      margin-bottom: 0.5rem;
    }

    .screenshot-container {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: #f1f5f9;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .image-wrapper {
      position: relative;
      overflow: hidden;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
    }

    .screenshot {
      width: 100%;
      display: block;
      user-select: none;
    }

    h3 {
      color: var(--primary-color);
      border-left: 4px solid var(--secondary-color);
      padding-left: 0.8rem;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }

    .ui-list {
      display: flex;
      flex-direction: column;
    }

    .ui-item {
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--border-color);
    }
    
    .ui-item:last-child {
      border-bottom: none;
    }

    .ui-item-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.3rem;
    }

    .ui-item-name {
      font-weight: 700;
      color: var(--primary-color);
      font-size: 0.95rem;
    }

    .ui-item-desc {
      color: var(--text-main);
      font-size: 0.85rem;
      line-height: 1.4;
      padding-left: 2.2rem; /* Align text under the title (skip the circle number) */
    }

    .badge {
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      font-size: 0.7rem;
      font-family: monospace;
    }

    .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .badge-purple { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
    .badge-yellow { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
    .badge-green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-indigo { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .badge-teal { background: #ccfbf1; color: #115e59; border: 1px solid #99f6e4; }
    .badge-orange { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
    .badge-pink { background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; }
    .badge-gray { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    mark {
      background: linear-gradient(to top, #fef08a 40%, transparent 40%);
      padding: 0 0.2rem;
      border-radius: 2px;
      color: var(--text-main);
      font-weight: 600;
    }

    .element-number {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      font-size: 0.85rem;
    }
    
    /* Interactive Markers CSS */
    .floating-actions {
      position: fixed;
      bottom: 2rem;
      right: 2.5rem;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 9999;
    }

    .floating-actions button {
      padding: 8px 14px;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-weight: bold;
      font-size: 0.85rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .floating-actions button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    
    .editor-toolbar {
      padding: 10px;
      background: #e2e8f0;
      border-bottom: 1px solid #cbd5e1;
      display: none; /* Hidden by default */
      gap: 10px;
      align-items: center;
    }
    
    body.edit-mode-active .editor-toolbar {
      display: flex;
    }
    
    .editor-toolbar button {
      padding: 6px 12px;
      border: none;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      color: var(--primary-color);
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    
    .editor-toolbar button:hover {
      background: #f8fafc;
    }
    
    .marker {
      position: absolute;
      z-index: 10;
      pointer-events: none;
    }
    
    body.edit-mode-active .marker {
      pointer-events: auto;
      cursor: move;
    }
    
    .marker-circle {
      width: 30px;
      height: 30px;
      background: var(--secondary-color);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      border: 2px solid white;
    }
    
    .marker-box {
      border: 3px dashed var(--secondary-color);
      background: rgba(59, 130, 246, 0.1);
      resize: none;
      overflow: hidden;
    }

    body.edit-mode-active .marker-box {
      resize: both;
    }

    .context-menu {
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      border-radius: 4px;
      z-index: 10000;
      display: none;
      flex-direction: column;
      padding: 4px 0;
      font-size: 0.85rem;
      min-width: 130px;
    }
    .context-menu-item {
      padding: 6px 16px;
      cursor: pointer;
      color: #334155;
    }
    .context-menu-item:hover {
      background: #f1f5f9;
    }
    .context-menu-item.delete {
      color: #ef4444;
      border-top: 1px solid #e2e8f0;
      margin-top: 4px;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div id="markerContextMenu" class="context-menu">
    <div class="context-menu-item" onclick="changeZIndex('front')">맨 앞으로 가져오기</div>
    <div class="context-menu-item" onclick="changeZIndex('forward')">앞으로 가져오기</div>
    <div class="context-menu-item" onclick="changeZIndex('backward')">뒤로 보내기</div>
    <div class="context-menu-item" onclick="changeZIndex('back')">맨 뒤로 보내기</div>
    <div class="context-menu-item delete" onclick="deleteMarker()">삭제</div>
  </div>
  
  <div class="floating-actions">
    <button id="clearAllBtn" onclick="clearAllData()" style="background:#ef4444; color:white; display:none;">🗑️ 마커 초기화</button>
    <button id="editToggleBtn" onclick="toggleEditMode()" style="background:#3b82f6; color:white;">✏️ 마커 편집 켜기</button>
  </div>
`;

let htmlOut = htmlStart;

// Parse TOC
const chapterRegex = /### (\d+)장\. ([^\n]+)/g;
let chapters = [];
let match;
while ((match = chapterRegex.exec(md)) !== null) {
  chapters.push({ num: match[1], title: match[2].trim(), pos: match.index });
}

let tocHtml = '<button id="sidebarToggleBtn" class="sidebar-toggle-btn">◀</button><nav class="sidebar-nav"><h2>📋 목차</h2><ul>';
let pagesHtml = '<div class="main-content"><header><h1>📐 ArcVRack 화면설계서</h1><div class="meta-info"><strong>버전:</strong> v1.0 | <strong>작성일:</strong> 2026-08-19 | <strong>관련 문서:</strong> 기능명세서 v1.5</div></header>';

function guessUIType(text) {
  if (text.includes('버튼') || text.includes('Button')) return 'Button';
  if (text.includes('모달') || text.includes('Dialog') || text.includes('Modal')) return 'Modal';
  if (text.includes('입력') || text.includes('폼') || text.includes('Form')) return 'Input / Form';
  if (text.includes('리스트') || text.includes('목록') || text.includes('트리')) return 'List / Tree';
  if (text.includes('위젯') || text.includes('패널') || text.includes('카드')) return 'Panel / Card';
  if (text.includes('토글') || text.includes('스위치')) return 'Toggle';
  if (text.includes('애니메이션') || text.includes('포커싱') || text.includes('이동')) return 'Interaction';
  if (text.includes('3D') || text.includes('캔버스') || text.includes('공간')) return '3D Canvas';
  return 'UI Element';
}

function getBadgeClass(type) {
  if (type === 'Button') return 'badge-blue';
  if (type === 'Modal' || type === 'Dialog') return 'badge-purple';
  if (type === 'Input / Form' || type === 'Header') return 'badge-yellow';
  if (type === 'List / Tree' || type === 'List') return 'badge-green';
  if (type === 'Panel / Card' || type === 'Panel' || type === 'Sidebar') return 'badge-indigo';
  if (type === 'Toggle' || type === 'Switch') return 'badge-teal';
  if (type === 'Interaction' || type === 'Navigation' || type === 'Floating UI' || type === 'Tooltip') return 'badge-orange';
  if (type === '3D Canvas' || type === '3D Object' || type === '3D Effect' || type === 'Graphics') return 'badge-pink';
  return 'badge-gray';
}

const manualUIData = {
  // ── 1장. 대시보드 (View Mode) ──
  "1-1": [
    { name: "3D 서버실 뷰어", type: "3D Canvas", desc: "바닥·벽면이 렌더링된 메인 3D 공간. 마우스 드래그로 <mark>회전/패닝</mark>, 스크롤로 <mark>줌</mark>, 방향키로 카메라 이동 가능." },
    { name: "전체보기 버튼", type: "Button", desc: "우측 카메라 큐브 아래 위치. 클릭 시 씬 내 모든 오브젝트가 화면에 최적 비율로 자동 맞춤됨." },
    { name: "Edit Mode / 테마 토글", type: "Switch", desc: "우측 상단 툴바. <mark>Edit Mode ON/OFF</mark> 스위치로 수정 모드 진입, <mark>Light/Dark</mark> 토글로 테마 즉시 전환." }
  ],
  "1-2": [
    { name: "좌측 사이드바 (계층 트리)", type: "Panel", desc: "지역 → 센터 → 전산실 등 계층 구조를 트리로 제공. 최상단 root부터 하위 zone까지 5가지 노드 유형 지원." },
    { name: "노드 유형 아이콘", type: "Badge", desc: "트리 각 항목에 유형별(root/group/site/room/zone) 고유 아이콘이 표시되어 시각적 구분 제공." },
    { name: "노드 검색", type: "Input / Form", desc: "트리 상단 검색창에서 노드 이름을 검색하여 대규모 인프라에서도 원하는 구역을 빠르게 탐색." },
    { name: "노드 클릭 → 씬 전환", type: "Interaction", desc: "트리에서 노드를 클릭하면 해당 구역으로 3D 씬(카메라 시점)이 즉시 전환됨." }
  ],
  "1-3": [
    { name: "3D 랙 모델 군집", type: "3D Object", desc: "배치된 랙들이 3D로 렌더링. 개별 랙 클릭 시 카메라가 부드럽게 해당 랙 정면으로 자동 이동(포커싱)됨." },
    { name: "Focus Carousel", type: "Navigation", desc: "하단 중앙의 랙 탐색 컨트롤. 전체 랙 개수·현재 순번 표시, 좌우 화살표로 순차 랙 포커싱 가능." },
    { name: "랙 포커스 라이팅", type: "3D Effect", desc: "선택 랙 주변의 조명(PointLight) 강도가 증가하고 주변은 어두워져 <mark>선택 랙에 시각적 집중</mark> 제공." }
  ],
  "1-4": [
    { name: "에러 요약 카드 (4종)", type: "Panel", desc: "<mark>Critical</mark>(빨강)·<mark>Major</mark>(주황)·<mark>Minor</mark>(노랑)·<mark>Warning</mark>(파랑) 등급별 에러 건수 카드. 클릭 시 Drill-down 테이블 오픈." },
    { name: "Drill-down 테이블", type: "List", desc: "선택한 등급의 에러 항목을 목록으로 표시. 장비명, 포트, 에러 유형 등 상세 정보 포함." },
    { name: "에러 항목 클릭 → 포커싱", type: "Interaction", desc: "테이블의 에러 항목 클릭 시 해당 장비 랙으로 카메라가 이동하고 장비 모달이 에러 포트를 하이라이트한 상태로 열림." },
    { name: "크로스-노드 자동 전환", type: "Interaction", desc: "에러 장비가 현재 노드가 아닌 다른 노드 소속일 경우, 해당 노드로 자동 전환 후 포커싱." }
  ],
  "1-5": [
    { name: "온도 게이지 바", type: "Panel", desc: "노드별 온도를 15°C~35°C 범위로 정규화. <mark>27°C 이상 주황</mark>, <mark>31°C 이상 빨강</mark> 그라디언트로 위험도 직관 표시." },
    { name: "습도 물방울 아이콘", type: "Panel", desc: "노드별 습도(%)를 물방울 아이콘의 <mark>채움 레벨</mark>로 시각화." },
    { name: "노드 행 클릭 전환", type: "Interaction", desc: "위젯의 노드 행을 클릭하면 해당 노드로 3D 씬이 즉시 전환됨." }
  ],
  "1-6": [
    { name: "랙 정보 헤더", type: "Header", desc: "랙 이름, <mark>U 용량</mark>(예: 32U), 소속 노드 뱃지 등 랙의 기본 정보 표시." },
    { name: "장비 슬롯 타일 리스트", type: "List", desc: "랙 내 전체 슬롯을 U 단위로 나열. 장비가 장착된 슬롯은 <mark>SVG 썸네일</mark>과 모델명 표시, 빈 슬롯은 Available 표시." },
    { name: "장비 클릭 → 상세 모달", type: "Interaction", desc: "장착된 장비 타일 클릭 시 <mark>장비 상세 모달</mark>(Device Modal)이 열려 스펙·포트 현황 조회 가능." },
    { name: "수정 모드 드래그 배치", type: "Interaction", desc: "Edit Mode에서는 장비 타일을 드래그하여 슬롯 간 재배치하거나, 등록 장비를 드래그하여 빈 슬롯에 장착 가능." }
  ],
  "1-7": [
    { name: "장비 스펙 헤더", type: "Header", desc: "장비명, <mark>유형 뱃지</mark>(Router/Switch/Server), 소속 랙, 제조사, 모델명, IP, MAC 주소 표기." },
    { name: "SVG 시각화 영역", type: "Graphics", desc: "장비 전면부·후면부 외관 SVG 렌더링. 삽입된 카드 형상이 합성된 고해상도 프리뷰 제공." },
    { name: "앞면/뒷면 & 기본 라벨", type: "Badge", desc: "양면 모델은 앞면·뒷면을 상하로 동시 표시. <mark>기본</mark> 라벨로 텍스처·썸네일 기준 면 표시." },
    { name: "포트 호버 툴팁", type: "Tooltip", desc: "SVG 포트 영역에 마우스 호버 시 포트 번호·이름·연결 상태가 툴팁으로 즉시 표시됨." },
    { name: "에러 포트 색상 마커", type: "Floating UI", desc: "에러 포트 위치에 위험도별 색상 마커(빨강·주황·노랑·파랑) 오버레이. 문제 포트를 직관적으로 파악 가능." }
  ],
  "1-8": [
    { name: "테마 토글 버튼", type: "Switch", desc: "좌측 상단의 <mark>Light/Dark</mark> 전환 토글. 클릭 즉시 UI 전체와 3D 환경이 동시에 테마 전환됨." },
    { name: "3D 환경 테마 연동", type: "3D Effect", desc: "다크 모드 시 야간 조명·어두운 배경, 라이트 모드 시 주간 조명·밝은 배경으로 <mark>CyberSpace가 실시간 전환</mark>됨." }
  ],

  // ── 2장. 수정 모드 (Edit Mode) ──
  "2-1": [
    { name: "Edit Mode 토글", type: "Switch", desc: "상단 바의 ON/OFF 토글. 활성화 시 수정 모드에 진입하며 <mark>상단 툴바</mark>와 좌측 편집 패널이 표시됨." },
    { name: "상단 툴바 버튼", type: "Button", desc: "<mark>Save</mark>, <mark>Undo/Redo</mark>, <mark>Sample</mark>, <mark>Reset</mark>, <mark>장비관리</mark>, <mark>모델관리</mark>, <mark>포트마법사</mark> 등 주요 액션 버튼 배치." },
    { name: "좌측 편집 사이드바", type: "Sidebar", desc: "계층 트리, 가상 공간 설정, Scene Objects 리스트 등 편집 도구가 탭/아코디언으로 구성됨." },
    { name: "접이식 사이드바", type: "Panel", desc: "사이드바를 <mark>아이콘 뷰로 최소화(Fold)</mark> 가능. 접힌 상태에서 아이콘 클릭 시 <mark>플로팅 패널</mark>이 오버레이됨." }
  ],
  "2-2": [
    { name: "가상 공간 설정 패널", type: "Panel", desc: "공간의 <mark>가로(W)</mark>·<mark>세로(D)</mark> 사이즈를 수치 입력. 값 변경 후 공간이 실시간 렌더링 반영." },
    { name: "3D공간 제작 버튼", type: "Button", desc: "설정된 사이즈로 바닥·벽면 CyberSpace를 즉시 생성. 기존 공간이 있으면 크기 갱신." },
    { name: "와이어프레임 가이드 라인", type: "3D Effect", desc: "편집 모드 시 공간 크기를 직관적으로 파악할 수 있는 <mark>하늘색 와이어프레임 박스</mark>가 바닥·둘레에 렌더링됨." }
  ],
  "2-3": [
    { name: "기본 제공 모델 목록", type: "List", desc: "<mark>Wall</mark>, <mark>Partition</mark>, <mark>Chair</mark>, <mark>Desk</mark>, <mark>Clock</mark>, <mark>Light</mark> 등 6종 기본 3D 집기 모델을 선택하여 씬에 배치 가능." },
    { name: "기즈모 조작 (이동/회전/크기)", type: "Interaction", desc: "선택된 오브젝트에 <mark>Translate/Rotate/Scale</mark> 기즈모가 활성화. 마우스로 축을 잡아 정밀 조작." },
    { name: "잠금/해제 토글 (🔒)", type: "Switch", desc: "각 모델의 <mark>잠금/해제</mark> 개별 토글. 잠금 시 기즈모 조작·드래그가 비활성화되어 실수 방지." },
    { name: "모델 속성 편집 패널", type: "Panel", desc: "선택 모델의 <mark>위치(X/Y/Z)</mark>, <mark>회전</mark>, <mark>크기</mark> 및 모델별 고유 파라미터(벽 색상, 조명 강도 등) 상세 편집." }
  ],
  "2-4": [
    { name: "GLB/GLTF 업로드 영역", type: "Input / Form", desc: "사용자 보유 3D 모델 파일을 <mark>파일 선택</mark> 또는 <mark>드래그 앤 드롭</mark>으로 업로드. 업로드 즉시 씬에 렌더링됨." },
    { name: "임포트 모델 속성 편집", type: "Panel", desc: "임포트된 모델의 <mark>위치(X/Y/Z)</mark>, <mark>회전(X/Y/Z)</mark>, <mark>크기(X/Y/Z)</mark>를 수치로 정밀 편집." },
    { name: "Scene Objects 리스트", type: "List", desc: "씬에 배치된 모든 오브젝트 목록. 항목 클릭 시 해당 오브젝트 선택, 잠금/해제·삭제 액션 제공." }
  ],
  "2-5": [
    { name: "Scene Objects 목록", type: "List", desc: "배치된 모든 모델의 <mark>이름·유형</mark> 목록 표시. 항목별 <mark>선택</mark>, <mark>잠금/해제(🔒)</mark>, <mark>삭제(🗑️)</mark> 관리." },
    { name: "3D 모델 Export 버튼", type: "Button", desc: "전체 3D 모델 데이터(위치, 회전, 크기, 바이너리 포함)를 <mark>JSON 파일</mark>로 내보내기." },
    { name: "3D 모델 Import 버튼", type: "Button", desc: "기존 JSON 파일을 불러와 3D 환경을 동일하게 복원." }
  ],
  "2-6": [
    { name: "랙 생성 패널", type: "Panel", desc: "<mark>24U/32U/48U</mark> 크기와 <mark>Standard/Wide</mark> 규격을 선택하여 빈 랙을 씬에 추가." },
    { name: "랙 방향 설정", type: "Panel", desc: "우측 패널에서 랙 정면 방향을 <mark>0°/90°/180°/270°</mark> 4방향 중 선택. 3D 씬에 즉시 반영." },
    { name: "랙 이름 편집", type: "Input / Form", desc: "패널 상단의 랙 타이틀을 직접 클릭하여 인라인 편집. 변경 즉시 반영." },
    { name: "랙 삭제 확인", type: "Modal", desc: "랙 삭제 시 확인 모달 표시. 장비가 배치된 랙은 경고 메시지와 함께 확인 요구." }
  ],
  "2-7": [
    { name: "빈 슬롯 클릭 → 장비 추가", type: "Interaction", desc: "Edit Mode에서 빈 슬롯 클릭 시 <mark>장비 추가 모달</mark>이 열림. 등록 장비 목록에서 선택하여 배치." },
    { name: "등록 장비 목록 (정렬/필터)", type: "List", desc: "모달 내 등록 장비를 <mark>이름·모델·유형</mark>별로 정렬·필터링하여 빠르게 탐색 가능." },
    { name: "장비 선택 → 슬롯 배치", type: "Interaction", desc: "장비를 선택하면 지정 슬롯에 즉시 배치. U 크기에 따라 <mark>멀티 슬롯 점유</mark> 자동 처리." },
    { name: "재배치 확인 모달", type: "Modal", desc: "이미 다른 랙에 배치된 장비를 이동할 경우 <mark>기존 위치에서 제거</mark>됨을 경고하고 확인 요구." }
  ],

  // ── 3장. 통합 장비 관리 모달 ──
  "3-1": [
    { name: "좌측 계층 노드 트리", type: "Panel", desc: "장비 소속 그룹·룸 등 계층 노드를 트리 형태로 표시. 노드 클릭 시 우측 장비 테이블이 해당 노드 장비로 필터링됨." },
    { name: "우측 장비 테이블", type: "List", desc: "등록된 전체 장비를 테이블로 표시. <mark>장비명, IP, MAC, 모델, 유형, 소속 노드</mark> 등 컬럼 포함." },
    { name: "검색·필터 영역", type: "Input / Form", desc: "장비명·IP 등 키워드 검색과 유형·모델별 필터를 제공하여 대량 장비를 빠르게 탐색." },
    { name: "장비 추가 버튼", type: "Button", desc: "모달 내 장비 등록 폼으로 이동. 새 장비의 기본 정보 입력 및 모델 선택 시작." }
  ],
  "3-2": [
    { name: "노드 생성 버튼", type: "Button", desc: "트리에 <mark>새 그룹/사이트/룸/존</mark> 노드를 추가. 부모 노드 하위에 즉시 생성됨." },
    { name: "노드 이름 수정", type: "Input / Form", desc: "노드 항목을 더블클릭하여 이름을 인라인 편집. Enter로 확정." },
    { name: "노드 삭제", type: "Button", desc: "노드 삭제 시 하위 장비·자식 노드 존재 여부를 확인하고 경고 표시." }
  ],
  "3-3": [
    { name: "장비 기본 정보 입력 폼", type: "Input / Form", desc: "<mark>장비명, IP, MAC, 제조사, 유형</mark>(Switch/Router/Server) 등 기본 스펙 입력 필드." },
    { name: "모델 선택 드롭다운", type: "Input / Form", desc: "등록된 장비 모델 목록에서 선택. 선택 시 <mark>SVG 프리뷰</mark>와 U 크기가 자동 반영됨." },
    { name: "모듈러 장비 조립 버튼", type: "Button", desc: "카드 기반(섀시형) 모델 선택 시 활성화. 클릭 시 <mark>장비 조립 모달</mark>(Equipment Assembly)로 진입." },
    { name: "양면 프리뷰 & 기본 면 선택", type: "Graphics", desc: "양면 모델 선택 시 앞면·뒷면 SVG가 함께 프리뷰. <mark>기본 표시 면</mark>(앞면/뒷면)을 장비별로 선택 가능." }
  ],
  "3-4": [
    { name: "테이블 인라인 편집", type: "Input / Form", desc: "장비 테이블의 각 셀을 직접 클릭하여 <mark>IP, MAC, 이름</mark> 등을 즉시 수정." },
    { name: "장비 삭제 (배치 경고)", type: "Modal", desc: "삭제 대상 장비가 특정 랙에 배치되어 있으면 <mark>해당 랙에서도 제거</mark>됨을 경고하고 확인 요구." }
  ],
  "3-5": [
    { name: "엑셀 Export 체크 선택", type: "Input / Form", desc: "내보낼 장비 항목을 개별 체크 또는 전체 선택하여 <mark>.xlsx 파일</mark>로 다운로드." },
    { name: "엑셀 Import 업로드", type: "Input / Form", desc: "외부 엑셀 파일을 업로드하여 장비를 <mark>대량 일괄 등록</mark>. 중복·오류 항목은 결과 피드백으로 안내." },
    { name: "Import 결과 피드백", type: "Panel", desc: "임포트 완료 후 <mark>성공 건수</mark>, <mark>실패 건수</mark>, 오류 사유를 요약 표시." }
  ],

  // ── 4장. 장비 조립 모달 (Equipment Assembly) ──
  "4-1": [
    { name: "모델 선택 그리드", type: "Panel", desc: "등록된 장비 모델이 카드 형태로 표시. 각 카드에 <mark>모델명</mark>, <mark>슬롯 구조 요약</mark>(열×행, Mixed 등) 포함." },
    { name: "모델 카드 선택 하이라이트", type: "Interaction", desc: "모델 카드 클릭 시 <mark>테두리 하이라이트</mark>로 선택 상태 표시. 더블클릭 시 다음 Step으로 이동." }
  ],
  "4-2": [
    { name: "섀시 SVG 캔버스", type: "Graphics", desc: "선택 모델의 <mark>원본 섀시 SVG</mark>가 중앙에 렌더링. 카드 삽입 가능한 슬롯이 <mark>점선 오버레이</mark>로 표시됨." },
    { name: "좌측 카드 라이브러리", type: "Sidebar", desc: "삽입 가능한 카드를 <mark>그룹별</mark>(CPIOM, Standard, IXR 등)로 분류 표시. 카드 SVG 프리뷰·이름·폭 타입 포함." },
    { name: "슬롯 클릭 → 카드 삽입", type: "Interaction", desc: "좌측에서 카드를 선택한 뒤 빈 슬롯을 클릭하면 해당 위치에 <mark>카드가 즉시 삽입</mark>됨." }
  ],
  "4-3": [
    { name: "삽입 가능/불가 시각 피드백", type: "Interaction", desc: "삽입 가능한 슬롯은 <mark>하이라이트 애니메이션</mark>으로 강조, 불가능한 슬롯은 <mark>Dim 처리</mark> + 경고 토스트." },
    { name: "삽입된 카드 호버 → 제거", type: "Interaction", desc: "삽입된 카드에 마우스 호버 시 <mark>× 버튼</mark> 표시. 클릭하면 해당 카드가 슬롯에서 제거됨." },
    { name: "카드 삽입 애니메이션", type: "3D Effect", desc: "카드가 슬롯에 삽입될 때 <mark>슬라이드-인 애니메이션</mark>과 함께 인라인 SVG로 실시간 렌더링." }
  ],
  "4-4": [
    { name: "Uniform Grid 레이아웃", type: "Panel", desc: "고정 열×행 그리드 방식. <mark>Half/Full</mark> 카드 너비 지원, Full 카드는 한 행 전체 점유." },
    { name: "Mixed Layout", type: "Panel", desc: "모델별 명시적 슬롯 위치·크기 정의. <mark>allowedCardGroups</mark>로 CPIOM 전용 슬롯 등 카드 그룹 제한 적용." },
    { name: "Row-based Layout", type: "Panel", desc: "행(Row) 단위 서브 슬롯 구조. 행 라벨(R1, R2…) 표시, 카드 SVG 너비 초과 시 삽입 차단." }
  ],
  "4-5": [
    { name: "저장 버튼", type: "Button", desc: "클릭 시 <mark>썸네일 자동 합성</mark>(WebP)과 <mark>포트 맵 자동 생성</mark>(port-hitbox 파싱)이 동시 수행됨." },
    { name: "합성 결과 프리뷰", type: "Graphics", desc: "베이스 SVG + 삽입 카드 SVG가 좌표 기반으로 합성된 최종 장비 외관 이미지 프리뷰." },
    { name: "포트 맵 자동 생성 결과", type: "List", desc: "각 카드의 port-hitbox를 파싱하여 <mark>shelfNo/slotNo/localPort</mark> 형식 포트 목록 자동 생성." },
    { name: "전체 제거 버튼", type: "Button", desc: "삽입된 모든 카드를 일괄 초기화하여 빈 섀시 상태로 복원." }
  ],

  // ── 5장. 장비 모델 관리 ──
  "5-1": [
    { name: "기본 장비 모델 리스트 (18종)", type: "List", desc: "시스템 내장 기본 모델 목록. 각 항목에 <mark>SVG 썸네일</mark>, 표시 이름, 모델 타입 태그(고정형/섀시형), 제조사 표시." },
    { name: "커스텀 모델 리스트", type: "List", desc: "사용자 등록 모델 별도 섹션. 양면 모델은 <mark>양면 등록 여부</mark>와 기본 표시 면 정보 포함." },
    { name: "모델 타입 태그", type: "Badge", desc: "각 모델에 <mark>고정형</mark> 또는 <mark>섀시형</mark> 태그 표시. 수정된 모델은 <mark>수정됨</mark> 뱃지 추가." },
    { name: "수정 / 숨기기 버튼", type: "Button", desc: "<mark>✏️ 수정</mark> 버튼으로 모델 편집 폼 진입. 미수정 기본 모델은 <mark>숨기기</mark> 버튼으로 목록에서 제외 가능." }
  ],
  "5-2": [
    { name: "기본 모델 숨기기", type: "Button", desc: "사용하지 않는 기본 모델을 목록에서 숨김 처리. 숨긴 모델은 별도의 <mark>숨김 처리 섹션</mark>으로 이동." },
    { name: "숨김 모델 섹션", type: "Panel", desc: "숨겨진 기본 모델 목록. 각 항목에 <mark>🔄 복구 버튼</mark>이 제공되어 언제든 원래 목록으로 복원 가능." },
    { name: "수정 초기화", type: "Button", desc: "수정된 기본 모델의 커스텀 설정을 초기화하여 <mark>시스템 기본값으로 복원</mark>." }
  ],
  "5-3": [
    { name: "모델명 & Unit(U) 입력", type: "Input / Form", desc: "<mark>모델명</mark>(고유 이름)과 <mark>Rack Unit</mark>(1U~48U) 입력. 조합된 표시 이름([4U] 7250 IXR-6)이 실시간 프리뷰됨." },
    { name: "모델 타입 선택", type: "Input / Form", desc: "<mark>일반(Normal)</mark>: 단일 바디 장비, <mark>카드 기반(Card-based)</mark>: 카드 슬롯이 있는 모듈러 장비 중 선택." },
    { name: "모델 SVG 업로드 & 프리뷰", type: "Input / Form", desc: "장비 외관 SVG 파일 업로드. 즉시 렌더링 프리뷰 제공, viewBox에서 <mark>크기(px) 자동 추출</mark>." },
    { name: "앞면/뒷면 사용 체크", type: "Switch", desc: "양면 관리가 필요한 장비용. 활성화 시 <mark>후면 SVG 추가 업로드</mark> 필드와 기본 표시 면 선택 옵션 표시." }
  ],
  "5-4": [
    { name: "SVG 업로드 영역", type: "Input / Form", desc: "전면 SVG 파일 선택·드래그 업로드. 파일명과 <mark>원본 크기(width × height px)</mark> 자동 표시." },
    { name: "SVG 프리뷰 렌더링", type: "Graphics", desc: "업로드 즉시 SVG가 <mark>실물 비율</mark>로 렌더링. 외관 확인 후 다음 단계 진행." },
    { name: "기본 표시 면 선택", type: "Input / Form", desc: "양면 등록 시 <mark>앞면</mark> 또는 <mark>뒷면</mark> 중 랙 텍스처·썸네일 기준 면을 선택." }
  ],
  "5-5": [
    { name: "기본 섀시 SVG 업로드", type: "Input / Form", desc: "카드 미삽입 빈 장비 바디 SVG 업로드. 장비 조립 캔버스의 <mark>배경</mark>으로 사용됨." },
    { name: "인터랙티브 카드 영역 드로잉", type: "Interaction", desc: "섀시 SVG 위에서 마우스 <mark>드래그로 사각형 영역</mark>을 그려 카드 삽입 바운딩 박스(X, Y, W, H) 설정." },
    { name: "좌표 수치 입력", type: "Input / Form", desc: "X위치, Y위치, 너비, 높이, 행 수를 <mark>수치로 정밀 입력</mark>. 드로잉과 병행하여 미세 조정 가능." },
    { name: "섀시 프리뷰 오버레이", type: "Graphics", desc: "카드 영역이 <mark>점선 사각형 + 행/열 구분선 + 라벨</mark>로 실시간 오버레이되어 좌표 설정 결과 확인." }
  ],
  "5-6": [
    { name: "행별 높이·열 수·간격 표출", type: "Input / Form", desc: "각 행(Row)별로 <mark>높이</mark>(px), <mark>열 수</mark>, <mark>간격(Gap)</mark>을 개별 표출. 열 너비는 자동 계산 표시." },
    { name: "전체 통일 기능", type: "Input / Form", desc: "상단 일괄 입력 폼으로 높이·열 수·간격 값을 <mark>모든 행에 한 번에 적용</mark>." },
    { name: "Gap 시각화", type: "Graphics", desc: "양수 간격은 <mark>주황색</mark>(Warning) 영역, 음수 간격(겹침)은 <mark>빨간색</mark>(Danger) 영역으로 프리뷰에 오버레이 표시." }
  ],
  "5-7": [
    { name: "타입(Variant) 목록", type: "List", desc: "해당 모델에 등록된 모든 타입/변형 리스트. 각 항목에 <mark>타입명</mark>·<mark>합성 썸네일</mark>·수정/삭제 버튼 표시." },
    { name: "+ 새 타입 추가 버튼", type: "Button", desc: "클릭 시 <mark>장비 조립 모달</mark>이 열려 해당 섀시에 카드를 삽입하고 새로운 타입 구성을 생성." },
    { name: "타입명 설정 & 중복 검증", type: "Input / Form", desc: "타입에 고유 이름 부여. 동일 모델 내 <mark>중복 타입명</mark>이 있으면 경고 토스트 표시 + 저장 차단." },
    { name: "타입 수정/삭제", type: "Button", desc: "<mark>✏️ 수정</mark>으로 기존 타입의 카드 구성 편집, <mark>🗑️ 삭제</mark>로 타입 제거. 기본타입 삭제 시 썸네일이 기본 SVG로 복원." }
  ],
  "5-8": [
    { name: "카드 할당 그리드", type: "Panel", desc: "시스템 등록 전체 카드(빌트인 + 커스텀)를 그리드로 표시. <mark>토글 클릭</mark>으로 해당 모델에 사용 가능한 카드를 선택/해제." },
    { name: "새 카드 등록 서브 모달", type: "Modal", desc: "<mark>카드명, 폭 타입(Half/Full), SVG 업로드</mark> 입력. 등록 완료 시 고유 cardId 자동 부여 및 즉시 할당." },
    { name: "카드 프리뷰 정보", type: "Panel", desc: "각 카드에 <mark>SVG 프리뷰</mark>, 카드명, 폭 타입, 원본 크기(px) 표시. ×  버튼으로 할당 해제." }
  ],

  // ── 6장. 포트맵핑 마법사 ──
  "6-1": [
    { name: "이미지 드래그 앤 드롭 영역", type: "Input / Form", desc: "장비 전면부 사진(PNG/JPG/WEBP)을 <mark>파일 선택 또는 드래그 앤 드롭</mark>으로 업로드." },
    { name: "빈 캔버스 상태", type: "3D Canvas", desc: "이미지 미업로드 시 빈 캔버스에 업로드 안내 표시." },
    { name: "Process Telemetry 패널", type: "Panel", desc: "하단 상태 패널. 대기 시 <mark>Null Vector Array</mark> 상태, 분석 준비/진행/완료 상태를 순차 표시." }
  ],
  "6-2": [
    { name: "Initiate Neural Analysis 버튼", type: "Button", desc: "클릭 시 <mark>Gemini AI</mark>가 장비 이미지를 분석하여 모든 물리적 포트를 자동 감지. 바운딩 박스 좌표와 포트 번호를 반환." },
    { name: "분석 진행 로그", type: "Panel", desc: "터미널 스타일의 <mark>실시간 로그</mark>와 메모리 할당 <mark>프로그레스 바</mark>로 분석 진행 상황 표시." },
    { name: "분석 완료 결과", type: "Panel", desc: "AI 반환 결과로 포트 박스가 캔버스에 자동 배치됨. 하단에 <mark>Technical Summary</mark>(장비 기술 설명) 표시." }
  ],
  "6-3": [
    { name: "캔버스 + 포트 박스 오버레이", type: "3D Canvas", desc: "장비 이미지 위에 감지된 포트들이 <mark>색상 구분 사각형</mark>으로 오버레이. 드래그 이동·리사이즈 가능." },
    { name: "상단 편집 툴바", type: "Button", desc: "<mark>Lock/Unlock</mark>, <mark>Manual Port</mark>, <mark>PRT</mark>(포트 복제), <mark>GRP_CPY</mark>(그룹 복제), <mark>Export</mark> 등 편집 액션 버튼 배치." },
    { name: "우측 Object Registry", type: "Sidebar", desc: "매핑된 전체 포트를 <mark>Tag별 카테고리</mark>로 그룹핑 표시. 항목 클릭 시 캔버스에서 해당 포트 선택·하이라이트." }
  ],
  "6-4": [
    { name: "포트 박스 드래그 이동", type: "Interaction", desc: "포트 박스를 마우스로 잡고 자유롭게 이동. <mark>다중 선택</mark> 상태에서 드래그 시 일괄 이동." },
    { name: "리사이즈 핸들", type: "Interaction", desc: "포트 박스 우하단 핸들을 드래그하여 <mark>크기 조절</mark>." },
    { name: "키보드 미세 조정", type: "Interaction", desc: "방향키로 <mark>1px씩 이동</mark>, Shift+방향키로 <mark>10px씩 이동</mark>." },
    { name: "Manual Port 추가", type: "Button", desc: "상단 버튼 클릭 시 캔버스 중앙에 새 포트 박스 수동 생성. 포트 번호 <mark>자동 시퀀스 부여</mark>." },
    { name: "포트 삭제", type: "Button", desc: "선택 포트를 컨트롤 패널 X 버튼 또는 <mark>Delete/Backspace</mark> 키로 삭제." }
  ],
  "6-5": [
    { name: "Tag (포트 이름) 편집", type: "Input / Form", desc: "선택 포트 근처 인라인 패널에서 <mark>ethernet, sfp, mgmt, console</mark> 등 포트 유형 이름 설정." },
    { name: "Seq (포트 번호) 편집", type: "Input / Form", desc: "포트의 시퀀스 번호를 직접 수치 입력." },
    { name: "Icon (아이콘 유형) 선택", type: "Input / Form", desc: "포트 박스 위 표시 아이콘을 <mark>None / Ethernet / SFP</mark> 중 선택. 실제 SVG 아이콘이 오버레이됨." },
    { name: "W·H (너비/높이) 조절", type: "Input / Form", desc: "정규화 좌표 기준 너비·높이를 수치 입력 또는 <mark>+/- 스텝 버튼</mark>으로 1px 단위 미세 조절." }
  ],
  "6-6": [
    { name: "다중 선택 (Shift/Ctrl + 클릭)", type: "Interaction", desc: "<mark>Shift/Ctrl + 클릭</mark>으로 개별 추가/제거, <mark>Ctrl + 드래그</mark>로 Lasso 영역 선택." },
    { name: "정렬 도구 팝업", type: "Floating UI", desc: "2개 이상 선택 시 포트 그룹 위에 <mark>8가지 정렬·분배</mark> 팝업 표시 (상/중/하 정렬, 좌/중/우 정렬, 수평·수직 균등 분배)." },
    { name: "일괄 속성 편집", type: "Input / Form", desc: "다중 선택 상태에서 <mark>Tag, Width, Height</mark>를 한 번에 일괄 변경." }
  ],
  "6-7": [
    { name: "포트 복제 (Ctrl+D)", type: "Interaction", desc: "선택 포트를 개별 복제. 포트 번호는 <mark>기존 시퀀스의 빈 번호</mark>를 자동 탐색하여 부여. 위치는 20px 오프셋." },
    { name: "그룹 복제 (Ctrl+G)", type: "Interaction", desc: "선택 포트 그룹 전체를 동일 Tag 범주 내에서 복제. <mark>사용 중 번호를 건너뛰고</mark> 다음 가용 번호 자동 할당." }
  ],
  "6-8": [
    { name: "카테고리 그룹핑", type: "Panel", desc: "포트 이름(Tag)별로 자동 분류. <mark>ethernet (24 units)</mark>, <mark>sfp (4 units)</mark> 등 형태로 그룹 표시." },
    { name: "접기/펼치기 토글", type: "Switch", desc: "각 카테고리를 개별 접기/펼치기, 상단 토글로 <mark>전체 일괄 접기/펼치기</mark> 가능." },
    { name: "포트 상세 & 캔버스 연동", type: "Interaction", desc: "각 항목에 포트 번호·이름·좌표 표시. 클릭 시 캔버스에서 해당 포트 <mark>선택·하이라이트</mark>, 호버 시 활성 강조." }
  ],
  "6-9": [
    { name: "Export 버튼 → 파일명 모달", type: "Modal", desc: "상단 Export 클릭 시 파일명 입력 모달 표시. 입력 후 <mark>SVG 파일 다운로드</mark> 실행." },
    { name: "출력 SVG 구조", type: "Panel", desc: "원본 이미지를 &lt;image&gt; 태그 배경에 포함, 포트 영역을 <mark>port-hitbox 속성</mark> 포함 &lt;path&gt; 태그로 정의한 표준 SVG." },
    { name: "재임포트 호환", type: "Interaction", desc: "내보낸 SVG를 다시 업로드하면 포트 매핑이 <mark>완벽하게 복원</mark>됨. 3D 뷰어 장비 모달에서도 직접 사용 가능." }
  ],

  // ── 7장. arcVRoom ──
  "7-1": [
    { name: "3D 캔버스 (독립 에디터)", type: "3D Canvas", desc: "서버실 관제와 별개로 동작하는 독립형 3D 씬 에디터. <mark>/arcVRoom</mark> 경로로 진입." },
    { name: "좌측 에셋 패널", type: "Sidebar", desc: "배치 가능한 에셋 목록과 씬 오브젝트 관리. GLB/GLTF 파일 Import 기능 포함." }
  ],
  "7-2": [
    { name: "다중 조명 제어", type: "Panel", desc: "Ambient Light 외 <mark>추가 조명을 생성/제어</mark>. 강도, 색상, 그림자 여부, 해상도 개별 설정." },
    { name: "후처리 렌더링 설정", type: "Panel", desc: "<mark>Bloom</mark> 강도, <mark>Vignette</mark> 효과 등 Post-processing 옵션으로 렌더링 품질 조절." },
    { name: "배경·그리드 토글", type: "Switch", desc: "3D Environment 배경 표시, 배경색 변경, 그리드 가시성을 개별 토글." }
  ],
  "7-3": [
    { name: "다중 선택·그룹화", type: "Interaction", desc: "여러 에셋을 동시 선택하여 <mark>한 번에 이동·크기 조절</mark>할 수 있는 그룹핑 기능." },
    { name: "Translate/Rotate/Scale 기즈모", type: "Interaction", desc: "객체 선택 시 <mark>3D 트랜스폼 컨트롤러</mark>가 활성화. 축별 정밀 튜닝 가능." }
  ],

  // ── 8장. 데이터 관리 & 공통 기능 ──
  "8-1": [
    { name: "전체 환경 Export", type: "Button", desc: "랙 위치, 장비 배치, 계층 노드 등 <mark>전체 인프라 데이터를 엑셀(.xlsx)</mark>로 한 번에 내보내기." },
    { name: "전체 환경 Import", type: "Button", desc: "백업된 엑셀 파일을 불러와 <mark>전체 인프라 환경을 동일하게 복원</mark>." }
  ],
  "8-2": [
    { name: "Undo/Redo", type: "Button", desc: "<mark>Ctrl+Z</mark>로 이전 상태 복원, <mark>Ctrl+Shift+Z</mark>로 다시 적용. 위치 변경·배치 이력 모두 지원." },
    { name: "Save 버튼 활성화", type: "Button", desc: "변경 사항 감지 시 Save 버튼이 활성화. <mark>Ctrl+S</mark> 또는 클릭으로 데이터 영구 저장." },
    { name: "Unsaved Changes Dialog", type: "Modal", desc: "저장되지 않은 변경이 있는 상태에서 페이지 이탈 시 <mark>경고 다이얼로그</mark> 표시." }
  ],
  "8-3": [
    { name: "초기화 버튼 (Reset)", type: "Button", desc: "저장 데이터를 삭제하고 시스템을 초기 상태로 복원. <mark>장비 모델 데이터(섀시·타입)는 보호</mark>되어 유지됨." },
    { name: "초기화 확인 모달", type: "Modal", desc: "초기화 실행 전 <mark>되돌릴 수 없음</mark>을 경고하고 최종 확인 요구." },
    { name: "Sample 버튼", type: "Button", desc: "미리 구성된 샘플 랙/장비/노드 데이터를 즉시 로드하여 시스템 시연용 환경 구성." }
  ],
  "8-4": [
    { name: "성공 토스트 (✅)", type: "Floating UI", desc: "저장 완료·등록 성공 등 긍정 결과를 <mark>초록색 토스트</mark>로 3초간 표시." },
    { name: "경고 토스트 (⚠️)", type: "Floating UI", desc: "중복 경고·유효성 경고 등을 <mark>주황색 토스트</mark>로 표시." },
    { name: "에러 토스트 (❌)", type: "Floating UI", desc: "실패·오류 발생 시 <mark>빨간색 토스트</mark>로 에러 내용을 즉시 피드백." }
  ]
};

for (let i = 0; i < chapters.length; i++) {
  const start = chapters[i].pos;
  const end = (i + 1 < chapters.length) ? chapters[i + 1].pos : md.indexOf('## 🛠️ 작성 방법 가이드');
  const sectionText = md.substring(start, end);

  tocHtml += '<li><strong>' + chapters[i].num + '장. ' + chapters[i].title + '</strong><ul>';

  const rowRegex = /\|\s*\*\*(.*?)\*\*\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(sectionText)) !== null) {
    const pageId = rowMatch[1].trim();
    const pageTitle = rowMatch[2].trim();
    const pageDesc = rowMatch[3].trim();
    const requiredCap = rowMatch[4].trim();

    tocHtml += `<li><a href="#page-${pageId}">${pageId}. ${pageTitle}</a></li>`;

    let imgHtml = `<div style="text-align:center; padding: 3rem; width: 100%;">이미지 캡처 필요: ${requiredCap}</div>`;
    if (pageId === '1-1') imgHtml = '<img src="images/1_main_view.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '1-2') imgHtml = '<img src="images/2_sample_data.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '1-3') imgHtml = '<img src="images/3_rack_focus.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '1-7') imgHtml = '<img src="images/4_device_modal.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '2-1') imgHtml = '<img src="images/7_edit_mode.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '3-1') imgHtml = '<img src="images/9_device_mgmt.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '5-1') imgHtml = '<img src="images/11_model_list.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';
    if (pageId === '5-3') imgHtml = '<img src="images/12_new_model_form.png" alt="' + pageTitle + '" class="screenshot" draggable="false">';

    let tableRows = '';
    if (manualUIData[pageId]) {
      manualUIData[pageId].forEach((item, idx) => {
        tableRows += `
          <div class="ui-item">
            <div class="ui-item-header">
              <span class="element-number">${idx + 1}</span>
              <span class="ui-item-name">${item.name}</span>
              <span class="badge ${getBadgeClass(item.type)}">${item.type}</span>
            </div>
            <div class="ui-item-desc">${item.desc}</div>
          </div>`;
      });
    } else {
      const elements = pageDesc.split(',').map(e => e.trim()).filter(e => e.length > 0);
      elements.forEach((elText, idx) => {
        let name = elText;
        let desc = elText + " 기능을 수행합니다.";
        if (elText.includes('→')) {
          const parts = elText.split('→');
          name = parts[0].trim() + " 인터랙션";
          desc = "사용자가 " + parts[0].trim() + " 시, " + parts[1].trim() + " 동작이 발생합니다.";
        } else if (elText.includes('(')) {
          name = elText.split('(')[0].trim();
          desc = elText + " 정보를 포함합니다.";
        }

        const uiType = guessUIType(elText);

        tableRows += `
          <div class="ui-item">
            <div class="ui-item-header">
              <span class="element-number">${idx + 1}</span>
              <span class="ui-item-name">${name}</span>
              <span class="badge ${getBadgeClass(uiType)}">${uiType}</span>
            </div>
            <div class="ui-item-desc">${desc}</div>
          </div>`;
      });
      if (elements.length === 0) tableRows = `<div class="ui-item">UI 요소 설명이 없습니다.</div>`;
    }

    pagesHtml += `
    <div id="page-${pageId}" class="page">
      <h2 class="page-title"><span class="page-id">${pageId}</span> ${pageTitle}</h2>
      <h3>화면 설명</h3>
      <p>본 화면은 <strong>${pageTitle}</strong> 기능과 관련된 동작 및 상태를 표시합니다. 주요 기능으로 [${pageDesc}] 등을 포함하고 있습니다.</p>

      <div class="page-content-split">
        <div class="page-left">
          <div class="screenshot-container">
            <div class="editor-toolbar">
              <button onclick="addCircle(this)">+ 숫자 마커 추가</button>
              <button onclick="addBox(this)">+ 영역 박스 추가</button>
              <span style="font-size: 0.85rem; color: #64748b; margin-left: auto;">마커 드래그 이동 / 리사이징 (박스 우측 하단) / 삭제 (우클릭)</span>
            </div>
            <div class="image-wrapper">
              ${imgHtml}
            </div>
          </div>
        </div>

        <div class="page-right">
          <h3>UI 요소 설명</h3>
          <div class="ui-list">
            ${tableRows}
          </div>
        </div>
      </div>
    </div>`;
  }
  tocHtml += '</ul></li>';
}
tocHtml += '</ul></nav>';
pagesHtml += '</div>';

const jsCode = `
<script>
  let isEditMode = false;
  let activeMarker = null;
  let offsetX = 0;
  let offsetY = 0;

  function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editToggleBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    if (isEditMode) {
      document.body.classList.add('edit-mode-active');
      btn.innerText = '✅ 마커 편집 끄기 (저장됨)';
      btn.style.background = '#10b981'; // Green
      clearBtn.style.display = 'block';
    } else {
      document.body.classList.remove('edit-mode-active');
      btn.innerText = '✏️ 마커 편집 켜기';
      btn.style.background = '#3b82f6'; // Blue
      clearBtn.style.display = 'none';
    }
  }

  let contextTarget = null;

  document.addEventListener('contextmenu', (e) => {
    const contextMenu = document.getElementById('markerContextMenu');
    if (isEditMode && e.target.classList.contains('marker')) {
      e.preventDefault();
      contextTarget = e.target;
      contextMenu.style.display = 'flex';
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
    } else {
      contextMenu.style.display = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    const contextMenu = document.getElementById('markerContextMenu');
    if (contextMenu.style.display === 'flex') {
      contextMenu.style.display = 'none';
    }
  });

  window.changeZIndex = function(action) {
    if (!contextTarget) return;
    let currentZ = parseInt(contextTarget.style.zIndex) || 10;
    
    const siblings = Array.from(contextTarget.parentElement.querySelectorAll('.marker'));
    let maxZ = 10, minZ = 10;
    siblings.forEach(s => {
      const z = parseInt(s.style.zIndex) || 10;
      if(z > maxZ) maxZ = z;
      if(z < minZ) minZ = z;
    });

    if (action === 'front') currentZ = maxZ + 1;
    else if (action === 'back') currentZ = minZ - 1;
    else if (action === 'forward') currentZ += 1;
    else if (action === 'backward') currentZ -= 1;

    contextTarget.style.zIndex = currentZ;
    saveAllMarkers();
  };

  window.deleteMarker = function() {
    if (!contextTarget) return;
    contextTarget.remove();
    contextTarget = null;
    saveAllMarkers();
  };

  document.addEventListener('mousedown', (e) => {
    if (isEditMode && e.target.classList.contains('marker')) {
      // Right click is handled above, ignore here for dragging (button 0 is left click)
      if (e.button !== 0) return;
      
      const rect = e.target.getBoundingClientRect();
      
      // If it's a box, prevent drag when clicking the bottom-right resize handle
      if (e.target.classList.contains('marker-box')) {
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        if (clickX > rect.width - 20 && clickY > rect.height - 20) {
          return; // Let native CSS resize handle it
        }
      }
      
      activeMarker = e.target;
      offsetX = e.clientX;
      offsetY = e.clientY;
      
      // Save initial percentage position, or compute if not set
      const container = activeMarker.parentElement;
      activeMarker.dataset.startX = parseFloat(activeMarker.style.left) || (activeMarker.offsetLeft / container.offsetWidth * 100);
      activeMarker.dataset.startY = parseFloat(activeMarker.style.top) || (activeMarker.offsetTop / container.offsetHeight * 100);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (activeMarker && isEditMode) {
      e.preventDefault();
      const container = activeMarker.parentElement;
      
      let dx = e.clientX - offsetX;
      let dy = e.clientY - offsetY;

      let newLeft = parseFloat(activeMarker.dataset.startX) + (dx / container.offsetWidth * 100);
      let newTop = parseFloat(activeMarker.dataset.startY) + (dy / container.offsetHeight * 100);

      activeMarker.style.left = newLeft + '%';
      activeMarker.style.top = newTop + '%';
    }
  });

  document.addEventListener('mouseup', () => {
    if (activeMarker) {
      activeMarker = null;
      saveAllMarkers();
    }
  });

  function addCircle(btn) {
    if (!isEditMode) return;
    const container = btn.closest('.screenshot-container');
    const imageContainer = container.querySelector('.image-wrapper');
    const div = document.createElement('div');
    div.className = 'marker marker-circle';
    div.contentEditable = true;
    
    // Find next number for this container
    const existingCircles = Array.from(imageContainer.querySelectorAll('.marker-circle'));
    let maxNum = 0;
    existingCircles.forEach(c => {
      const num = parseInt(c.innerText);
      if(!isNaN(num) && num > maxNum) maxNum = num;
    });
    
    div.innerText = (maxNum + 1).toString();
    div.style.left = '10%';
    div.style.top = '10%';
    
    div.oninput = function() { saveAllMarkers(); };
    
    imageContainer.appendChild(div);
    saveAllMarkers();
  }

  function addBox(btn) {
    if (!isEditMode) return;
    const container = btn.closest('.screenshot-container');
    const imageContainer = container.querySelector('.image-wrapper');
    const div = document.createElement('div');
    div.className = 'marker marker-box';
    div.style.left = '10%';
    div.style.top = '10%';
    div.style.width = '20%';
    div.style.height = '15%';
    
    // Use ResizeObserver to detect manual resizing by CSS 'resize'
    new ResizeObserver((entries) => {
      if (isEditMode && !activeMarker) {
        for (let entry of entries) {
          const box = entry.target;
          const wrapper = box.parentElement;
          if(wrapper && box.style.width && box.style.width.endsWith('px')) {
            box.style.width = (box.offsetWidth / wrapper.offsetWidth * 100) + '%';
            box.style.height = (box.offsetHeight / wrapper.offsetHeight * 100) + '%';
          }
        }
        saveAllMarkers();
      }
    }).observe(div);
    
    imageContainer.appendChild(div);
    saveAllMarkers();
  }

  function saveAllMarkers() {
    const state = {};
    document.querySelectorAll('.image-wrapper').forEach(wrapper => {
      const pageId = wrapper.closest('.page').id;
      const markers = Array.from(wrapper.querySelectorAll('.marker')).map(m => {
        // Fallback to absolute if percentages aren't set properly yet
        let left = m.style.left;
        let top = m.style.top;
        let width = m.style.width;
        let height = m.style.height;
        
        // If they are in px, convert to %
        if (left.endsWith('px') || top.endsWith('px') || (width && width.endsWith('px'))) {
           const wrapperW = wrapper.offsetWidth;
           const wrapperH = wrapper.offsetHeight;
           if (left.endsWith('px')) left = (m.offsetLeft / wrapperW * 100) + '%';
           if (top.endsWith('px')) top = (m.offsetTop / wrapperH * 100) + '%';
           if (width && width.endsWith('px')) {
             width = (m.offsetWidth / wrapperW * 100) + '%';
             height = (m.offsetHeight / wrapperH * 100) + '%';
           }
        }

        return {
          type: m.classList.contains('marker-circle') ? 'circle' : 'box',
          left: left,
          top: top,
          width: width,
          height: height,
          zIndex: m.style.zIndex || '10',
          text: m.innerText
        };
      });
      state[pageId] = markers;
    });
    localStorage.setItem('storyboard_markers', JSON.stringify(state));
  }

  function loadMarkers() {
    const saved = localStorage.getItem('storyboard_markers');
    if (saved) {
      const state = JSON.parse(saved);
      document.querySelectorAll('.image-wrapper').forEach(wrapper => {
        const pageId = wrapper.closest('.page').id;
        const markers = state[pageId];
        if (markers && markers.length > 0) {
          markers.forEach(mData => {
            const div = document.createElement('div');
            div.className = 'marker ' + (mData.type === 'circle' ? 'marker-circle' : 'marker-box');
            div.style.left = mData.left;
            div.style.top = mData.top;
            div.style.zIndex = mData.zIndex || '10';
            if (mData.type === 'box') {
              div.style.width = mData.width;
              div.style.height = mData.height;
              new ResizeObserver(() => { if (isEditMode) saveAllMarkers(); }).observe(div);
            } else {
              div.contentEditable = true;
              div.innerText = mData.text;
              div.oninput = function() { saveAllMarkers(); };
            }
            wrapper.appendChild(div);
          });
        }
      });
    }
  }

  function clearAllData() {
    if (!isEditMode) return;
    if(confirm('모든 이미지에 추가된 마커와 박스를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      localStorage.removeItem('storyboard_markers');
      document.querySelectorAll('.marker').forEach(m => m.remove());
    }
  }

  function initScrollSpy() {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          
          document.querySelectorAll('.sidebar-nav a').forEach(link => {
            link.classList.remove('active');
          });
          
          const activeLink = document.querySelector('.sidebar-nav a[href="#' + id + '"]');
          if (activeLink) {
            activeLink.classList.add('active');
            
            const sidebar = document.querySelector('.sidebar-nav');
            const linkRect = activeLink.getBoundingClientRect();
            const sidebarRect = sidebar.getBoundingClientRect();
            
            if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
              activeLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      });
    }, observerOptions);

    document.querySelectorAll('.page').forEach((page) => {
      observer.observe(page);
    });
  }

  window.onload = () => {
    loadMarkers();
    initScrollSpy();
    
    document.querySelectorAll('.sidebar-nav > ul > li > strong').forEach(title => {
      title.addEventListener('click', () => {
        title.parentElement.classList.toggle('collapsed');
      });
    });

    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar-nav');
        const mainContent = document.querySelector('.main-content');
        
        sidebar.classList.toggle('hidden');
        sidebarToggleBtn.classList.toggle('hidden');
        mainContent.classList.toggle('expanded');
        
        if (sidebar.classList.contains('hidden')) {
          sidebarToggleBtn.innerText = '▶';
        } else {
          sidebarToggleBtn.innerText = '◀';
        }
      });
    }
  };
</script>
</body>
</html>
`;

htmlOut += tocHtml + pagesHtml + jsCode;
fs.writeFileSync('docs/화면설계서.html', htmlOut, 'utf-8');
console.log('Generated docs/화면설계서.html with sidebar and floating buttons.');

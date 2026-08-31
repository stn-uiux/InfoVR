<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Three.js-0.182-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Zustand-5-F36D00?style=for-the-badge" alt="Zustand" />
</p>

# 🏢 InfoVR

> **인터랙티브 3D 서버실 시각화 및 장비 관리 시스템**
>
> 브라우저에서 실행되는 WebGL 기반 3D 서버실 환경을 구축하고,
> 랙·장비·포트를 직관적으로 배치·관리·모니터링할 수 있는 풀스택 프론트엔드 애플리케이션입니다.

---

## ✨ 주요 기능

### 🖥️ 3D 서버실 환경
- **React Three Fiber** 기반 실시간 3D 렌더링
- 랙, 벽, 파티션, 조명 등 빌트인 오브젝트 배치
- GLB/GLTF 커스텀 3D 모델 임포트 지원
- 마우스 기반 오브젝트 이동·회전·스케일 조작 (Gizmo)
- 카메라 자동 포커싱 및 Fit-to-Scene

### 📦 랙 & 장비 관리
- **24U / 32U / 48U** 표준·와이드 랙 생성
- 드래그 앤 드롭 기반 장비 배치
- 장비 등록(CRUD) 모달 — IP, MAC, 모델명, 제조사 등 상세 속성 관리
- SVG 기반 장비 전면 패널 시각화

### 🔌 포트 & 모듈 시스템
- **인터랙티브 포트 호버/클릭** — 포트 상태 실시간 확인
- 모듈러 카드(CPIOM 등) 슬롯에 **Ethernet / SFP 모듈** 삽입·제거
- SVG 컴포저를 통한 동적 포트 합성 렌더링
- 포트 에러 오버레이 및 심각도별 시각화 (`critical` / `major` / `minor` / `warning`)

### 📊 대시보드 & 모니터링
- 장비 현황 위젯 (총 장비 수, 에러율 등)
- 실시간 디지털 시계
- 랙별 에러 마커 표시
- 라이트/다크 테마 전환

### 📁 데이터 관리
- **Excel(XLSX) Import / Export** — 전체 서버실 데이터 일괄 관리
- LocalStorage + IndexedDB 기반 영속 저장
- Undo / Redo 지원 (`Ctrl+Z` / `Ctrl+Shift+Z`)
- 변경사항 추적 및 저장 알림 (Dirty State)
- 계층 트리 구조 (Root → Group → Site → Room → Zone)

---

## 🏗️ 기술 스택

| 카테고리 | 기술 |
|:---|:---|
| **프레임워크** | React 19 + TypeScript 5.9 |
| **3D 엔진** | Three.js 0.182 · React Three Fiber · Drei |
| **상태관리** | Zustand 5 |
| **빌드 도구** | Vite 7 |
| **스타일링** | Pure Vanilla CSS (CSS Variables 기반) |
| **데이터 처리** | SheetJS (xlsx) · IndexedDB |
| **애니메이션** | React Spring · @use-gesture/react |

---

## 📂 프로젝트 구조

```
InfoVR/
├── arcVRoom/            # arcVRoom 별도 앱/페이지 디렉토리
├── public/
│   ├── models/          # 3D 모델 에셋 (GLB)
│   ├── assets/          # 팝업 및 기타 정적 이미지 에셋
│   ├── font/            # 커스텀 폰트
│   └── materials/       # 커스텀 재질/큐브맵 에셋 등
├── src/
│   ├── assets/          # 장비/모듈 SVG 및 관련 에셋
│   │   ├── card/        # 모듈러 카드 에셋
│   │   └── gwacheon/    # 특정 벤더/사이트 관련 에셋
│   ├── components/
│   │   ├── 3d/                  # 3D 씬 및 Three.js 렌더링
│   │   │   ├── CameraController.tsx         # 카메라의 시점 이동 및 줌 제어
│   │   │   ├── CyberSpaceEnvironment.tsx    # 사이버 스페이스 환경(바닥, 조명 등) 구성
│   │   │   ├── ErrorMarker.tsx              # 장비 에러 발생 시 3D 공간 상에 경고 마커 표시
│   │   │   ├── GlobalFocusLights.tsx        # 장비를 포커스할 때 활성화되는 조명 효과
│   │   │   ├── GltfErrorBoundary.tsx        # 모델 로딩 실패 시 앱 크래시 방지용 에러 바운더리
│   │   │   ├── ImportedModelMesh.tsx        # GLTF 파싱 및 커스텀 재질(Material) 적용
│   │   │   ├── ModelImporter.tsx            # 외부 GLB/GLTF 모델 동적 임포트 래퍼
│   │   │   ├── Rack.tsx                     # 서버 랙 3D 렌더링 및 내부 장비 슬롯 배치
│   │   │   ├── Scene.tsx                    # Canvas 기반의 전체 3D 씬 루트 컴포넌트
│   │   │   └── SpotLightWithTarget.tsx      # 특정 위치를 비추는 스포트라이트 조명
│   │   ├── account/             # 계정 및 권한 관리
│   │   │   ├── AccountPermissionsModal.tsx  # 사용자별 시스템/장비 접근 권한 설정 모달
│   │   │   ├── CreateAccountModal.tsx       # 신규 관리자 및 일반 사용자 계정 생성 모달
│   │   │   └── MyPageModal.tsx              # 로그인된 사용자의 내 정보(비밀번호 등) 수정 모달
│   │   ├── device/              # 장비 관련 UI 및 관리
│   │   │   ├── CardThumbnail.tsx            # 모듈/카드의 SVG 에셋을 썸네일 형태로 렌더링
│   │   │   ├── DeviceModal.tsx              # 장비 상세 정보(스펙, 이력 등) 조회 메인 모달
│   │   │   ├── DevicePanel.tsx              # 장비 클릭 시 노출되는 상태 및 포트 상세 패널(2D)
│   │   │   ├── DeviceRegistrationModal.tsx  # 신규 장비 단건/대량 등록 및 위치 할당 모달
│   │   │   ├── DeviceRegistrationModal/     # 대량 등록을 위한 NodePicker 등 하위 컴포넌트 폴더
│   │   │   ├── DeviceSvgPreview.tsx         # 2D 기반 장비 전/후면 실시간 미리보기
│   │   │   ├── DeviceTooltip.tsx            # 3D 공간에서 장비 마우스 오버 시 나타나는 플로팅 툴팁
│   │   │   ├── ModulePopover.tsx            # 장비 내 슬롯 카드를 클릭했을 때 뜨는 모듈 상태 팝업
│   │   │   ├── PortErrorOverlay.tsx         # 물리 포트에 알람/장애 발생 시 렌더링되는 시각적 오버레이
│   │   │   └── PortErrorSynchronizer.tsx    # 서버의 장애 상태를 3D 포트 에셋에 동기화하는 로직
│   │   ├── layout/              # 대시보드 및 화면 프레임 레이아웃
│   │   │   ├── CyberSpaceControlPanel.tsx   # 3D 환경 뷰어 컨트롤(리셋, 테마 변경 등) 도구 패널
│   │   │   ├── CyberSpaceToggle.tsx         # 사이버 스페이스(3D)와 일반 모드 뷰 전환 스위치
│   │   │   ├── DashboardWidgets.tsx         # 메인 우측 상단의 장비 통계, 알람 발생 등 요약 위젯
│   │   │   ├── DigitalClock.tsx             # 대시보드에 표기되는 실시간 디지털 시계
│   │   │   ├── FocusCarousel.tsx            # 장애 장비나 포커스된 장비를 순회하며 볼 수 있는 하단 슬라이더
│   │   │   ├── HierarchyTree.tsx            # 사이트 > 룸 > 랙 형태의 물리적 계층형 네비게이션 트리
│   │   │   ├── InitialLoader.tsx            # 최초 접속 시 3D 모델과 SVG를 로딩하는 프로그레스 바 화면
│   │   │   ├── SettingsDropdown.tsx         # 시스템 환경설정 및 로그아웃 메뉴 드롭다운
│   │   │   └── SharedTreeNodeItem.tsx       # 계층 트리의 각 노드(폴더/단말) 렌더링 아이템
│   │   ├── model/               # 3D 모델 및 커스텀 템플릿 정의
│   │   │   ├── EquipmentAssemblyModal.tsx   # 섀시형 장비에 모듈식 카드를 조립하여 새로운 변형을 굽는 모달
│   │   │   └── ModelRegistrationModal/      # 물리적 포트 위치 지정(InteractiveGridEditor) 및 신규 모델 타입 등록 폼
│   │   ├── system/              # 시스템 공통/유틸리티 알림
│   │   │   ├── ImportExportModal.tsx        # 엑셀(CSV) 기반 시스템 데이터 일괄 Import / Export 기능
│   │   │   └── UnsavedChangesDialog.tsx     # 편집 도중 닫기 시도 시 "저장되지 않은 정보가 있습니다" 경고 다이얼로그
│   │   └── ui/                  # 프로젝트 전역 재사용 UI (Vanilla CSS 기반 Design System)
│   │       ├── BaseModal.tsx                # 기존 구형 팝업 모달 래퍼 (StnModal로 전환 진행 중)
│   │       ├── Breadcrumb.tsx               # 상단 현재 위치 탐색기 (예: GWA > ROOM_01 > RACK_A)
│   │       ├── StnBadge.tsx                 # 장애(Red) / 정상(Green) 등을 표시하는 배지 라벨
│   │       ├── StnFormField.tsx             # 폼 입력 시 필수 여부 표기 및 유효성 에러 라벨 래퍼
│   │       ├── StnInput.tsx                 # 디자인 시스템이 적용된 공통 텍스트 인풋박스
│   │       ├── StnModal.tsx                 # 모던 디자인 시스템이 적용된 커스텀 최상위 팝업 컨테이너
│   │       ├── StnSelect.tsx                # 검색 기능을 지원하는 공통 드롭다운 셀렉트 폼
│   │       ├── StnTable.tsx                 # 목록 조회 및 페이지네이션을 지원하는 데이터 그리드 표
│   │       └── ThemeToggle.tsx              # 라이트 모드 ↔ 다크 모드 전환 스위치
│   ├── css/                 # 순수 CSS 모음 (theme, layout, components 등)
│   ├── hooks/
│   │   ├── usePortInteraction.ts  # 포트 호버/클릭 인터랙션
│   │   ├── useSvgComposer.ts      # SVG 동적 합성
│   │   └── ...
│   ├── pages/               # 로그인, 회원가입 등 페이지 컴포넌트
│   ├── port-wizard/         # 포트맵핑 마법사 관련 기능
│   ├── store/
│   │   └── useStore.ts            # Zustand 글로벌 스토어
│   ├── contexts/
│   │   └── ThemeContext.tsx       # 라이트/다크 테마 컨텍스트
│   ├── types/
│   │   ├── index.ts               # 공통 타입 정의
│   │   └── equipment.ts           # 장비·모듈 타입
│   ├── utils/
│   │   ├── storage.ts             # 데이터 영속화 (Excel ↔ Store)
│   │   ├── deviceAssets.ts        # 장비 에셋 매핑
│   │   ├── cardAssets.ts          # 모듈러 카드 에셋
│   │   └── ...
│   └── main.tsx             # 앱 엔트리 포인트
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 시작하기

### 사전 요구사항

- **Node.js** ≥ 18
- **npm** ≥ 9

### 설치 & 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속합니다.

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 프리뷰
npm run preview
```

---

## 🎮 사용법

### 기본 조작

| 조작 | 동작 |
|:---|:---|
| **좌클릭 드래그** | 카메라 회전 |
| **우클릭 드래그** | 카메라 팬 |
| **스크롤** | 줌 인/아웃 |
| **랙 클릭** | 랙 상세 패널 열기 |
| **장비 클릭** | 장비 상세 모달 열기 |
| `Ctrl + Z` | 실행 취소 (Undo) |
| `Ctrl + Shift + Z` | 다시 실행 (Redo) |
| `Ctrl + S` | 변경사항 저장 |

### 모드

- **View Mode** — 서버실 모니터링 및 장비 상태 조회
- **Edit Mode** — 랙 추가/삭제, 장비 배치, 3D 모델 임포트, 데이터 Import/Export

---

## 🎨 디자인 시스템

순수 CSS(Vanilla CSS)를 기반으로 한 커스텀 디자인 시스템을 사용합니다.

- CSS Custom Properties(Variables)를 활용한 테마 토큰
- 라이트 / 다크 모드 완전 지원
- 모듈화된 CSS 구조 (theme, layout, components, features 등 분리)
- 일관된 색상·타이포그래피·간격 체계 및 글래스모피즘, 마이크로 애니메이션 적용

---

## 📜 라이선스

이 프로젝트는 비공개 프로젝트입니다.

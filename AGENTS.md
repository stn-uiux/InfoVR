# 레포지토리 가이드라인

## 프로젝트 구조 및 모듈 구성

Vite + React + TypeScript 기반의 3D 서버룸 및 장비 모델링 앱입니다. 주요 코드는 `src/`에 있습니다.

- `src/components/`: React UI 컴포넌트 (모달, 랙 렌더링, 프리뷰, 씬 컨트롤 등).
- `src/store/`: Zustand 애플리케이션 상태 및 액션.
- `src/hooks/`: 재사용 가능한 React 훅 (SVG 합성 로직 포함).
- `src/utils/`: 에셋 로딩, 스토리지, 지오메트리, 비교, 포트 헬퍼 유틸리티.
- `src/types/`: 공유 TypeScript 인터페이스 및 도메인 타입.
- `src/assets/`: SVG, PNG, 카드, 3D 에셋 및 **아이콘 오프라인 번들(`icons-bundle.json`)**.
- `src/css/`: 전역 스타일시트 (theme, base, layout, components, features, auth).
- `src/contexts/`: React Context 프로바이더 (테마 등).
- `src/pages/`: 페이지 단위 컴포넌트 (로그인, 회원가입 등).
- `src/port-wizard/`: 별도의 포트 매핑 마법사 경험.
- `public/`: 정적 퍼블릭 에셋.
- `dist/`: 빌드 출력물. 수동으로 편집하지 말 것.

## 빌드, 테스트 및 개발 명령어

- `npm run dev`: Vite 개발 서버 시작.
- `npm run build`: TypeScript 검사 후 `dist/`에 프로덕션 에셋 생성.
- `npm run lint`: 전체 레포지토리에 ESLint 실행.
- `npm run preview`: 빌드된 `dist/` 출력물을 로컬에서 서빙.

현재 `npm test` 스크립트는 설정되어 있지 않습니다. 변경 사항 전달 전 `npm run build`와 `npm run lint`를 기본 검증 수단으로 사용하세요.

## 코딩 스타일 및 네이밍 규칙

TypeScript와 React 함수형 컴포넌트를 사용합니다. `any` 대신 `src/types/`의 명시적 도메인 타입을 우선 사용하세요. 컴포넌트 파일명은 PascalCase, 훅은 `useSomething.ts`, 유틸리티는 camelCase 파일로 작성합니다. CSS는 `src/css/`에 배치합니다.

기존 스타일을 따르세요: TS/TSX에서 2칸 들여쓰기, 대부분의 편집 파일에서 큰따옴표 사용, 필요한 경우에만 간결한 주석 작성. 새로운 추상화를 추가하기 전에 `src/utils/`의 기존 헬퍼를 먼저 재사용하세요.

## 아이콘 관리 (오프라인 번들)

이 프로젝트는 **폐쇄망(오프라인) 환경**에서도 모든 아이콘이 정상적으로 표시되어야 합니다. 아이콘은 `@iconify/react`의 `<Icon>` 컴포넌트를 통해 사용되며, 오프라인 지원을 위해 `src/assets/icons-bundle.json`에 SVG 데이터가 사전 번들링되어 있습니다.

### 아이콘 추가 시 필수 절차

1. **새로운 `<Icon icon="prefix:name" />` 사용 시**, 반드시 해당 아이콘의 SVG 데이터를 `src/assets/icons-bundle.json`에 추가해야 합니다.
2. Iconify API(`https://api.iconify.design/{prefix}.json?icons={name}`)에서 아이콘 데이터를 가져와 해당 prefix 컬렉션의 `icons` 객체에 추가합니다.
3. 번들에 새 prefix 컬렉션이 필요하면 `{ "prefix": "...", "lastModified": ..., "aliases": {}, "width": 24, "height": 24, "icons": {} }` 형태로 새 항목을 추가합니다.
4. 추가 후 앱을 오프라인 상태에서 테스트하여 아이콘이 정상 표시되는지 확인합니다.

### 현재 번들에 포함된 아이콘 컬렉션

`mdi`, `material-symbols`, `fluent`, `lucide`, `ph`, `gis`, `mynaui`, `ri`, `line-md`, `humbleicons`, `icon-park-solid`

## 테스트 가이드라인

`package.json`에 자동화된 테스트 프레임워크가 설정되어 있지 않습니다. 동작 변경 시 TypeScript 검사, ESLint, Vite 개발 서버에서의 수동 테스트로 검증하세요. 추후 테스트를 추가할 경우, 해당 기능 근처에 배치하거나 명확한 테스트 디렉토리 하위에 배치합니다.

## 커밋 및 풀 리퀘스트 가이드라인

최근 커밋 히스토리는 `feat:`, `fix:`, `refactor:` 등 Conventional Commit 스타일 접두사를 사용합니다. 커밋은 하나의 논리적 변경에 한정하세요. 예시: `fix: apply custom model row gaps in equipment assembly`.

풀 리퀘스트에는 요약, 검증 단계(`npm run build`, `npm run lint`, 수동 확인), 관련 이슈 링크(해당 시), UI 변경 시 스크린샷을 포함해야 합니다.

## 보안 및 설정 팁

로컬 시크릿은 `.env.local`에 보관하고, 환경별 인증 정보를 커밋하지 마세요. `dist/` 생성물은 릴리스 또는 배포에 명시적으로 필요한 경우에만 커밋합니다.

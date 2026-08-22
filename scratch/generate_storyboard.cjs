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
      line-height: 1.6;
      color: var(--text-main);
      background-color: var(--bg-light);
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: white;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      min-height: 100vh;
    }

    header {
      border-bottom: 2px solid var(--primary-color);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    h1 {
      color: var(--primary-color);
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .meta-info {
      color: var(--text-light);
      font-size: 0.95rem;
    }

    .toc {
      background: var(--bg-light);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 3rem;
      border: 1px solid var(--border-color);
    }
    
    .toc h2 {
      margin-top: 0;
      color: var(--primary-color);
    }

    .toc ul {
      list-style-type: none;
      padding-left: 0;
    }

    .toc li {
      margin-bottom: 0.5rem;
    }

    .toc a {
      color: var(--secondary-color);
      text-decoration: none;
      font-weight: 500;
    }

    .toc a:hover {
      text-decoration: underline;
    }

    .page {
      margin-bottom: 4rem;
      padding-top: 2rem;
      border-top: 1px dashed var(--border-color);
    }

    .page-title {
      font-size: 1.8rem;
      color: var(--primary-color);
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .page-id {
      background: var(--secondary-color);
      color: white;
      padding: 0.2rem 0.8rem;
      border-radius: 4px;
      font-size: 1.2rem;
    }

    .screenshot-container {
      margin: 1.5rem 0;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      background: #f1f5f9;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
    }

    .screenshot {
      width: 100%;
      display: block;
    }

    h3 {
      color: var(--primary-color);
      border-left: 4px solid var(--secondary-color);
      padding-left: 0.8rem;
      margin-top: 2rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }

    th, td {
      border: 1px solid var(--border-color);
      padding: 0.75rem;
      text-align: left;
    }

    th {
      background-color: var(--bg-light);
      font-weight: 600;
      color: var(--primary-color);
    }

    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      background: #e2e8f0;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: monospace;
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
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📐 ArcVRack 화면설계서 (Storyboard)</h1>
      <div class="meta-info">
        <strong>버전:</strong> v1.0 | <strong>작성일:</strong> 2026-08-19 | <strong>관련 문서:</strong> 기능명세서 v1.5
      </div>
    </header>
`;

let htmlOut = htmlStart;

// Parse TOC
const chapterRegex = /### (\d+)장\. ([^\n]+)/g;
let chapters = [];
let match;
while ((match = chapterRegex.exec(md)) !== null) {
  chapters.push({ num: match[1], title: match[2].trim(), pos: match.index });
}

let tocHtml = '<div class="toc"><h2>목차</h2><ul>';
let pagesHtml = '';

// Helper function to guess UI type based on description text
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

// Custom manual overrides for the first few critical screens to be very polished
const manualUIData = {
  "1-1": [
    { name: "좌측 사이드바 (계층 트리)", type: "Panel", desc: "지역/센터/전산실 등 논리적 계층 구조를 트리 형태로 제공. 노드 검색 기능 포함." },
    { name: "가상공간", type: "3D Canvas", desc: "바닥과 벽면이 렌더링된 메인 3D 뷰어 공간. 드래그로 회전/이동 가능." },
    { name: "Fit Models 버튼", type: "Button", desc: "우측 상단의 카메라 큐브 컨트롤 아래 위치. 클릭 시 씬 내 모든 오브젝트가 화면에 맞게 자동 줌인/아웃됨." },
    { name: "테마 & 모드 토글", type: "Switch", desc: "우측 상단 상단바. Edit Mode ON/OFF 스위치 및 Light/Dark 테마 전환 토글 제공." }
  ],
  "1-2": [
    { name: "3D 랙 모델 군집", type: "3D Object", desc: "실제 배치된 랙들이 3D로 렌더링됨. 클릭 시 해당 랙으로 시점이 자동 포커싱됨." },
    { name: "에러 마커 툴팁", type: "Floating UI", desc: "에러가 발생한 장비 위에 Critical, Major, Minor, Warning 상태 툴팁이 오버레이 표시됨." },
    { name: "우측 대시보드 위젯", type: "Panel", desc: "<span class='badge'>전체 장애 현황</span> 및 <span class='badge'>온·습도 현황</span> 위젯 표시. 장애 건수 요약 및 룸별 온도 게이지 바 제공." },
    { name: "Focus Carousel", type: "Navigation", desc: "하단 중앙의 네비게이션 컨트롤. 전체 랙 개수와 현재 순번을 보여주며 좌우 화살표로 랙 순차 탐색 가능." }
  ],
  "1-3": [
    { name: "랙 포커스 라이팅", type: "3D Effect", desc: "선택된 랙 주변이 밝아지고(PointLight Intensity 증가) 다른 영역은 상대적으로 어두워져 몰입감 제공." },
    { name: "우측 Device Panel", type: "Sidebar", desc: "선택된 랙의 이름(Rack e1e5), U 용량(32U), 소속 전산실 뱃지 정보 표시." },
    { name: "슬롯 리스트 (Rack Layout)", type: "List", desc: "상단부터 U 단위로 슬롯 상태 표시. 빈 슬롯은 <span class='badge'>+ Available</span>로, 장착된 슬롯은 장비 썸네일과 모델명으로 표시." },
    { name: "닫기 버튼 (X)", type: "Button", desc: "우측 상단의 닫기 버튼. 클릭 시 패널이 닫히고 카메라는 다시 줌아웃 상태로 돌아감." }
  ],
  "1-7": [
    { name: "장비 스펙 헤더", type: "Header", desc: "장비명(S-DEV-SW-PORTAL-10), 유형 뱃지(Router), 랙 위치, 제조사, 모델명, IP, MAC 주소 표기." },
    { name: "SVG 시각화 영역", type: "Graphics", desc: "장비 전면부(또는 후면부) 그래픽 렌더링. 빈 슬롯과 삽입된 카드의 형상이 사실적으로 표현됨." },
    { name: "면 표시 라벨", type: "Badge", desc: "좌측 상단에 '앞면', 우측 상단에 '기본' 라벨 표시. (양면 모델인 경우 상하 스크롤로 뒷면 동시 뷰어 지원)" },
    { name: "포트 호버 인터랙션", type: "Tooltip", desc: "그래픽 상의 포트에 마우스를 올리면 포트 번호와 연결 상태가 툴팁으로 표시됨." }
  ]
};

// Extract table data for each chapter
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

    let imgHtml = `<div style="text-align:center; padding: 3rem;">이미지 캡처 필요: ${requiredCap}</div>`;
    if (pageId === '1-1') imgHtml = '<img src="images/1_main_view.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '1-2') imgHtml = '<img src="images/2_sample_data.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '1-3') imgHtml = '<img src="images/3_rack_focus.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '1-7') imgHtml = '<img src="images/4_device_modal.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '2-1') imgHtml = '<img src="images/7_edit_mode.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '3-1') imgHtml = '<img src="images/9_device_mgmt.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '5-1') imgHtml = '<img src="images/11_model_list.png" alt="' + pageTitle + '" class="screenshot">';
    if (pageId === '5-3') imgHtml = '<img src="images/12_new_model_form.png" alt="' + pageTitle + '" class="screenshot">';

    // Generate UI Table rows
    let tableRows = '';
    if (manualUIData[pageId]) {
      manualUIData[pageId].forEach((item, idx) => {
        tableRows += `
          <tr>
            <td style="text-align:center"><span class="element-number">${idx + 1}</span></td>
            <td><strong>${item.name}</strong></td>
            <td><span class="badge">${item.type}</span></td>
            <td>${item.desc}</td>
          </tr>`;
      });
    } else {
      // Auto-generate from description (split by comma)
      const elements = pageDesc.split(',').map(e => e.trim()).filter(e => e.length > 0);
      elements.forEach((elText, idx) => {
        // Extract a name and description
        let name = elText;
        let desc = elText + " 기능을 수행합니다.";

        // If there's an arrow, it's an interaction
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
          <tr>
            <td style="text-align:center"><span class="element-number">${idx + 1}</span></td>
            <td><strong>${name}</strong></td>
            <td><span class="badge">${uiType}</span></td>
            <td>${desc}</td>
          </tr>`;
      });

      if (elements.length === 0) {
        tableRows = `<tr><td colspan="4">UI 요소 설명이 없습니다.</td></tr>`;
      }
    }

    pagesHtml += `
    <div id="page-${pageId}" class="page">
      <h2 class="page-title"><span class="page-id">${pageId}</span> ${pageTitle}</h2>
      
      <h3>화면 설명</h3>
      <p>본 화면은 <strong>${pageTitle}</strong> 기능과 관련된 동작 및 상태를 표시합니다. 주요 기능으로 [${pageDesc}] 등을 포함하고 있습니다.</p>

      <div class="screenshot-container">
        ${imgHtml}
      </div>

      <h3>UI 요소 설명</h3>
      <table>
        <thead>
          <tr>
            <th width="6%" style="text-align:center">#</th>
            <th width="22%">요소명</th>
            <th width="15%">유형</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>`;
  }

  tocHtml += '</ul></li>';
}

tocHtml += '</ul></div>';

htmlOut += tocHtml + pagesHtml + '</div></body></html>';
fs.writeFileSync('docs/화면설계서.html', htmlOut, 'utf-8');
console.log('Generated docs/화면설계서.html with UI Element tables.');

const fs = require('fs');

const itemsData = JSON.parse(fs.readFileSync('docs/extracted_items.json', 'utf8'));
const state = {};

const rules = [
  { match: /뷰어|메인 3D|캔버스|그리드 영역|레이아웃|모달/, pos: { l: 50, t: 50 }, box: { w: 60, h: 60 } },
  { match: /전체보기/, pos: { l: 85, t: 80 } },
  { match: /토글|Edit Mode|스위치|테마/, pos: { l: 90, t: 10 } },
  { match: /사이드바|계층 트리|트리|Object Registry|리스트|목록|모델 목록/, pos: { l: 15, t: 50 }, box: { w: 20, h: 80 } },
  { match: /검색|검색창/, pos: { l: 15, t: 15 }, box: { w: 20, h: 8 } },
  { match: /아이콘/, pos: { l: 10, t: 30 } },
  { match: /캐러셀/, pos: { l: 50, t: 90 }, box: { w: 30, h: 10 } },
  { match: /에러 요약|요약 카드/, pos: { l: 85, t: 20 }, box: { w: 25, h: 15 } },
  { match: /테이블|Drill-down/, pos: { l: 85, t: 65 }, box: { w: 25, h: 50 } },
  { match: /게이지|온도|습도|물방울/, pos: { l: 85, t: 45 }, box: { w: 25, h: 25 } },
  { match: /헤더/, pos: { l: 20, t: 10 }, box: { w: 30, h: 8 } },
  { match: /SVG|시각화/, pos: { l: 40, t: 50 }, box: { w: 40, h: 60 } },
  { match: /툴바|상단/, pos: { l: 50, t: 10 }, box: { w: 50, h: 8 } },
  { match: /패널|설정|우측|속성|씬 라이트|재질|압축/, pos: { l: 85, t: 50 }, box: { w: 25, h: 60 } },
  { match: /기즈모|오브젝트|박스|드래그|포트/, pos: { l: 50, t: 50 } },
  { match: /업로드|Import|Export|내보내기/, pos: { l: 50, t: 50 }, box: { w: 30, h: 30 } },
  { match: /폼/, pos: { l: 70, t: 50 }, box: { w: 40, h: 60 } },
  { match: /버튼/, pos: { l: 85, t: 15 } },
  { match: /자르기|분석|Analysis/, pos: { l: 85, t: 15 }, box: { w: 20, h: 20 } },
];

function getPosAndBox(name) {
  for (let rule of rules) {
    if (rule.match.test(name)) {
      return { pos: rule.pos, box: rule.box };
    }
  }
  // Default fallback if nothing matches
  return { pos: { l: 40, t: 40 }, box: null };
}

itemsData.forEach((pageData) => {
  const pageId = pageData.page;
  const markers = [];
  
  // To slightly jitter items falling on the same exact coordinate
  const usedCoords = new Set();

  pageData.items.forEach((item) => {
    let { pos, box } = getPosAndBox(item.name);
    
    // add small jitter
    while (usedCoords.has(`${pos.l},${pos.t}`)) {
      pos.l += 5;
      pos.t += 5;
    }
    usedCoords.add(`${pos.l},${pos.t}`);

    // If there is a box, we position the box at center based on its width/height
    if (box) {
      const boxLeft = pos.l - box.w / 2;
      const boxTop = pos.t - box.h / 2;
      
      markers.push({
        type: 'box',
        left: boxLeft + '%',
        top: boxTop + '%',
        width: box.w + '%',
        height: box.h + '%',
        zIndex: '10',
        text: ''
      });

      // circle at the top-left of the box
      markers.push({
        type: 'circle',
        left: (boxLeft - 2) + '%',
        top: (boxTop - 2) + '%',
        zIndex: '20',
        text: item.id
      });
    } else {
      markers.push({
        type: 'circle',
        left: pos.l + '%',
        top: pos.t + '%',
        zIndex: '20',
        text: item.id
      });
    }
  });

  state[pageId] = markers;
});

// Update the HTML file
let html = fs.readFileSync('docs/화면설계서.html', 'utf8');

const defaultStateStr = JSON.stringify(state);

// Find the loadMarkers string and replace its JSON injected content
html = html.replace(/let saved = localStorage\.getItem\('storyboard_markers[^']*'\);/, "let saved = localStorage.getItem('storyboard_markers_v4');");
html = html.replace(/localStorage\.setItem\('storyboard_markers[^']*'/, "localStorage.setItem('storyboard_markers_v4'");
html = html.replace(/localStorage\.removeItem\('storyboard_markers[^']*'\);/, "localStorage.removeItem('storyboard_markers_v4');");

// In case the JSON injection didn't use let saved =, we replace the whole block or specifically target it
html = html.replace(/const saved = localStorage\.getItem\('storyboard_markers[^']*'\);/, "let saved = localStorage.getItem('storyboard_markers_v4');");
html = html.replace(/saved = JSON\.stringify\(\{.*\}\);/, `saved = JSON.stringify(${defaultStateStr});`);
// if it wasn't replaced because of no saved = JSON.stringify, we inject it after if (!saved) {
if (!html.includes(defaultStateStr)) {
  html = html.replace(/if \(!saved\) \{/, `if (!saved) {\n        saved = JSON.stringify(${defaultStateStr});`);
}

fs.writeFileSync('docs/화면설계서.html', html);
console.log('Successfully injected smarter default markers into HTML.');

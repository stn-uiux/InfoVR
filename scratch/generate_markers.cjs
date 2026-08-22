const fs = require('fs');

const itemsData = JSON.parse(fs.readFileSync('docs/extracted_items.json', 'utf8'));

const state = {};

itemsData.forEach((pageData) => {
  const pageId = pageData.page;
  const markers = [];
  
  const positions = [
    { left: '15%', top: '15%' },
    { left: '75%', top: '15%' },
    { left: '15%', top: '75%' },
    { left: '75%', top: '75%' },
    { left: '45%', top: '45%' },
    { left: '45%', top: '15%' },
    { left: '15%', top: '45%' },
    { left: '75%', top: '45%' },
    { left: '45%', top: '75%' },
  ];

  pageData.items.forEach((item, index) => {
    const isLarge = /뷰어|패널|사이드바|영역|모달|폼|테이블|리스트|목록|박스/.test(item.name);
    const pos = positions[index % positions.length];
    
    // add circle
    markers.push({
      type: 'circle',
      left: pos.left,
      top: pos.top,
      zIndex: '20',
      text: item.id
    });
    
    // if large, add a box near it
    if (isLarge) {
      markers.push({
        type: 'box',
        left: (parseFloat(pos.left) - 2) + '%',
        top: (parseFloat(pos.top) - 2) + '%',
        width: '25%',
        height: '25%',
        zIndex: '10',
        text: ''
      });
    }
  });

  state[pageId] = markers;
});

// Update the HTML file
let html = fs.readFileSync('docs/화면설계서.html', 'utf8');

const defaultStateStr = JSON.stringify(state);

// We will inject it into loadMarkers()
const loadMarkersCode = `
    function loadMarkers() {
      let saved = localStorage.getItem('storyboard_markers');
      if (!saved) {
        // Inject default AI generated markers
        saved = JSON.stringify(${defaultStateStr});
      }
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
                div.oninput = function () { saveAllMarkers(); };
              }
              wrapper.appendChild(div);
            });
          }
        });
      }
    }
`;

html = html.replace(/function loadMarkers\(\) \{[\s\S]*?(?=function clearAllData)/, loadMarkersCode + '\n');
fs.writeFileSync('docs/화면설계서.html', html);
console.log('Successfully injected default markers into HTML.');

const fs = require('fs');
const html = fs.readFileSync('docs/화면설계서.html', 'utf8');

const pages = html.split('<div id="page-').slice(1).map(p => {
  const id = 'page-' + p.split('"')[0];
  const itemsMatch = p.match(/<span class="element-number">(\d+)<\/span>\s*<span class="ui-item-name">([^<]+)<\/span>/g);
  let items = [];
  if (itemsMatch) {
    items = itemsMatch.map(m => {
      const match = m.match(/<span class="element-number">(\d+)<\/span>\s*<span class="ui-item-name">([^<]+)<\/span>/);
      return { id: match[1], name: match[2].trim() };
    });
  }
  return { page: id, items };
});

fs.writeFileSync('docs/extracted_items.json', JSON.stringify(pages, null, 2));
console.log('Extracted ' + pages.length + ' pages');

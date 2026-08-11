const fs = require('fs');
const path = require('path');

const cssFile = path.resolve('c:/Users/user/workspace/stn-uiux/arcVRack/src/css/features.css');
let css = fs.readFileSync(cssFile, 'utf8');

const replacements = [
  {
    from: "font-family: ui-sans-serif, system-ui, sans-serif;",
    to: "font-family: 'Pretendard', ui-sans-serif, system-ui, sans-serif;"
  },
  {
    from: "padding: 2.5rem;",
    to: "padding: 1.5rem;"
  },
  {
    from: "gap: 2.5rem;",
    to: "gap: 1.5rem;"
  },
  {
    from: "gap: 1.5rem;",
    to: "gap: 1rem;"
  },
  {
    from: "margin-top: 2rem;",
    to: "margin-top: 1rem;"
  },
  {
    from: "width: 2.75rem;\n  height: 2.75rem;",
    to: "width: 28px;\n  height: 28px;"
  },
  {
    from: "height: 2.5rem;",
    to: "height: 28px;"
  },
  {
    from: "width: 2.5rem;\n  height: 2.5rem;",
    to: "width: 28px;\n  height: 28px;"
  },
  {
    from: "padding: 0.75rem 0.375rem;",
    to: "padding: 0 0.5rem;\n  height: 28px;"
  },
  {
    from: "width: 100%;\n  height: 3.5rem;",
    to: "width: 100%;\n  height: 28px;"
  }
];

let modified = false;
replacements.forEach(r => {
  if (css.includes(r.from)) {
    css = css.split(r.from).join(r.to);
    modified = true;
    console.log("Replaced:", r.from.substring(0, 30));
  } else {
    console.log("NOT FOUND:", r.from.substring(0, 30));
  }
});

if (modified) {
  fs.writeFileSync(cssFile, css, 'utf8');
  console.log("File saved");
} else {
  console.log("No changes made");
}

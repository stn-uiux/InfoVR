const fs = require('fs');

// Using dynamic import for marked to support ES modules if needed, or simply require if it's CJS.
// We'll install marked locally first.
const mdContent = fs.readFileSync('arcVRack_feature_summary.md', 'utf-8');

const generate = async () => {
  const { marked } = await import('marked');
  const htmlContent = marked.parse(mdContent);

  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>arcVRack 기능명세서</title>
  <style>
    :root {
      --bg-color: #f8f9fa;
      --text-color: #333;
      --border-color: #e9ecef;
      --link-color: #007bff;
      --header-bg: #fff;
      --code-bg: #f1f3f5;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #1e1e1e;
        --text-color: #e0e0e0;
        --border-color: #333;
        --link-color: #4da3ff;
        --header-bg: #252526;
        --code-bg: #2d2d2d;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      margin: 0;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--header-bg);
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    h1, h2, h3 {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
      margin-top: 30px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    th, td {
      padding: 12px;
      border: 1px solid var(--border-color);
      text-align: left;
    }

    th {
      background-color: var(--code-bg);
      font-weight: 600;
    }

    blockquote {
      border-left: 4px solid var(--link-color);
      margin: 0;
      padding: 10px 20px;
      background-color: var(--code-bg);
      border-radius: 0 4px 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    ${htmlContent}
  </div>
</body>
</html>`;

  fs.writeFileSync('public/docs/arcVRack_feature_summary.html', fullHtml);
  console.log('Generated HTML successfully.');
};

generate().catch(console.error);

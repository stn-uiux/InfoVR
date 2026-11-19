$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = (Get-Location).Path }

$csharpCode = @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class OfflineDemoServer {
    private readonly string _rootDir;
    private TcpListener _listener;
    private bool _running;

    private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { ".html", "text/html; charset=utf-8" },
        { ".js", "application/javascript; charset=utf-8" },
        { ".mjs", "application/javascript; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".svg", "image/svg+xml" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".webp", "image/webp" },
        { ".gif", "image/gif" },
        { ".ico", "image/x-icon" },
        { ".wasm", "application/wasm" },
        { ".glb", "model/gltf-binary" },
        { ".gltf", "model/gltf+json" },
        { ".hdr", "application/octet-stream" },
        { ".cube", "text/plain; charset=utf-8" },
        { ".woff", "font/woff" },
        { ".woff2", "font/woff2" },
        { ".ttf", "font/ttf" },
        { ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    };

    public OfflineDemoServer(string rootDir) {
        _rootDir = Path.GetFullPath(rootDir);
    }

    public int Start(int preferredPort) {
        for (int port = preferredPort; port < preferredPort + 50; port++) {
            try {
                _listener = new TcpListener(IPAddress.Loopback, port);
                _listener.Start();
                _running = true;
                Thread acceptThread = new Thread(AcceptLoop);
                acceptThread.IsBackground = true;
                acceptThread.Start();
                return port;
            } catch {
                // Try next port
            }
        }
        throw new Exception("Available port not found.");
    }

    private void AcceptLoop() {
        while (_running) {
            try {
                TcpClient client = _listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(state => HandleClient((TcpClient)state), client);
            } catch {
                if (!_running) break;
            }
        }
    }

    private void HandleClient(TcpClient client) {
        using (client)
        using (NetworkStream stream = client.GetStream()) {
            try {
                stream.ReadTimeout = 10000;
                stream.WriteTimeout = 30000;

                // Read HTTP request header
                byte[] buffer = new byte[8192];
                int bytesRead = stream.Read(buffer, 0, buffer.Length);
                if (bytesRead <= 0) return;

                string requestText = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                string[] lines = requestText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length == 0) return;

                string[] requestLine = lines[0].Split(' ');
                if (requestLine.Length < 2) return;

                string method = requestLine[0].ToUpperInvariant();
                string rawUrl = requestLine[1];

                // Handle POST /__save_custom_models gracefully in demo mode
                if (method == "POST" && rawUrl.StartsWith("/__save_custom_models")) {
                    byte[] okBody = Encoding.UTF8.GetBytes("{\"success\":true}");
                    WriteResponse(stream, "200 OK", "application/json; charset=utf-8", okBody);
                    return;
                }

                string urlPath = Uri.UnescapeDataString(rawUrl.Split('?')[0]);
                if (urlPath == "/") urlPath = "/index.html";

                string relativePath = urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                string filePath = Path.GetFullPath(Path.Combine(_rootDir, relativePath));

                // Prevent path traversal outside rootDir
                if (!filePath.StartsWith(_rootDir, StringComparison.OrdinalIgnoreCase)) {
                    WriteResponse(stream, "403 Forbidden", "text/plain", Encoding.UTF8.GetBytes("Forbidden"));
                    return;
                }

                if (Directory.Exists(filePath)) {
                    string dirIndex = Path.Combine(filePath, "index.html");
                    if (File.Exists(dirIndex)) {
                        filePath = dirIndex;
                    }
                }

                // SPA fallback: if no file exists and URL has no file extension, serve index.html
                if (!File.Exists(filePath)) {
                    string extCheck = Path.GetExtension(filePath);
                    if (string.IsNullOrEmpty(extCheck) && !urlPath.StartsWith("/__")) {
                        filePath = Path.Combine(_rootDir, "index.html");
                    }
                }

                if (!File.Exists(filePath)) {
                    WriteResponse(stream, "404 Not Found", "text/plain", Encoding.UTF8.GetBytes("Not Found"));
                    return;
                }

                string ext = Path.GetExtension(filePath);
                string contentType = "application/octet-stream";
                if (!string.IsNullOrEmpty(ext) && MimeTypes.ContainsKey(ext)) {
                    contentType = MimeTypes[ext];
                } else if (string.IsNullOrEmpty(ext) && Path.GetFileName(filePath).StartsWith("__")) {
                    contentType = "application/json; charset=utf-8";
                }

                byte[] fileBytes = File.ReadAllBytes(filePath);
                if (Path.GetFileName(filePath).Equals("index.html", StringComparison.OrdinalIgnoreCase)) {
                    string html = Encoding.UTF8.GetString(fileBytes);
                    if (!html.Contains("__INFOVR_OFFLINE_DEMO__")) {
                        html = html.Replace("<head>", "<head><script>window.__INFOVR_OFFLINE_DEMO__=true;</script>");
                        fileBytes = Encoding.UTF8.GetBytes(html);
                    }
                }
                WriteResponse(stream, "200 OK", contentType, fileBytes);
            } catch {
                // Ignore client disconnect errors
            }
        }
    }

    private void WriteResponse(NetworkStream stream, string status, string contentType, byte[] body) {
        StringBuilder sb = new StringBuilder();
        sb.Append("HTTP/1.1 ").Append(status).Append("\r\n");
        sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
        sb.Append("Content-Length: ").Append(body.Length).Append("\r\n");
        sb.Append("Cache-Control: no-cache\r\n");
        sb.Append("Access-Control-Allow-Origin: *\r\n");
        sb.Append("Connection: close\r\n\r\n");

        byte[] headerBytes = Encoding.ASCII.GetBytes(sb.ToString());
        stream.Write(headerBytes, 0, headerBytes.Length);
        if (body.Length > 0) {
            stream.Write(body, 0, body.Length);
        }
        stream.Flush();
    }
}
"@

Add-Type -TypeDefinition $csharpCode -Language CSharp

$server = New-Object OfflineDemoServer($rootDir)
$port = $server.Start(4173)
$url = "http://127.0.0.1:$port"

Clear-Host
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  InfoVR Offline Demo Server (No Installation / Offline Ready)" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URL : $url" -ForegroundColor Yellow
Write-Host "  Root: $rootDir" -ForegroundColor Gray
Write-Host ""
Write-Host "  [Info] Browser will open automatically." -ForegroundColor White
Write-Host "  [Stop] Close this window or press Ctrl+C to stop the demo." -ForegroundColor Gray
Write-Host "================================================================" -ForegroundColor Cyan

Start-Process $url

try {
    while ($true) {
        Start-Sleep -Seconds 3600
    }
} finally {
    Write-Host "Stopping server..."
}


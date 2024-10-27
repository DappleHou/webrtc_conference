const https = require('https');  // 使用 https 模块
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// 加载 SSL 证书
const options = {
    key: fs.readFileSync('server.key'),   // 替换为你的 .key 文件路径
    cert: fs.readFileSync('server.crt')   // 替换为你的 .crt 文件路径
};

// 创建 HTTPS 服务器
const server = https.createServer(options, (req, res) => {
    // 处理静态文件的请求
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';  // 默认提供 index.html
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.svg': 'application/image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 创建 WebSocket 服务器并绑定到 HTTPS 服务器
const wss = new WebSocket.Server({ server });

var count = 0;
const clients = {};
wss.on('connection', (ws) => {
    console.log('Client connected');
    clients[count] = ws;
    count++;
    ws.on('message', (message) => {
        console.log(`Received message => ${message}`);
        // 向所有客户端广播消息
        wss.clients.forEach((client) => {
            console.log(client._socket.remoteAddress);
            if(ws._socket.remoteAddress===client._socket.remoteAddress){
                return;
            }

            if (client.readyState === WebSocket.OPEN) {
                console.log("===================");
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// 监听 HTTPS 和 WebSocket 服务器
server.listen(8081, () => {
    console.log('HTTPS server is running at https://localhost:8081');
});

const ws = new WebSocket('wss://192.168.99.67:8081'); // 使用 HTTPS 时需要 wss

let localStream;
let peerConnection;
const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // 示例 STUN 服务器
};
const configuration = {
    iceServers: []
  };

// 获取本地视频流
async function start() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        // 创建 RTCPeerConnection
        peerConnection = new RTCPeerConnection(configuration);

        // 将本地流添加到连接
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        // 处理远程流
        peerConnection.ontrack = (event) => {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
        };

        // 处理 ICE 候选
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        // 创建并发送 offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', offer: offer }));
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
}

// 处理 WebSocket 消息
let candidateQueue = []; // 用于存储 ICE 候选者
let isRemoteDescriptionSet = false; // 标识远程描述是否已设置

// 处理 WebSocket 消息
ws.onmessage = async (message) => {
    try {
        const data = await (message.data instanceof Blob ? message.data.text() : message.data);
        const parsedData = JSON.parse(data);

        if (parsedData.type === 'offer') {
           
            if (peerConnection.signalingState === 'have-local-offer') {
                // 处理 offer
                await peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData.offer));
                isRemoteDescriptionSet = true;
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: 'answer', answer: answer }));

                // 处理缓存的候选者
                processCandidateQueue();
            } else {
                console.warn("Received offer in wrong state:", peerConnection.signalingState);
            }
        } else if (parsedData.type === 'answer') {
            if (peerConnection.signalingState === 'have-local-offer') {
                // 处理 answer
                await peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData.answer));
                isRemoteDescriptionSet = true;

                // 处理缓存的候选者
                processCandidateQueue();
            } else {
                console.warn("Received answer in wrong state:", peerConnection.signalingState);
            }
        } else if (parsedData.type === 'candidate') {
            if (isRemoteDescriptionSet) {
                // 如果远程描述已设置，直接添加候选者
                await peerConnection.addIceCandidate(new RTCIceCandidate(parsedData.candidate));
            } else {
                // 否则，缓存候选者
                candidateQueue.push(parsedData.candidate);
            }
        }
    } catch (error) {
        console.error('error', error);
    }
};

// 处理缓存的 ICE 候选者
function processCandidateQueue() {
    candidateQueue.forEach(async (candidate) => {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding cached candidate', error);
        }
    });
    candidateQueue = []; // 清空队列
}




// 绑定按钮点击事件
document.getElementById('startCall').addEventListener('click', start);

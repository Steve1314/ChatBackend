# Frontend Implementation Examples - WhatsApp-like Chat

## 📱 Complete Frontend Integration Code

### 1. **Socket.IO Connection & Message Handling**

```javascript
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';
let socket;

// Initialize socket connection
export function initializeSocket(userEmail) {
  socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to server');
    socket.emit('identify', { email: userEmail });
  });

  socket.on('userStatus', ({ email, online, lastSeen }) => {
    console.log(`${email} is ${online ? 'online' : 'offline'}`);
    updateUserStatus(email, online, lastSeen);
  });

  socket.on('presence', ({ online }) => {
    console.log('Online users:', online);
    updatePresenceList(online);
  });

  socket.on('newMessage', ({ chatId, message }) => {
    console.log('New message received:', message);
    addMessageToChat(chatId, message);
    
    // Auto-mark as delivered
    if (message.sender !== getCurrentUserId()) {
      markMessageAsDelivered(message._id);
    }
  });

  socket.on('messageReadReceipt', ({ messageId, readBy, readAt }) => {
    console.log(`Message ${messageId} read by ${readBy}`);
    updateMessageStatus(messageId, 'read', readBy, readAt);
  });

  socket.on('deliveryReceipt', ({ messageIds, deliveredAt }) => {
    messageIds.forEach(id => updateMessageStatus(id, 'delivered'));
  });

  socket.on('messageEdited', ({ chatId, message }) => {
    console.log('Message edited:', message);
    updateMessageInUI(message);
  });

  socket.on('messageDeleted', ({ chatId, messageId }) => {
    removeMessageFromUI(messageId);
  });

  socket.on('messageStarred', ({ messageId, starred }) => {
    updateStarStatus(messageId, starred);
  });

  return socket;
}

export function closeSocket() {
  if (socket) socket.disconnect();
}

export function getSocket() {
  return socket;
}
```

---

### 2. **Typing Indicators**

```javascript
let typingTimeout;

export function notifyTyping(chatId, email) {
  socket.emit('typing', { chatId, email });
  
  // Clear previous timeout
  clearTimeout(typingTimeout);
  
  // Stop typing after 3 seconds
  typingTimeout = setTimeout(() => {
    notifyStopTyping(chatId, email);
  }, 3000);
}

export function notifyStopTyping(chatId, email) {
  socket.emit('stopTyping', { chatId, email });
  clearTimeout(typingTimeout);
}

// Listen to typing events
socket.on('typing', ({ chatId, email }) => {
  showTypingIndicator(chatId, email);
});

socket.on('stopTyping', ({ chatId, email }) => {
  hideTypingIndicator(chatId, email);
});
```

---

### 3. **Send Message with Status Tracking**

```javascript
export async function sendMessage(chatId, text, mediaIds = []) {
  try {
    const response = await fetch(`/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        text,
        mediaIds
      })
    });

    if (!response.ok) throw new Error('Failed to send message');
    
    const message = await response.json();
    
    // Message status starts as "sent"
    console.log('Message sent with status:', message.status); // "sent"
    
    return message;
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

// Mark message as delivered (when message appears on receiver's screen)
export async function markMessageAsDelivered(messageId) {
  try {
    await fetch(`/messages/${messageId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status: 'delivered' })
    });
  } catch (error) {
    console.error('Mark delivered error:', error);
  }
}

// Mark message as read (when user actually reads the message)
export async function markMessageAsRead(messageId) {
  try {
    const response = await fetch(`/messages/${messageId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status: 'read' })
    });

    const message = await response.json();
    
    // Notify others in the chat
    const chatId = message.chat;
    socket.emit('messageRead', {
      chatId,
      messageId,
      email: getCurrentUserEmail()
    });

    return message;
  } catch (error) {
    console.error('Mark read error:', error);
  }
}
```

---

### 4. **Message Editing**

```javascript
export async function editMessage(messageId, newText) {
  try {
    const response = await fetch(`/messages/${messageId}/edit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ text: newText })
    });

    if (!response.ok) throw new Error('Failed to edit message');
    
    const updatedMessage = await response.json();
    console.log('Message edited at:', updatedMessage.editedAt);
    console.log('Edit history:', updatedMessage.editHistory);
    
    return updatedMessage;
  } catch (error) {
    console.error('Edit message error:', error);
    throw error;
  }
}

// UI Example
function showMessageMenu(message) {
  return (
    <div className="message-menu">
      <button onClick={() => editMessage(message._id, prompt('Edit message:'))}>
        ✏️ Edit
      </button>
      <button onClick={() => starMessage(message._id)}>
        ⭐ Star
      </button>
      <button onClick={() => deleteMessage(message._id)}>
        🗑️ Delete
      </button>
      {message.editedAt && <span className="edited-badge">Edited</span>}
    </div>
  );
}
```

---

### 5. **Star/Pin Messages**

```javascript
export async function starMessage(messageId) {
  try {
    const response = await fetch(`/messages/${messageId}/star`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    const { starred } = await response.json();
    return starred;
  } catch (error) {
    console.error('Star message error:', error);
  }
}

// Display starred messages in chat
export async function getStarredMessages(chatId) {
  const chats = await getAllChats();
  const chat = chats.find(c => c._id === chatId);
  
  if (!chat) return [];

  const messages = await fetch(`/chats/${chatId}/messages`)
    .then(r => r.json());
  
  return messages.filter(m => m.starred);
}
```

---

### 6. **Audio Call Implementation (WebRTC)**

```javascript
let localStream;
let peerConnection;
let currentCallId;

// ICE servers configuration
const iceServers = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:stun1.l.google.com:19302'] }
  ]
};

// Initialize call
export async function initiateAudioCall(chatId, receiverEmail, myEmail) {
  try {
    // Step 1: Create call record on backend
    const callResponse = await fetch('/calls/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        chatId,
        type: 'audio'
      })
    });

    const callRecord = await callResponse.json();
    currentCallId = callRecord._id;

    // Step 2: Get local stream
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Step 3: Emit socket event to notify receiver
    socket.emit('initiateCall', {
      toEmail: receiverEmail,
      fromEmail: myEmail,
      chatId,
      callType: 'audio'
    });

    console.log('Call initiated, waiting for response...');
    return callRecord;
  } catch (error) {
    console.error('Initiate call error:', error);
    throw error;
  }
}

// Handle incoming call
socket.on('incomingCall', async ({ fromEmail, chatId, callType }) => {
  console.log(`Incoming ${callType} call from ${fromEmail}`);
  
  // Show incoming call notification
  showIncomingCallUI({
    from: fromEmail,
    type: callType,
    onAccept: () => acceptCall(chatId, fromEmail),
    onReject: () => rejectCall(currentCallId)
  });
});

// Accept call
export async function acceptCall(chatId, callerEmail) {
  try {
    // Get local stream
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Mark call as accepted on backend
    await fetch(`/calls/${currentCallId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    // Create peer connection
    peerConnection = new RTCPeerConnection(iceServers);
    
    // Add local stream
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      displayRemoteAudio(event.streams[0]);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', {
          toEmail: callerEmail,
          candidate: event.candidate,
          callId: currentCallId
        });
      }
    };

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('callOffer', {
      toEmail: callerEmail,
      offer,
      callId: currentCallId
    });

    console.log('Call accepted, sending offer...');
  } catch (error) {
    console.error('Accept call error:', error);
    throw error;
  }
}

// Reject call
export async function rejectCall(callId) {
  try {
    await fetch(`/calls/${callId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ reason: 'user-declined' })
    });

    socket.emit('rejectCall', {
      toEmail: otherUserEmail,
      callId,
      reason: 'user-declined'
    });
  } catch (error) {
    console.error('Reject call error:', error);
  }
}

// Receive call answer
socket.on('callOffer', async ({ offer, callId }) => {
  try {
    peerConnection = new RTCPeerConnection(iceServers);
    
    // Add local stream
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Set remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('callAnswer', {
      toEmail: otherUserEmail,
      answer,
      callId
    });
  } catch (error) {
    console.error('Handle offer error:', error);
  }
});

socket.on('callAnswer', async ({ answer }) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error('Handle answer error:', error);
  }
});

socket.on('iceCandidate', async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Add ICE candidate error:', error);
  }
});

// End call
export async function endCall() {
  try {
    // Stop all tracks
    localStream?.getTracks().forEach(track => track.stop());

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }

    // Update backend
    await fetch(`/calls/${currentCallId}/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    // Notify other user
    socket.emit('endCall', {
      toEmail: otherUserEmail,
      callId: currentCallId
    });

    console.log('Call ended');
  } catch (error) {
    console.error('End call error:', error);
  }
}

socket.on('callEnded', ({ callId }) => {
  console.log('Call ended by other user');
  endCall();
  showCallEndedUI();
});
```

---

### 7. **Video Call Implementation**

```javascript
export async function initiateVideoCall(chatId, receiverEmail, myEmail) {
  try {
    // Similar to audio but with video constraints
    const callResponse = await fetch('/calls/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        chatId,
        type: 'video'  // <-- Different from audio
      })
    });

    const callRecord = await callResponse.json();
    currentCallId = callRecord._id;

    // Get video + audio stream
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    });

    // Display local video
    displayLocalVideo(localStream);

    // Rest is same as audio call...
    socket.emit('initiateCall', {
      toEmail: receiverEmail,
      fromEmail: myEmail,
      chatId,
      callType: 'video'
    });

    return callRecord;
  } catch (error) {
    console.error('Initiate video call error:', error);
    throw error;
  }
}
```

---

### 8. **Call History**

```javascript
export async function getCallHistory(chatId) {
  try {
    const response = await fetch(`/calls/chat/${chatId}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    const calls = await response.json();
    return calls;
  } catch (error) {
    console.error('Get call history error:', error);
    return [];
  }
}

// Display call history in UI
function renderCallHistory(calls) {
  return calls.map(call => (
    <div key={call._id} className="call-history-item">
      <div className="call-type">
        {call.type === 'audio' ? '☎️' : '📹'} {call.type.toUpperCase()}
      </div>
      
      <div className="call-info">
        <div className="caller">{call.caller.name}</div>
        <div className="date">{new Date(call.createdAt).toLocaleString()}</div>
      </div>
      
      <div className="call-status">
        {call.status === 'missed' && <span className="badge missed">MISSED</span>}
        {call.status === 'ended' && (
          <span className="duration">{formatDuration(call.duration)}</span>
        )}
      </div>
    </div>
  ));
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}
```

---

### 9. **Read Receipts UI Component**

```javascript
function MessageReadReceipts({ message, chatMembers }) {
  if (!message.readBy || message.readBy.length === 0) {
    return <span className="status-icon">✓</span>; // Sent
  }

  if (message.readBy.length === chatMembers.length - 1) {
    return (
      <div className="read-receipts">
        <span className="status-icon">✓✓</span> {/* All read */}
        <div className="read-by-list">
          {message.readBy.map(r => (
            <div key={r.user} className="read-by-item">
              {r.user} at {new Date(r.readAt).toLocaleTimeString()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="read-receipts">
      <span className="status-icon">✓✓</span> {/* Partially read */}
      <span className="read-count">{message.readBy.length} read</span>
    </div>
  );
}
```

---

### 10. **Auto-mark Messages as Read on Scroll**

```javascript
export function setupAutoReadOnScroll(chatId, userId) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const messageId = entry.target.dataset.messageId;
        const senderId = entry.target.dataset.senderId;
        
        // Only mark others' messages as read
        if (senderId !== userId) {
          markMessageAsRead(messageId);
        }
      }
    });
  }, {
    root: null,
    rootMargin: '0px',
    threshold: 0.9
  });

  return observer;
}
```

---

## 🎨 **CSS Styling Examples**

```css
/* Message Status Indicators */
.message-status {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}

.message-status.sent::after {
  content: "✓";
}

.message-status.delivered::after {
  content: "✓✓";
}

.message-status.read::after {
  content: "✓✓";
  color: #0099ff;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  animation: bounce 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

/* Call UI */
.incoming-call {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
}

.call-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn-accept {
  background: #25d366;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-reject {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}
```

---

This implementation covers all essential WhatsApp-like features! 🚀

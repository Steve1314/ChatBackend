# Chat Backend - Complete API Routes Documentation

## Overview
Complete list of all API endpoints with request/response bodies for the WhatsApp-like chat backend.

---

## 📋 Table of Contents
1. [Authentication Routes](#authentication-routes)
2. [Users Routes](#users-routes)
3. [Chats Routes](#chats-routes)
4. [Messages Routes](#messages-routes)
5. [Calls Routes](#calls-routes)
6. [Media Routes](#media-routes)
7. [Notifications Routes](#notifications-routes)
8. [Contacts Routes](#contacts-routes)

---

## Authentication Routes

### Base URL: `/auth`

#### POST /auth/register
**Description:** Register a new user

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Response (201):**
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": "ObjectId",
    "name": "string",
    "email": "string"
  }
}
```

**Error Responses:**
- `400` - Missing required fields
- `409` - Email already registered
- `500` - Server error

---

#### POST /auth/login
**Description:** Login user and receive JWT token

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": "ObjectId",
    "name": "string",
    "email": "string"
  }
}
```

**Error Responses:**
- `404` - User not found
- `401` - Invalid credentials
- `500` - Server error

---

#### GET /auth/me
**Description:** Get current authenticated user details

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "avatarUrl": "string",
  "status": "string",
  "lastSeen": "Date"
}
```

**Protected:** ✅ Yes

---

## Users Routes

### Base URL: `/users`

#### PUT /users
**Description:** Update user profile

**Request Body:**
```json
{
  "email": "string",
  "name": "string",
  "avatarUrl": "string",
  "status": "string"
}
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "avatarUrl": "string",
  "status": "string"
}
```

---

#### GET /users/online
**Description:** Get list of online users

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "online": ["userId1", "userId2", "userId3"]
}
```

**Protected:** ✅ Yes

---

#### POST /users/status/update
**Description:** Update user typing status

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "typingIn": "chatId or null"
}
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "lastSeen": "Date",
  "typingIn": "chatId or null"
}
```

**Protected:** ✅ Yes

---

## Chats Routes

### Base URL: `/chats`

#### GET /chats
**Description:** Get all chats for a user

**Query Parameters:**
```
?email=user@example.com
```

**Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "type": "private or group",
    "members": [
      {
        "_id": "ObjectId",
        "name": "string",
        "email": "string",
        "avatarUrl": "string",
        "status": "string"
      }
    ],
    "lastMessageAt": "Date",
    "lastMessage": "ObjectId"
  }
]
```

**Error Responses:**
- `400` - email is required
- `404` - User not found
- `500` - Server error

---

#### POST /chats
**Description:** Create a new private chat

**Request Body:**
```json
{
  "myEmail": "string",
  "otherEmail": "string"
}
```

**Response (201):**
```json
{
  "_id": "ObjectId",
  "type": "private",
  "members": [
    {
      "_id": "ObjectId",
      "name": "string",
      "email": "string",
      "avatarUrl": "string",
      "status": "string"
    }
  ],
  "createdAt": "Date"
}
```

**Error Responses:**
- `400` - Missing required fields or cannot chat with yourself
- `404` - User not found
- `500` - Server error

---

#### GET /chats/:id/messages
**Description:** Get all messages in a chat

**Query Parameters:**
```
?email=user@example.com
```

**Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "chat": "ObjectId",
    "sender": {
      "_id": "ObjectId",
      "name": "string",
      "email": "string",
      "avatarUrl": "string"
    },
    "text": "string",
    "media": ["ObjectId"],
    "status": "sent or delivered or read",
    "readBy": [
      {
        "user": "ObjectId",
        "readAt": "Date"
      }
    ],
    "starred": "boolean",
    "createdAt": "Date"
  }
]
```

**Error Responses:**
- `400` - email is required
- `403` - Not a member of this chat
- `404` - User not found
- `500` - Server error

---

#### POST /chats/:id/messages
**Description:** Send a message to a chat

**Request Body:**
```json
{
  "senderEmail": "string",
  "text": "string (optional)",
  "mediaIds": ["ObjectId"] (optional)
}
```

**Response (201):**
```json
{
  "_id": "ObjectId",
  "chat": "ObjectId",
  "sender": "ObjectId",
  "text": "string",
  "media": ["ObjectId"],
  "status": "sent",
  "createdAt": "Date"
}
```

**Real-time Event:**
```javascript
socket.emit("newMessage", {
  chatId: "ObjectId",
  message: {...}
})
```

**Error Responses:**
- `400` - senderEmail is required
- `404` - Sender user not found
- `500` - Server error

---

## Messages Routes

### Base URL: `/messages` or `/chats/:chatId/messages`

#### POST /chats/:chatId/messages
**Description:** Create a new message (Protected)

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "text": "string (optional)",
  "mediaIds": ["ObjectId"] (optional)
}
```

**Response (201):**
```json
{
  "_id": "ObjectId",
  "chat": "ObjectId",
  "sender": {
    "_id": "ObjectId",
    "name": "string",
    "email": "string",
    "avatarUrl": "string"
  },
  "text": "string",
  "media": ["ObjectId"],
  "status": "sent",
  "createdAt": "Date"
}
```

**Error Responses:**
- `400` - Message text or media is required
- `403` - Not a member of this chat
- `500` - Server error

**Protected:** ✅ Yes

---

#### DELETE /messages/:id
**Description:** Delete a message (Soft delete)

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `404` - Message not found
- `403` - You can delete only your messages
- `500` - Server error

**Protected:** ✅ Yes

---

#### PUT /messages/:id/status
**Description:** Update message status (delivered/read)

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "status": "delivered or read"
}
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "status": "delivered or read",
  "readBy": [
    {
      "user": "ObjectId",
      "readAt": "Date"
    }
  ]
}
```

**Real-time Event:**
```javascript
socket.emit("messageStatusUpdate", {
  messageId: "ObjectId",
  status: "string",
  readBy: [...]
})
```

**Error Responses:**
- `400` - Invalid status
- `404` - Message not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### PUT /messages/:id/edit
**Description:** Edit an existing message

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "text": "string (required)"
}
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "text": "string",
  "editedAt": "Date",
  "editHistory": [
    {
      "oldText": "string",
      "editedAt": "Date"
    }
  ]
}
```

**Real-time Event:**
```javascript
socket.emit("messageEdited", {
  chatId: "ObjectId",
  message: {...}
})
```

**Error Responses:**
- `400` - Text is required or cannot edit messages with media
- `403` - You can edit only your messages
- `404` - Message not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### POST /messages/:id/star
**Description:** Star/unstar a message (Toggle)

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "starred": true or false
}
```

**Real-time Event:**
```javascript
socket.emit("messageStarred", {
  messageId: "ObjectId",
  starred: true or false
})
```

**Error Responses:**
- `404` - Message not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### GET /chats/:chatId/messages/unread
**Description:** Get unread message count

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "unreadCount": "number"
}
```

**Error Responses:**
- `403` - Not a member of this chat
- `500` - Server error

**Protected:** ✅ Yes

---

## Calls Routes

### Base URL: `/calls`

#### POST /calls/initiate
**Description:** Initiate a new call (audio or video)

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "chatId": "string (required)",
  "type": "audio or video",
  "receiverIds": ["ObjectId"] (optional)
}
```

**Response (201):**
```json
{
  "_id": "ObjectId",
  "chat": "ObjectId",
  "caller": {
    "_id": "ObjectId",
    "name": "string",
    "email": "string",
    "avatarUrl": "string"
  },
  "receivers": [
    {
      "_id": "ObjectId",
      "name": "string",
      "email": "string",
      "avatarUrl": "string"
    }
  ],
  "type": "audio or video",
  "status": "ringing",
  "participants": [
    {
      "user": "ObjectId",
      "joinedAt": "Date"
    }
  ],
  "createdAt": "Date"
}
```

**Real-time Event:**
```javascript
socket.emit("incomingCall", {
  callId: "ObjectId",
  chatId: "ObjectId",
  caller: {
    id: "ObjectId",
    name: "string",
    email: "string"
  },
  type: "audio or video",
  timestamp: "Date"
})
```

**Error Responses:**
- `400` - chatId is required or invalid type
- `403` - Not a member of this chat
- `500` - Server error

**Protected:** ✅ Yes

---

#### POST /calls/:callId/accept
**Description:** Accept an incoming call

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "status": "ongoing",
  "startedAt": "Date",
  "participants": [
    {
      "user": "ObjectId",
      "joinedAt": "Date"
    }
  ]
}
```

**Real-time Event:**
```javascript
socket.emit("callAccepted", {
  callId: "ObjectId",
  acceptedBy: "ObjectId",
  status: "ongoing"
})
```

**Error Responses:**
- `404` - Call not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### POST /calls/:callId/reject
**Description:** Reject an incoming call

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "reason": "user-declined or user-busy or call-ended (optional)"
}
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "status": "rejected",
  "rejectionReason": "string"
}
```

**Real-time Event:**
```javascript
socket.emit("callRejected", {
  callId: "ObjectId",
  rejectedBy: "ObjectId",
  reason: "string"
})
```

**Error Responses:**
- `404` - Call not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### POST /calls/:callId/end
**Description:** End an ongoing call

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "status": "ended",
  "endedAt": "Date",
  "duration": "number (seconds)",
  "participants": [
    {
      "user": "ObjectId",
      "joinedAt": "Date",
      "leftAt": "Date",
      "duration": "number"
    }
  ]
}
```

**Real-time Event:**
```javascript
socket.emit("callEnded", {
  callId: "ObjectId",
  endedBy: "ObjectId",
  duration: "number"
})
```

**Error Responses:**
- `404` - Call not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### GET /calls/chat/:chatId
**Description:** Get call history for a chat (Last 50)

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "chat": "ObjectId",
    "caller": {
      "_id": "ObjectId",
      "name": "string",
      "email": "string",
      "avatarUrl": "string"
    },
    "receivers": [
      {
        "_id": "ObjectId",
        "name": "string",
        "email": "string",
        "avatarUrl": "string"
      }
    ],
    "type": "audio or video",
    "status": "ended or missed or rejected",
    "startedAt": "Date",
    "endedAt": "Date",
    "duration": "number",
    "participants": [...]
  }
]
```

**Error Responses:**
- `403` - Not a member of this chat
- `500` - Server error

**Protected:** ✅ Yes

---

#### GET /calls/:callId
**Description:** Get specific call details

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "_id": "ObjectId",
  "chat": "ObjectId",
  "caller": {
    "_id": "ObjectId",
    "name": "string",
    "email": "string",
    "avatarUrl": "string"
  },
  "receivers": [...],
  "type": "audio or video",
  "status": "string",
  "startedAt": "Date",
  "endedAt": "Date",
  "duration": "number",
  "participants": [
    {
      "user": {
        "_id": "ObjectId",
        "name": "string",
        "email": "string",
        "avatarUrl": "string"
      },
      "joinedAt": "Date",
      "leftAt": "Date",
      "duration": "number"
    }
  ],
  "quality": {
    "avgLatency": "number",
    "packetLoss": "number",
    "jitter": "number"
  }
}
```

**Error Responses:**
- `404` - Call not found
- `500` - Server error

**Protected:** ✅ Yes

---

#### DELETE /calls/:callId
**Description:** Delete call history

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
{
  "message": "Call deleted"
}
```

**Error Responses:**
- `403` - Not authorized
- `404` - Call not found
- `500` - Server error

**Protected:** ✅ Yes

---

## Media Routes

### Base URL: `/media`

#### POST /media/upload
**Description:** Upload files (up to 10 files)

**Request Type:** Form-Data (multipart/form-data)

**Form Fields:**
```
- files: array of files (max 10)
- senderEmail: string (required)
```

**Response (201):**
```json
[
  {
    "_id": "ObjectId",
    "filename": "string",
    "mimetype": "string",
    "size": "number",
    "path": "/media/filename",
    "uploader": "ObjectId",
    "createdAt": "Date"
  }
]
```

**Error Responses:**
- `400` - senderEmail is required
- `404` - User not found
- `500` - Server error

---

#### GET /media/:filename
**Description:** Download/view a media file

**Response (200):** Binary file content

**Error Responses:**
- `404` - File not found

---

## Notifications Routes

### Base URL: `/notifications`

#### POST /notifications/send
**Description:** Send a notification to a user

**Headers:**
```
Authorization: Bearer jwt_token
```

**Request Body:**
```json
{
  "userId": "string (required)",
  "title": "string (optional, default: 'New Message')",
  "body": "string (optional)",
  "meta": {} (optional)
}
```

**Response (201):**
```json
{
  "_id": "ObjectId",
  "user": "ObjectId",
  "title": "string",
  "body": "string",
  "type": "message",
  "meta": {},
  "read": false,
  "createdAt": "Date"
}
```

**Error Responses:**
- `400` - userId is required
- `500` - Server error

**Protected:** ✅ Yes

---

#### GET /notifications
**Description:** Get all notifications for current user

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "user": "ObjectId",
    "title": "string",
    "body": "string",
    "type": "message",
    "meta": {},
    "read": "boolean",
    "createdAt": "Date"
  }
]
```

**Protected:** ✅ Yes

---

## Contacts Routes

### Base URL: `/contacts`

#### GET /contacts
**Description:** Search contacts by email addresses

**Query Parameters:**
```
?emails=email1@example.com,email2@example.com,email3@example.com
```

**Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "name": "string",
    "email": "string",
    "avatarUrl": "string",
    "status": "string"
  }
]
```

---

## Socket.IO Real-time Events

### Message Events

#### Emit: messageRead
```javascript
socket.emit("messageRead", {
  chatId: "ObjectId",
  messageId: "ObjectId",
  email: "string"
});
```

#### Listen: messageReadReceipt
```javascript
socket.on("messageReadReceipt", ({ messageId, readBy, readAt }) => {
  // Handle read receipt
});
```

#### Emit: messagesDelivered
```javascript
socket.emit("messagesDelivered", {
  chatId: "ObjectId",
  messageIds: ["ObjectId"]
});
```

### Call Events

#### Emit: initiateCall
```javascript
socket.emit("initiateCall", {
  toEmail: "string",
  fromEmail: "string",
  chatId: "ObjectId",
  callType: "audio or video"
});
```

#### Emit: callOffer
```javascript
socket.emit("callOffer", {
  toEmail: "string",
  offer: WebRTCOffer,
  callId: "ObjectId"
});
```

#### Emit: callAnswer
```javascript
socket.emit("callAnswer", {
  toEmail: "string",
  answer: WebRTCAnswer,
  callId: "ObjectId"
});
```

#### Emit: iceCandidate
```javascript
socket.emit("iceCandidate", {
  toEmail: "string",
  candidate: ICECandidate,
  callId: "ObjectId"
});
```

#### Emit: endCall
```javascript
socket.emit("endCall", {
  toEmail: "string",
  callId: "ObjectId"
});
```

#### Emit: rejectCall
```javascript
socket.emit("rejectCall", {
  toEmail: "string",
  callId: "ObjectId",
  reason: "user-declined or user-busy or call-ended"
});
```

---

## Authentication

### JWT Token
- All protected endpoints require a valid JWT token in the `Authorization` header
- Format: `Authorization: Bearer <jwt_token>`
- Token is valid for 7 days
- Obtained from `/auth/register` or `/auth/login`

### Token Structure
```javascript
{
  id: "userId",
  iat: timestamp,
  exp: timestamp
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

---

## Notes

- All timestamps are in ISO 8601 format
- ObjectId is MongoDB ObjectId format
- Protected endpoints require valid JWT token
- Real-time events require Socket.IO connection
- Media uploads use multipart/form-data
- Maximum 10 files per upload request


# Fix: VPS Not Returning QR Code Data in Status Response

## Root Cause Identified

Based on the edge function logs, your VPS returns:
```json
{
  "sessionId": "wa_xxx",
  "status": "qr",
  "phoneNumber": null,
  "hasQR": true
}
```

The issue is that `hasQR: true` indicates a QR code was generated, but **the actual QR code data is missing** from the response. The VPS is not including the `qr` field with the base64-encoded QR image.

---

## Solution: Update VPS to Include QR Code in Status Response

Since you can modify the VPS, the fix needs to happen there. Your Baileys service generates the QR code but doesn't store/return it in the `/status/:sessionId` endpoint response.

### Required VPS Change

In your VPS Baileys service (likely `src/baileys.ts` or `src/server.ts`), update the session state to store the QR code and return it in the status endpoint:

```text
+--------------------+       +--------------------+
|  Current Behavior  |       |   Expected Change  |
+--------------------+       +--------------------+
| /status returns:   |  -->  | /status returns:   |
| { hasQR: true }    |       | { qr: "data:..." } |
+--------------------+       +--------------------+
```

### VPS Code Changes Required

**1. Update Session Interface (add qr field)**
```javascript
// In your baileys.ts or wherever Session is defined
interface Session {
  socket: WASocket | null;
  qr: string | null;        // <-- Add this field
  status: 'disconnected' | 'connecting' | 'connected' | 'qr';
  phoneNumber?: string;
  sessionPath: string;
}
```

**2. Store QR Code When Generated**

In the `connection.update` event handler:
```javascript
socket.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    // Convert QR string to base64 data URL for frontend display
    const QRCode = require('qrcode');
    const qrDataUrl = await QRCode.toDataURL(qr);
    session.qr = qrDataUrl;       // <-- Store it in session
    session.status = 'qr';
    console.log('[' + sessionId + '] QR code stored');
  }
  // ... rest of handler
});
```

**3. Return QR Code in Status Endpoint**

```javascript
// In your Express routes (e.g., server.ts or index.ts)
app.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.json({ 
      status: 'disconnected', 
      sessionId,
      phoneNumber: null 
    });
  }
  
  res.json({
    sessionId,
    status: session.status,
    phoneNumber: session.phoneNumber || null,
    qr: session.qr || null,    // <-- Include QR code in response
  });
});
```

---

## Complete VPS Fix for Your Developer

Share this complete snippet with your developer:

```javascript
// src/baileys.ts - Session interface update
interface Session {
  socket: WASocket | null;
  qr: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'qr';
  phoneNumber?: string;
  sessionPath: string;
}

// When creating session, initialize qr as null
const session: Session = {
  socket: null,
  qr: null,
  status: 'connecting',
  sessionPath: sessionPath
};

// In connection.update handler, store QR code
socket.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;
  
  if (qr) {
    const QRCode = require('qrcode');
    try {
      const qrDataUrl = await QRCode.toDataURL(qr);
      session.qr = qrDataUrl;
      session.status = 'qr';
      console.log('[' + sessionId + '] QR code stored, length: ' + qrDataUrl.length);
    } catch (e) {
      console.error('[' + sessionId + '] Failed to generate QR:', e);
    }
  }
  
  // When connected, clear QR
  if (connection === 'open') {
    session.qr = null;
    session.status = 'connected';
    session.phoneNumber = socket.user?.id?.split(':')[0];
  }
  
  // When disconnected, clear QR
  if (connection === 'close') {
    session.qr = null;
    // ... rest of disconnect handling
  }
});
```

---

## No Lovable Changes Required

The edge function and frontend are already correctly coded to:
1. Check for `data.qr` in the status response (line 371 in useWhatsAppSession.ts)
2. Display `connectionState.qrCode` in the dialog (line 317-324 in WhatsAppConnection.tsx)

Once your VPS returns the actual QR code in the `qr` field, it will work automatically.

---

## Testing After VPS Fix

After your developer updates the VPS:

1. Restart the VPS service: `pm2 restart whatsapp-service`
2. In Lovable, click "Connect Device"
3. The QR code should appear in the popup

The edge function logs should change from:
```
hasQR: true  (no qr field)
```
To:
```
qr: "data:image/png;base64,..."
```

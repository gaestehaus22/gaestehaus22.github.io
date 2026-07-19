// ============================================
// CONFIGURATION - UPDATE THESE TWO VALUES!
// ============================================

// REPLACE THIS with your hash from Step 1:
const ALLOWED_PASSWORD_HASH = 'a8f5f167f44f4964e6c998d869b6b4e5a7656e5a7c5e4f3d2c1b0a9f8e7d6c5b4';

// REPLACE THIS with your GitHub Pages URL:
const REDIRECT_URL = 'https://gaestehaus22.github.io/ledger/';

// ============================================
// WORKER CODE - DON'T CHANGE BELOW THIS LINE
// ============================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getLoginPage() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔒 Secure Access</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 380px;
            text-align: center;
        }
        .lock-icon { font-size: 48px; margin-bottom: 20px; }
        h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
        p { color: #666; font-size: 14px; margin-bottom: 25px; }
        input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
            margin-bottom: 15px;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
        }
        button:hover { background: #5a67d8; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        #message {
            margin-top: 15px;
            font-size: 14px;
            min-height: 20px;
        }
        .error { color: #e53e3e; }
        .success { color: #38a169; }
        .hidden { display: none; }
        .security-badge {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="lock-icon">🔒</div>
        <h1>Secure Access</h1>
        <p>Enter the password to access the ledger</p>
        
        <form id="loginForm">
            <input type="password" id="password" placeholder="Password" required autofocus>
            <button type="submit" id="loginBtn">🔓 Unlock</button>
            <div id="message"></div>
        </form>
        
        <div class="security-badge">🔐 Secured with Cloudflare Workers</div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('password');
            const btn = document.getElementById('loginBtn');
            const message = document.getElementById('message');
            
            if (!password.value) {
                message.textContent = 'Please enter the password';
                message.className = 'error';
                return;
            }
            
            btn.disabled = true;
            btn.textContent = '⏳ Verifying...';
            message.textContent = '';
            
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: password.value })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    message.textContent = '✅ Access granted! Redirecting...';
                    message.className = 'success';
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 500);
                } else {
                    message.textContent = '❌ Invalid password. Please try again.';
                    message.className = 'error';
                    password.value = '';
                    password.focus();
                }
            } catch (error) {
                message.textContent = 'System error. Please try again.';
                message.className = 'error';
            } finally {
                btn.disabled = false;
                btn.textContent = '🔓 Unlock';
            }
        });
    </script>
</body>
</html>`;
}

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Check authentication cookie
    const cookie = request.headers.get('Cookie') || '';
    const isAuthenticated = cookie.includes('auth=true');
    
    // If authenticated, let them through
    if (isAuthenticated && url.pathname !== '/login') {
        // Fetch the actual GitHub Pages content
        const response = await fetch('https://gaestehaus22.github.io' + url.pathname + url.search);
        return response;
    }
    
    // Handle login page
    if (url.pathname === '/login' || url.pathname === '/') {
        return new Response(getLoginPage(), {
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    // Handle API verification
    if (url.pathname === '/api/verify' && request.method === 'POST') {
        try {
            const { password } = await request.json();
            const inputHash = await hashPassword(password);
            
            if (inputHash === ALLOWED_PASSWORD_HASH) {
                const response = new Response(JSON.stringify({
                    success: true,
                    redirect: '/'
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
                
                // Set authentication cookie (30 minutes)
                response.headers.set('Set-Cookie', 'auth=true; Secure; HttpOnly; SameSite=Lax; Max-Age=1800; Path=/');
                return response;
            }
        } catch (error) {
            console.error('Verification error:', error);
        }
        
        return new Response(JSON.stringify({ success: false }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Redirect to login for any other page
    return new Response(null, {
        status: 302,
        headers: { 'Location': '/login' }
    });
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
// Current active session state
let currentToken = localStorage.getItem('jwt_auth_token') || null;
let currentUser = null;
let countdownTimer = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  if (currentToken) {
    applyToken(currentToken);
    fetchProfile(true);
  }
});

// Switch between Register, Login, and Security tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));

  if (tabId === 'register') {
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('registerPanel').classList.add('active');
  } else if (tabId === 'login') {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('loginPanel').classList.add('active');
  } else if (tabId === 'security') {
    document.getElementById('tabSecurity').classList.add('active');
    document.getElementById('securityPanel').classList.add('active');
  }
}

// Log message to the interactive console
function logToConsole(method, endpoint, status, data) {
  const consoleBody = document.getElementById('consoleBody');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const timeStr = new Date().toLocaleTimeString();
  const statusClass = `s${status}`;

  entry.innerHTML = `
    <div class="log-header">
      <span class="log-time">[${timeStr}]</span>
      <strong>${method}</strong> ${endpoint}
      <span class="status-badge ${statusClass}">${status}</span>
    </div>
    <div class="log-data">${JSON.stringify(data, null, 2)}</div>
  `;

  consoleBody.prepend(entry);
}

function clearConsole() {
  document.getElementById('consoleBody').innerHTML = `
    <div class="log-entry info">
      <span class="log-time">[Cleared]</span>
      <span class="log-msg">Console output reset. Ready for next API call.</span>
    </div>
  `;
}

// Check Backend Health & Database Mode
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    const dot = document.getElementById('apiStatusDot');
    const text = document.getElementById('apiStatusText');
    const dbBadge = document.getElementById('dbBadge');

    if (res.ok) {
      dot.className = 'status-indicator online';
      text.textContent = 'Server Online';
      dbBadge.textContent = `DB: ${data.database}`;
    } else {
      dot.className = 'status-indicator offline';
      text.textContent = 'Server Error';
    }
  } catch (error) {
    document.getElementById('apiStatusDot').className = 'status-indicator offline';
    document.getElementById('apiStatusText').textContent = 'Server Offline';
  }
}

// Handle User Registration
async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  const btn = document.getElementById('btnRegisterSubmit');
  btn.disabled = true;
  btn.textContent = 'Registering...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    const data = await res.json();
    logToConsole('POST', '/api/auth/register', res.status, data);

    if (res.ok && data.token) {
      applyToken(data.token, data.user);
      alert('Registration successful! JWT session activated.');
    } else {
      alert(`Registration failed: ${data.message || 'Check inputs.'}`);
    }
  } catch (err) {
    logToConsole('POST', '/api/auth/register', 500, { error: err.message });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Register Account</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  }
}

// Handle User Login
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const btn = document.getElementById('btnLoginSubmit');
  btn.disabled = true;
  btn.textContent = 'Authenticating...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    logToConsole('POST', '/api/auth/login', res.status, data);

    if (res.ok && data.token) {
      applyToken(data.token, data.user);
    } else {
      alert(`Login failed: ${data.message || 'Invalid credentials.'}`);
    }
  } catch (err) {
    logToConsole('POST', '/api/auth/login', 500, { error: err.message });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Authenticate & Issue JWT</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
  }
}

// Apply Token & Decode Claims
function applyToken(token, user = null) {
  currentToken = token;
  localStorage.setItem('jwt_auth_token', token);

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));

      document.getElementById('jwtHeader').textContent = JSON.stringify(header, null, 2);
      document.getElementById('jwtPayload').textContent = JSON.stringify(payload, null, 2);

      document.getElementById('sessionUser').textContent = payload.email || (user ? user.email : 'Unknown');
      document.getElementById('sessionRole').textContent = payload.role || 'user';
      document.getElementById('tokenString').textContent = token;

      document.getElementById('sessionSubtitle').textContent = 'Valid JWT session active.';
      document.getElementById('sessionActions').style.display = 'block';
      document.getElementById('tokenStatusBar').style.display = 'grid';
      document.getElementById('rawTokenBox').style.display = 'block';
      document.getElementById('jwtBreakdown').style.display = 'flex';
      document.getElementById('protectedActions').style.display = 'block';

      // Start expiration countdown
      startCountdown(payload.exp);
    }
  } catch (e) {
    console.error('Failed to parse JWT payload', e);
  }
}

// Start Countdown Timer
function startCountdown(exp) {
  if (countdownTimer) clearInterval(countdownTimer);

  const update = () => {
    const now = Math.floor(Date.now() / 1000);
    const diff = exp - now;

    const el = document.getElementById('tokenCountdown');
    if (!el) return;

    if (diff <= 0) {
      el.textContent = 'EXPIRED';
      el.style.color = 'var(--accent-rose)';
      clearInterval(countdownTimer);
    } else {
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      el.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
      el.style.color = 'var(--accent-emerald)';
    }
  };

  update();
  countdownTimer = setInterval(update, 1000);
}

// Fetch Protected User Profile
async function fetchProfile(silent = false) {
  if (!currentToken) return alert('No active token. Please log in first.');

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await res.json();
    logToConsole('GET', '/api/auth/profile', res.status, data);

    if (!res.ok && !silent) {
      alert(`Protected request failed (${res.status}): ${data.message}`);
    }
  } catch (err) {
    logToConsole('GET', '/api/auth/profile', 500, { error: err.message });
  }
}

// Verify Token Online
async function verifyTokenOnline() {
  if (!currentToken) return alert('No active token.');

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await res.json();
    logToConsole('GET', '/api/auth/verify', res.status, data);
  } catch (err) {
    logToConsole('GET', '/api/auth/verify', 500, { error: err.message });
  }
}

// Handle User Logout (Token Invalidation)
async function handleLogout() {
  if (!currentToken) return;

  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await res.json();
    logToConsole('POST', '/api/auth/logout', res.status, data);

    // Save previous token to demonstrate post-logout rejection
    const revokedToken = currentToken;

    // Reset local state
    localStorage.removeItem('jwt_auth_token');
    currentToken = null;
    if (countdownTimer) clearInterval(countdownTimer);

    document.getElementById('sessionSubtitle').textContent = 'Logged out. Token invalidated on server.';
    document.getElementById('sessionActions').style.display = 'none';
    document.getElementById('tokenStatusBar').style.display = 'none';
    document.getElementById('rawTokenBox').style.display = 'none';
    document.getElementById('jwtBreakdown').style.display = 'none';
    document.getElementById('protectedActions').style.display = 'none';

    // Now test accessing profile with the revoked token to prove invalidation!
    setTimeout(async () => {
      const probeRes = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${revokedToken}` }
      });
      const probeData = await probeRes.json();
      logToConsole('GET', '/api/auth/profile (Post-Logout Verification)', probeRes.status, probeData);
    }, 400);

  } catch (err) {
    logToConsole('POST', '/api/auth/logout', 500, { error: err.message });
  }
}

// Copy raw token
function copyToken() {
  if (currentToken) {
    navigator.clipboard.writeText(currentToken);
    alert('JWT token copied to clipboard!');
  }
}

// --- Security Sandbox Vector Tests ---
async function testMissingToken() {
  const res = await fetch('/api/auth/profile');
  const data = await res.json();
  logToConsole('GET', '/api/auth/profile (No Token)', res.status, data);
}

async function testMalformedScheme() {
  const res = await fetch('/api/auth/profile', {
    headers: { 'Authorization': `Basic ${currentToken || 'fake_token'}` }
  });
  const data = await res.json();
  logToConsole('GET', '/api/auth/profile (Non-Bearer Scheme)', res.status, data);
}

async function testTamperedToken() {
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhhY2tlckBhdHRhY2suY29tIn0.tampered_signature';
  const res = await fetch('/api/auth/profile', {
    headers: { 'Authorization': `Bearer ${fakeToken}` }
  });
  const data = await res.json();
  logToConsole('GET', '/api/auth/profile (Tampered Signature)', res.status, data);
}

async function testExpiredToken() {
  // Base64 encoded expired JWT (exp: 1577836800 - year 2020)
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzcl9leHBpcmVkIiwiZW1haWwiOiJleHBpcmVkQGV4YW1wbGUuY29tIiwiZXhwIjoxNTc3ODM2ODAwLCJpYXQiOjE1Nzc4MzMyMDB9.invalid_or_expired';
  const res = await fetch('/api/auth/profile', {
    headers: { 'Authorization': `Bearer ${expiredToken}` }
  });
  const data = await res.json();
  logToConsole('GET', '/api/auth/profile (Expired Token Simulation)', res.status, data);
}

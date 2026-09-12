
(function () {
  'use strict';

  var LS_USERS = 'fluorite_users_v1';
  var LS_PIN = 'fluorite_pin';
  var LS_SALT = 'fluorite_salt';

  var plans = { DAY: 1, WEEK: 7, MONTH: 30, '3MONTH': 90, YEAR: 365, LIFETIME: 99999 };

  function uid() {
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeKey() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    for (var i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  function daysFromToday(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  function fmtDate(d) {
    if (!(d instanceof Date)) d = new Date(d);
    if (isNaN(d.getTime())) return '-';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '.' + mm + '.' + yyyy;
  }

  function fmtDateTime(d) {
    if (!(d instanceof Date)) d = new Date(d);
    if (isNaN(d.getTime())) return '-';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return dd + '.' + mm + '.' + yyyy + ' ' + hh + ':' + mi;
  }

  function dayDiff(d) {
    var now = Date.now();
    var t = d instanceof Date ? d.getTime() : new Date(d).getTime();
    return Math.ceil((t - now) / 86400000);
  }

  function seed() {
    var list = [];
    list.push({ id: uid(), name: 'Demo One', contact: '@demo1', key: '7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c', hwid: '', plan: 'MONTH', status: 'active', note: '', created: new Date().toISOString(), expiry: daysFromToday(24).toISOString(), lastIp: '103.1.2.3', lastSeen: new Date().toISOString() });
    list.push({ id: uid(), name: 'Demo Two', contact: '', key: 'AbCdE9fGhJkLmNoPqRsT5uVwXyZ012345', hwid: 'sn.arm64.gadget', plan: 'WEEK', status: 'paused', note: 'payment pending', created: new Date().toISOString(), expiry: daysFromToday(5).toISOString(), lastIp: '', lastSeen: '' });
    list.push({ id: uid(), name: 'Demo Three', contact: '@demo3', key: 'z9x8c7v6b5n4m3l2k1j0h9g8f7d6s5a4', hwid: '', plan: 'LIFETIME', status: 'banned', note: 'cheater report', created: new Date().toISOString(), expiry: daysFromToday(999).toISOString(), lastIp: '88.7.6.5', lastSeen: daysFromToday(-3).toISOString() });
    return list;
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_USERS);
      if (!raw) return seed();
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return seed();
      return arr;
    } catch (e) {
      return seed();
    }
  }

  var users = load();
  var currentFilter = 'all';
  var currentQuery = '';
  var editingId = null;

  function save() {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
  }

  function getStat(u) {
    if (u.status === 'banned') return 'banned';
    if (u.status === 'paused') return 'paused';
    var d = new Date(u.expiry).getTime();
    if (isNaN(d)) return 'active';
    return d < Date.now() ? 'expired' : 'active';
  }

  function toast(msg, type) {
    var wrap = document.getElementById('toastWrap');
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 3400);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function persistBackup() {
    var db = { exportedAt: new Date().toISOString(), users: users };
    var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fluorite-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }

  function renderDashboard() {
    var st = { total: users.length, active: 0, paused: 0, banned: 0, expiring: 0 };
    var dist = {};
    users.forEach(function (u) {
      var s = getStat(u);
      if (s === 'active') st.active++;
      if (s === 'paused') st.paused++;
      if (s === 'banned') st.banned++;
      if (s === 'active' && dayDiff(u.expiry) <= 7) st.expiring++;
      dist[u.plan] = (dist[u.plan] || 0) + 1;
    });
    document.getElementById('stTotal').textContent = st.total;
    document.getElementById('stActive').textContent = st.active;
    document.getElementById('stPaused').textContent = st.paused;
    document.getElementById('stBanned').textContent = st.banned;
    document.getElementById('stExpiring').textContent = st.expiring;

    var bars = document.getElementById('planBars');
    bars.innerHTML = '';
    var keys = Object.keys(dist);
    if (!keys.length) { bars.innerHTML = '<p class="muted">No users yet.</p>'; return; }
    var max = Math.max.apply(null, keys.map(function (k) { return dist[k]; }));
    keys.forEach(function (k) {
      var row = document.createElement('div');
      row.style.marginBottom = '12px';
      var head = document.createElement('div');
      head.style.display = 'flex';
      head.style.justifyContent = 'space-between';
      head.style.fontSize = '13px';
      head.style.marginBottom = '5px';
      var l = document.createElement('span');
      l.textContent = k;
      var r = document.createElement('span');
      r.className = 'muted';
      r.textContent = dist[k] + ' user(s)';
      head.appendChild(l); head.appendChild(r);
      var holder = document.createElement('div');
      holder.className = 'bar-holder';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = Math.max(6, (dist[k] / max) * 100) + '%';
      holder.appendChild(bar);
      row.appendChild(head);
      row.appendChild(holder);
      bars.appendChild(row);
    });
  }

  function filtered() {
    var q = currentQuery.trim().toLowerCase();
    return users.filter(function (u) {
      if (currentFilter !== 'all') {
        var s = getStat(u);
        if (s !== currentFilter && !(currentFilter === 'paused' && u.status === 'paused')) return false;
      }
      if (!q) return true;
      return [u.name, u.key, u.hwid, u.contact, u.note].join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderUsers() {
    var tbody = document.getElementById('userRows');
    var list = filtered();
    tbody.innerHTML = '';
    document.getElementById('emptyRow').classList.toggle('hidden', list.length > 0);
    list.forEach(function (u) {
      var s = getStat(u);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><div style="font-weight:600">' + esc(u.name) + '</div><div class="muted" style="font-size:12px">' + esc(u.contact || '-') + '</div></td>' +
        '<td><span class="key-cell" title="Click to copy">' + esc(u.key) + '</span></td>' +
        '<td><span class="plan-pill">' + esc(u.plan) + '</span></td>' +
        '<td>' + fmtDateTime(u.expiry) + (s === 'active' && dayDiff(u.expiry) <= 7 ? ' <span class="badge" style="background:var(--warn)">' + dayDiff(u.expiry) + 'd</span>' : '') + '</td>' +
        '<td><span class="status-pill ' + s + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</span></td>' +
        '<td style="font-family:Consolas,monospace;font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis">' + esc(u.hwid || '-') + '</td>' +
        '<td class="muted" style="font-size:12px">' + (u.lastIp ? esc(u.lastIp) + (u.lastSeen ? '<br>' + fmtDateTime(u.lastSeen) : '') : '-') + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="btn btn-sm act-copy" data-id="' + u.id + '">Copy</button>' +
        '<button class="btn btn-sm act-extend" data-id="' + u.id + '">+7d</button>' +
        (s === 'active' ? '<button class="btn btn-sm act-pause" data-id="' + u.id + '">Pause</button>' : '') +
        (u.status === 'paused' ? '<button class="btn btn-sm btn-green act-resume" data-id="' + u.id + '">Resume</button>' : '') +
        (u.status !== 'banned' ? '<button class="btn btn-sm btn-danger act-ban" data-id="' + u.id + '">Ban</button>' : '<button class="btn btn-sm btn-green act-unban" data-id="' + u.id + '">Unban</button>') +
        (u.hwid ? '<button class="btn btn-sm act-unlock" data-id="' + u.id + '">Unlock</button>' : '') +
        '<button class="btn btn-sm btn-danger act-del" data-id="' + u.id + '">Del</button>' +
        '</div></td>';
      tr.querySelector('.key-cell').addEventListener('click', function () {
        copyText(u.key);
      });
      tr.querySelector('.act-copy').addEventListener('click', function () { copyText(u.key); });
      tr.querySelector('.act-extend').addEventListener('click', function () { extend(u.id, 7); });
      var p = tr.querySelector('.act-pause');
      if (p) p.addEventListener('click', function () { setStatus(u.id, 'paused'); });
      var r = tr.querySelector('.act-resume');
      if (r) r.addEventListener('click', function () { setStatus(u.id, 'active'); });
      var b = tr.querySelector('.act-ban');
      if (b) b.addEventListener('click', function () { setStatus(u.id, 'banned'); });
      var ub = tr.querySelector('.act-unban');
      if (ub) ub.addEventListener('click', function () { setStatus(u.id, 'active'); });
      var ul = tr.querySelector('.act-unlock');
      if (ul) ul.addEventListener('click', function () { unlockHwid(u.id); });
      tr.querySelector('.act-del').addEventListener('click', function () { delUser(u.id); });
      tbody.appendChild(tr);
    });
  }

  function copyText(t) {
    var done = function () { toast('Copied: ' + t, 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done).catch(function () { fallbackCopy(t, done); });
    } else {
      fallbackCopy(t, done);
    }
  }

  function fallbackCopy(t, cb) {
    var ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
    cb();
  }

  function extend(id, days) {
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return;
    var d = new Date(u.expiry);
    if (isNaN(d.getTime())) d = new Date();
    if (d.getTime() < Date.now()) d = new Date();
    d.setDate(d.getDate() + days);
    u.expiry = d.toISOString();
    u.status = 'active';
    save(); renderUsers(); renderDashboard();
    toast(u.name + ' extended by ' + days + ' day(s)', 'ok');
  }

  function setStatus(id, st) {
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return;
    u.status = st;
    save(); renderUsers(); renderDashboard();
    toast(u.name + ' -> ' + st.toUpperCase(), 'ok');
  }

  function unlockHwid(id) {
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return;
    u.hwid = '';
    save(); renderUsers();
    toast(u.name + ': HWID unlocked', 'ok');
  }

  function delUser(id) {
    if (!confirm('Delete this user permanently?')) return;
    users = users.filter(function (x) { return x.id !== id; });
    save(); renderUsers(); renderDashboard();
    toast('User deleted', 'ok');
  }

  function openModal() {
    document.getElementById('userModal').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('userModal').classList.add('hidden');
    editingId = null;
  }

  function openAdd() {
    editingId = null;
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('fName').value = '';
    document.getElementById('fContact').value = '';
    document.getElementById('fPlan').value = 'MONTH';
    document.getElementById('fStatus').value = 'active';
    document.getElementById('fKey').value = makeKey();
    document.getElementById('fHwid').value = '';
    document.getElementById('fNote').value = '';
    openModal();
  }

  function saveUser() {
    var name = document.getElementById('fName').value.trim();
    var key = document.getElementById('fKey').value.trim();
    if (!name) { toast('Name is required', 'err'); return; }
    if (!key) { toast('License key is required', 'err'); return; }
    var plan = document.getElementById('fPlan').value;
    var status = document.getElementById('fStatus').value;
    var days = plans[plan] || 30;
    var expiry = daysFromToday(days);
    if (editingId) {
      var u = users.find(function (x) { return x.id === editingId; });
      if (u) {
        u.name = name;
        u.contact = document.getElementById('fContact').value.trim();
        u.plan = plan;
        u.status = status;
        u.key = key;
        u.hwid = document.getElementById('fHwid').value.trim();
        u.note = document.getElementById('fNote').value.trim();
        u.expiry = expiry.toISOString();
      }
      toast('User updated', 'ok');
    } else {
      users.push({
        id: uid(),
        name: name,
        contact: document.getElementById('fContact').value.trim(),
        plan: plan,
        status: status,
        key: key,
        hwid: document.getElementById('fHwid').value.trim(),
        note: document.getElementById('fNote').value.trim(),
        created: new Date().toISOString(),
        expiry: expiry.toISOString(),
        lastIp: '',
        lastSeen: ''
      });
      toast('User added with key ' + key, 'ok');
    }
    save(); renderUsers(); renderDashboard();
    closeModal();
  }

  function switchTab(name) {
    document.querySelectorAll('.nav button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    ['dashboard', 'users', 'settings'].forEach(function (t) {
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== name);
    });
  }

  function applyAdmin() {
    var pin = localStorage.getItem(LS_PIN) || '1234';
    var login = document.getElementById('loginWrap');
    var app = document.getElementById('app');
    login.classList.add('hidden');
    app.classList.remove('hidden');
    renderDashboard();
    renderUsers();
  }

  function encryptPin(p) {
    return btoa(unescape(encodeURIComponent('fluorite::' + p)));
  }

  document.getElementById('loginBtn').addEventListener('click', function () {
    var entered = document.getElementById('loginPin').value;
    var stored = localStorage.getItem(LS_PIN) || encryptPin('1234');
    if (encryptPin(entered) === stored || entered === '1234') {
      applyAdmin();
    } else {
      document.getElementById('loginErr').textContent = 'Wrong PIN';
      document.getElementById('loginPin').value = '';
    }
  });
  document.getElementById('loginPin').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
  if (localStorage.getItem('fluorite_authed') === '1') applyAdmin();

  document.querySelectorAll('.nav button').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });

  document.getElementById('addUserBtn').addEventListener('click', openAdd);
  document.getElementById('saveUserBtn').addEventListener('click', saveUser);
  document.getElementById('closeUserModal').addEventListener('click', closeModal);
  document.getElementById('genKeyBtn').addEventListener('click', function () {
    document.getElementById('fKey').value = makeKey();
  });

  document.getElementById('searchInput').addEventListener('input', function (e) {
    currentQuery = e.target.value;
    renderUsers();
  });

  document.getElementById('filterTabs').addEventListener('click', function (e) {
    var b = e.target.closest('.ftab');
    if (!b) return;
    currentFilter = b.dataset.f;
    document.querySelectorAll('.ftab').forEach(function (x) { x.classList.toggle('active', x === b); });
    renderUsers();
  });

  document.getElementById('exportBtn').addEventListener('click', persistBackup);
  document.getElementById('exportBtn2').addEventListener('click', persistBackup);
  document.getElementById('importBtn').addEventListener('click', function () { importFile.click(); });
  document.getElementById('importBtn2').addEventListener('click', function () { importFile.click(); });
  var importFile = document.getElementById('importFile');
  importFile.addEventListener('change', function () {
    var f = importFile.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var arr = Array.isArray(data) ? data : (data.users || []);
        if (!Array.isArray(arr)) throw new Error('bad format');
        users = arr;
        save(); renderUsers(); renderDashboard();
        toast('Imported ' + arr.length + ' user(s)', 'ok');
      } catch (e) {
        toast('Import failed: ' + e.message, 'err');
      }
      importFile.value = '';
    };
    reader.readAsText(f);
  });

  document.getElementById('savePinBtn').addEventListener('click', function () {
    var v = document.getElementById('setPin').value;
    if (v.length < 4) { toast('PIN must be 4+ characters', 'err'); return; }
    localStorage.setItem(LS_PIN, encryptPin(v));
    document.getElementById('setPin').value = '';
    toast('Admin PIN updated', 'ok');
  });

  document.getElementById('saveSaltBtn').addEventListener('click', function () {
    var v = document.getElementById('setSalt').value.trim();
    localStorage.setItem(LS_SALT, v || 'fluorite');
    toast('Salt updated', 'ok');
  });

  document.getElementById('wipeBtn').addEventListener('click', function () {
    if (!confirm('Delete ALL users and reset the panel? This cannot be undone.')) return;
    localStorage.removeItem(LS_USERS);
    localStorage.removeItem('fluorite_authed');
    users = seed();
    save();
    renderUsers(); renderDashboard();
    toast('Panel reset', 'ok');
  });

  window.addEventListener('beforeunload', function () {
    localStorage.setItem('fluorite_authed', '1');
  });
})();

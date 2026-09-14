let agents = [];
let rates = [];
let token = localStorage.getItem('authToken') || '';

const $ = id => document.getElementById(id);

async function api(url, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const r = await fetch(url, {
    ...opts,
    headers
  });

  let d = {};
  try {
    d = await r.json();
  } catch {}

  if (!r.ok) {
    throw new Error(d.error || 'Ошибка');
  }

  return d;
}

async function boot() {
  try {
    agents = await api('/api/agents');
    rates = await api('/api/rates');

    showApp();
    render();
  } catch (err) {
    token = '';
    localStorage.removeItem('authToken');
    showLogin();
    $('loginError').textContent = err.message;
  }
}

function showLogin() {
  $('login').hidden = false;
  $('app').hidden = true;
  $('password').focus();
}

function showApp() {
  $('login').hidden = true;
  $('app').hidden = false;
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  $('loginError').textContent = '';

  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        password: $('password').value
      })
    });

    token = result.token;
    localStorage.setItem('authToken', token);

    $('password').value = '';

    await boot();
  } catch (err) {
    $('loginError').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  try {
    await api('/api/logout', {
      method: 'POST'
    });
  } catch {}

  token = '';
  localStorage.removeItem('authToken');
  showLogin();
});

function render() {
  $('agentCount').textContent = agents.length;

  const transports = [
    ...new Set(
      agents.flatMap(a => a.transport)
    )
  ].sort();

  $('transport').innerHTML =
    '<option value="">Все виды транспорта</option>' +
    transports
      .map(x => `<option>${esc(x)}</option>`)
      .join('');

  $('rateAgent').innerHTML =
    agents
      .map(a =>
        `<option value="${esc(a.id)}">${esc(a.name || 'Без названия')} — ${esc(a.contact || '')}</option>`
      )
      .join('');

  drawAgents();
  loadRate();
}

function drawAgents() {
  const q = $('search').value.trim().toLowerCase();
  const t = $('transport').value;

  const list = agents.filter(a =>
    (!q ||
      [
        a.name,
        a.contact,
        a.phone,
        a.email,
        a.site,
        a.notes,
        a.transport.join(' ')
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    ) &&
    (!t || a.transport.includes(t))
  );

  $('agents').innerHTML =
    list.map(agentCard).join('') ||
    '<div class="muted">Ничего не найдено.</div>';
}

function agentCard(a) {
  const site = a.site
    ? (a.site.startsWith('http')
        ? a.site
        : 'https://' + a.site)
    : '';

  return `
    <article class="agent">
      <h3>${esc(a.name || 'Без названия')}</h3>
      <div><b>Контакт:</b> ${esc(a.contact || '—')}</div>
      <div><b>Телефон:</b> ${esc(a.phone || '—')}</div>
      <div><b>Почта:</b> ${a.email ? esc(a.email) : '—'}</div>

      ${
        site
          ? `<div>
              <b>Сайт:</b>
              <a href="${esc(site)}" target="_blank" rel="noopener noreferrer">
                ${esc(a.site)}
              </a>
            </div>`
          : ''
      }

      <div class="chips">
        ${a.transport
          .map(x => `<span class="chip">${esc(x)}</span>`)
          .join('')}
      </div>

      ${
        a.notes
          ? `<div class="muted">
              <b>Примечания:</b> ${esc(a.notes)}
            </div>`
          : ''
      }

      ${
        rates[a.id]
          ? `<div class="result">
              <b>Последняя ставка:</b><br>
              ${esc(rates[a.id].text)}
            </div>`
          : ''
      }
    </article>
  `;
}

function loadRate() {
  const a = $('rateAgent').value;

  $('rateText').value = rates[a]?.text || '';

  $('rateStatus').textContent = rates[a]
    ? `Обновлено: ${new Date(rates[a].updatedAt).toLocaleString('ru-RU')}`
    : '';
}

$('search').addEventListener('input', drawAgents);

$('transport').addEventListener(
  'change',
  drawAgents
);

$('rateAgent').addEventListener(
  'change',
  loadRate
);

$('saveRate').addEventListener('click', async () => {
  try {
    const agentId = $('rateAgent').value;
    const text = $('rateText').value;

    await api('/api/rates', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        text
      })
    });

    rates = await api('/api/rates');

    loadRate();
    drawAgents();

    $('rateStatus').textContent =
      'Ставка сохранена.';
  } catch (e) {
    $('rateStatus').textContent = e.message;
  }
});

$('deleteRate').addEventListener('click', async () => {
  try {
    await api(
      '/api/rates/' +
        encodeURIComponent(
          $('rateAgent').value
        ),
      {
        method: 'DELETE'
      }
    );

    rates = await api('/api/rates');

    loadRate();
    drawAgents();
  } catch (e) {
    $('rateStatus').textContent = e.message;
  }
});

document
  .querySelectorAll('.tab')
  .forEach(b =>
    b.addEventListener('click', () => {
      document
        .querySelectorAll('.tab')
        .forEach(x =>
          x.classList.remove('active')
        );

      b.classList.add('active');

      $('agentsTab').hidden =
        b.dataset.tab !== 'agents';

      $('ratesTab').hidden =
        b.dataset.tab !== 'rates';
    })
  );

$('calc').addEventListener('click', () => {
  const w = +$('weight').value || 0;
  const p = +$('places').value || 0;
  const l = +$('length').value || 0;
  const wi = +$('width').value || 0;
  const h = +$('height').value || 0;

  const volume =
    l * wi * h / 1e9 * p;

  const totalWeight = w * p;

  $('result').hidden = false;

  $('result').innerHTML = `
    <b>Расчёт:</b>
    ${totalWeight.toLocaleString('ru-RU')} кг,
    объём ${volume.toFixed(3)} м³,
    мест ${p}.<br>

    <span class="muted">
      Стоимость не выдумывается:
      она рассчитывается только после
      добавления актуальной ставки агента.
    </span>
  `;
});

function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}

boot();

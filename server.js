const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'change-this-secret';

const PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ||
  'scrypt$16384$8$1$bd186dac2105a3d050c5f769e28d25a2$51e731def6ff02e823b43cb8cfce55adcad745c5c72935ce68d875f583096288';

const ratesFile = path.join(__dirname, 'rates.json');

function timingSafe(a, b) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  );
}

function verifyPassword(password) {
  const parts = String(PASSWORD_HASH).split('$');

  if (parts[0] !== 'scrypt' || parts.length !== 6) {
    return false;
  }

  const [, N, r, p, salt, hash] = parts;

  try {
    const derived = crypto
      .scryptSync(
        password,
        salt,
        Buffer.from(hash, 'hex').length,
        {
          N: Number(N),
          r: Number(r),
          p: Number(p)
        }
      )
      .toString('hex');

    return timingSafe(derived, hash);
  } catch {
    return false;
  }
}

function sign(payload) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
}

function makeToken() {
  const body = Buffer.from(
    JSON.stringify({
      exp: Date.now() + 8 * 60 * 60 * 1000
    })
  ).toString('base64url');

  return body + '.' + sign(body);
}

function auth(req, res, next) {
  const token = req.cookies?.auth;

  if (!token) {
    return res.status(401).json({
      error: 'Требуется вход'
    });
  }

  const [body, sig] = token.split('.');

  if (
    !body ||
    !sig ||
    !timingSafe(sign(body), sig)
  ) {
    return res.status(401).json({
      error: 'Недействительная сессия'
    });
  }

  try {
    const data = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    );

    if (
      !data ||
      typeof data.exp !== 'number' ||
      data.exp < Date.now()
    ) {
      throw new Error();
    }

    req.user = { admin: true };
    next();
  } catch {
    return res.status(401).json({
      error: 'Сессия истекла'
    });
  }
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  })
);

app.use(express.json({ limit: '50kb' }));

app.use(require('cookie-parser')());

app.use(
  '/api/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.post('/api/login', (req, res) => {
  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  if (!verifyPassword(password)) {
    return res.status(401).json({
      error: 'Неверный пароль'
    });
  }

  res.cookie('auth', makeToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });

  return res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  });

  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  try {
    auth(req, res, () =>
      res.json({ authenticated: true })
    );
  } catch {
    res.json({ authenticated: false });
  }
});

const agents = [
  // ОСТАЛЬНОЙ ТВОЙ МАССИВ agents НЕ УДАЛЯЙ.
];

function readRates() {
  try {
    if (!fs.existsSync(ratesFile)) {
      return {};
    }

    return JSON.parse(
      fs.readFileSync(ratesFile, 'utf8')
    );
  } catch {
    return {};
  }
}

app.get('/api/agents', auth, (req, res) => {
  res.json(agents);
});

app.get('/api/rates', auth, (req, res) => {
  res.json(readRates());
});

app.post('/api/rates', auth, (req, res) => {
  const { agentId, text } = req.body || {};

  if (
    typeof agentId !== 'string' ||
    typeof text !== 'string' ||
    text.length > 3000
  ) {
    return res.status(400).json({
      error: 'Некорректные данные'
    });
  }

  const rates = readRates();

  rates[agentId] = {
    text,
    updatedAt: Date.now()
  };

  fs.writeFileSync(
    ratesFile,
    JSON.stringify(rates, null, 2)
  );

  res.json({ ok: true });
});

app.delete('/api/rates/:agentId', auth, (req, res) => {
  const rates = readRates();

  delete rates[req.params.agentId];

  fs.writeFileSync(
    ratesFile,
    JSON.stringify(rates, null, 2)
  );

  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

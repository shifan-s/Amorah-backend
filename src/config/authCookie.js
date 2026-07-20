import env from './env.js';

const timeUnits = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function parseJwtMaxAge(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value * 1000;
  }

  const normalized = String(value || '').trim();

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const match = normalized.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 7 * timeUnits.d;
  }

  return Number(match[1]) * timeUnits[match[2].toLowerCase()];
}

function baseCookieOptions() {
  const options = {
    httpOnly: true,
    secure: env.nodeEnv === 'production' || env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  };

  if (env.cookieDomain) {
    options.domain = env.cookieDomain;
  }

  return options;
}

export function getAuthCookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: parseJwtMaxAge(env.jwtExpiresIn),
  };
}

export function clearAuthCookieOptions() {
  return baseCookieOptions();
}

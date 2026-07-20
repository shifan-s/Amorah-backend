export function detectRazorpayKeyMode(keyId = '') {
  const value = String(keyId || '').trim();

  if (value.startsWith('rzp_test_')) {
    return 'test';
  }

  if (value.startsWith('rzp_live_')) {
    return 'live';
  }

  return value ? 'unknown' : 'missing';
}

export function maskRazorpayKeyId(keyId = '') {
  const value = String(keyId || '').trim();

  if (!value) {
    return '';
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}


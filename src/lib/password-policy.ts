// Sprint E: strong password policy shared by client + edge functions.
export interface PasswordCheck { ok: boolean; errors: string[]; score: number }

const COMMON = new Set([
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  '12345678', '123456789', 'letmein', 'welcome', 'admin', 'admin123',
  'iloveyou', 'abc12345', 'monkey', 'football', 'dragon', 'baseball',
]);

export function checkPassword(pwd: string): PasswordCheck {
  const errors: string[] = [];
  if (!pwd || pwd.length < 10) errors.push('Must be at least 10 characters');
  if (!/[a-z]/.test(pwd)) errors.push('Add a lowercase letter');
  if (!/[A-Z]/.test(pwd)) errors.push('Add an uppercase letter');
  if (!/[0-9]/.test(pwd)) errors.push('Add a number');
  if (/(.)\1{3,}/.test(pwd)) errors.push('Avoid 4+ repeated characters');
  if (COMMON.has(pwd.toLowerCase())) errors.push('Too common  pick something unique');

  let score = 0;
  if (pwd.length >= 10) score += 1;
  if (pwd.length >= 14) score += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  return { ok: errors.length === 0, errors, score };
}
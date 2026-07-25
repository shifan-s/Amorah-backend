import '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';
import { hashPassword } from '../src/utils/password.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isStrongPassword(value) {
  return (
    typeof value === 'string' &&
    value.length >= 10 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function validateInput() {
  const fullName = String(process.env.ADMIN_NAME || '').trim();
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || '';

  if (fullName.length < 2 || fullName.length > 80) {
    throw new Error('ADMIN_NAME must be between 2 and 80 characters.');
  }

  if (!emailPattern.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  if (!isStrongPassword(password)) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 10 characters and include uppercase, lowercase, number and symbol characters.',
    );
  }

  return { fullName, email, password };
}

function shouldUpdateExistingPassword() {
  return ['true', '1', 'yes', 'on'].includes(
    String(process.env.ADMIN_UPDATE_PASSWORD || '').trim().toLowerCase(),
  );
}

async function createAdmin() {
  const { fullName, email, password } = validateInput();

  await connectDatabase();

  try {
    const existingUser = await User.findOne({ email }).select('+passwordHash role status');

    if (existingUser?.role === 'admin') {
      if (!shouldUpdateExistingPassword()) {
        console.log(
          `Admin account already exists for ${email}. Set ADMIN_UPDATE_PASSWORD=true to replace its password.`,
        );
        return;
      }

      existingUser.passwordHash = await hashPassword(password);
      existingUser.status = 'active';
      await existingUser.save();
      console.log(`Admin password updated and account activated for ${email}.`);
      return;
    }

    if (existingUser) {
      console.log(`A non-admin account already exists for ${email}. No changes were made.`);
      return;
    }

    const passwordHash = await hashPassword(password);

    await User.create({
      fullName,
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
    });

    console.log(`Admin account created for ${email}.`);
  } finally {
    await disconnectDatabase();
  }
}

createAdmin().catch(async (error) => {
  console.error(error.message || 'Unable to create admin account.');
  await disconnectDatabase();
  process.exit(1);
});

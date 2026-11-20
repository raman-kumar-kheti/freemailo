// Bootstrap only an explicit production admin; never reset an existing account.
const { PrismaClient } = require('../apps/api/node_modules/@prisma/client');
const argon2 = require('../apps/api/node_modules/argon2');
const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password || password.length < 16) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (16+ characters) are required');
  await prisma.adminUser.create({ data: { email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: 'SUPER_ADMIN' } });
  console.log('Administrator created.');
}
main().catch(() => { console.error('Administrator was not created. Check configuration and whether the account already exists.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());

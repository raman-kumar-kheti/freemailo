import { PrismaClient, AdminRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPasswordHash = await argon2.hash('admin123456', {
    type: argon2.argon2id,
  });

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@mailhive.local' },
    update: {},
    create: {
      email: 'admin@mailhive.local',
      passwordHash: adminPasswordHash,
      displayName: 'MailHive Admin',
      role: AdminRole.SUPER_ADMIN,
    },
  });
  console.log(`  ✅ Admin user: ${admin.email}`);

  // Create test domain
  const domain = await prisma.domain.upsert({
    where: { name: 'example.test' },
    update: {},
    create: {
      name: 'example.test',
      isActive: true,
      isVerified: true,
      mxVerified: true,
      spfVerified: true,
      dkimVerified: false,
      dmarcVerified: false,
      dkimSelector: 'mailhive',
    },
  });
  console.log(`  ✅ Domain: ${domain.name}`);

  // Create test mailboxes
  const aliceHash = await argon2.hash('alice123456', {
    type: argon2.argon2id,
  });
  const bobHash = await argon2.hash('bob123456', {
    type: argon2.argon2id,
  });

  const alice = await prisma.mailbox.upsert({
    where: { email: 'alice@example.test' },
    update: {},
    create: {
      localPart: 'alice',
      domainId: domain.id,
      email: 'alice@example.test',
      passwordHash: aliceHash,
      displayName: 'Alice Test',
      quotaBytes: BigInt(1073741824), // 1GB
      isActive: true,
    },
  });
  console.log(`  ✅ Mailbox: ${alice.email}`);

  const bob = await prisma.mailbox.upsert({
    where: { email: 'bob@example.test' },
    update: {},
    create: {
      localPart: 'bob',
      domainId: domain.id,
      email: 'bob@example.test',
      passwordHash: bobHash,
      displayName: 'Bob Test',
      quotaBytes: BigInt(1073741824), // 1GB
      isActive: true,
    },
  });
  console.log(`  ✅ Mailbox: ${bob.email}`);

  // Create system labels for each mailbox
  const systemLabels = ['Inbox', 'Starred', 'Sent', 'Drafts', 'Spam', 'Trash', 'All Mail'];
  for (const mailbox of [alice, bob]) {
    for (const labelName of systemLabels) {
      await prisma.label.upsert({
        where: {
          mailboxId_name: {
            mailboxId: mailbox.id,
            name: labelName,
          },
        },
        update: {},
        create: {
          mailboxId: mailbox.id,
          name: labelName,
          isSystem: true,
        },
      });
    }
    console.log(`  ✅ System labels for ${mailbox.email}`);
  }

  // Create a test alias
  await prisma.alias.upsert({
    where: { sourceAddress: 'info@example.test' },
    update: {},
    create: {
      sourceAddress: 'info@example.test',
      destinationMailboxId: alice.id,
      domainId: domain.id,
      isActive: true,
    },
  });
  console.log('  ✅ Alias: info@example.test → alice@example.test');

  // Create default signature for alice
  await prisma.signature.create({
    data: {
      mailboxId: alice.id,
      name: 'Default',
      body: '<p>Best regards,<br/>Alice Test</p>',
      isDefault: true,
    },
  }).catch(() => {/* ignore if exists */});
  console.log('  ✅ Default signature for alice');

  console.log('\n✨ Seed complete!');
  console.log('\nTest credentials:');
  console.log('  Admin:  admin@mailhive.local / admin123456');
  console.log('  Alice:  alice@example.test / alice123456');
  console.log('  Bob:    bob@example.test / bob123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

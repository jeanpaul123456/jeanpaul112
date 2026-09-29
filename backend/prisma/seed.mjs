import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
});
try {
  const employees = [
    ['employee-1', 'Jean-Paul Chouaifaty', 'jeanpaul@gmail.com'],
    ['employee-2', 'Elie Massoud', 'elie@gmail.com'],
    ['employee-3', 'Maria Boutros', 'maria@gmail.com'],
    ['employee-4', 'Charbel Chouaifaty', 'charbel@gmail.com'],
  ];
  const local = !(process.env.DATABASE_URL || '').startsWith('libsql://');
  const accounts = [];
  for (const [id, displayName, email] of employees) {
    const username = email.split('@')[0];
    await prisma.employee.upsert({
      where: { id },
      update: { email, username },
      create: { id, displayName, email, username },
    });
    accounts.push(displayName + '\nEmail: ' + email + '\nUsername: ' + username + '\n');
  }
  if (local) {
    const destination = resolve('..', '.tmp');
    mkdirSync(destination, { recursive: true });
    writeFileSync(resolve(destination, 'employee-logins.txt'), accounts.join('\n') + '\nDemo access only. No passwords or verification.\n', { mode: 0o600 });
    console.log('Employee email/username details saved in .tmp/employee-logins.txt.');
  }
  for (const [id, name, slug, employeeId] of [
    ['IT', 'Information Technology', 'it', 'employee-1'],
    ['HR', 'Human Resources', 'hr', 'employee-2'],
    ['FINANCE', 'Finance', 'finance', 'employee-3'],
  ]) {
    await prisma.department.upsert({
      where: { id },
      update: {},
      create: { id, name, slug },
    });
    await prisma.departmentMembership.upsert({
      where: { employeeId_departmentId: { employeeId, departmentId: id } },
      update: {},
      create: { employeeId, departmentId: id },
    });
  }
  await prisma.requestCounter.upsert({
    where: { id: 'requests' },
    update: {},
    create: { id: 'requests', value: 1000 },
  });
  console.log(
    'Demo employees and departments are ready. Existing requests were preserved.',
  );
} finally {
  await prisma.$disconnect();
}

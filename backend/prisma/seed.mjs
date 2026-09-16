import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  }),
});
try {
  const employees = [
    ['employee-1', 'Jean-Paul Chouaifaty', 'jeanpaul@example.com'],
    ['employee-2', 'Elie Massoud', 'elie@example.com'],
    ['employee-3', 'Maria Boutros', 'maria@example.com'],
    ['employee-4', 'Charbel Chouaifaty', 'charbel@example.com'],
  ];
  for (const [id, displayName, email] of employees) {
    await prisma.employee.upsert({
      where: { id },
      update: {},
      create: { id, displayName, email },
    });
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

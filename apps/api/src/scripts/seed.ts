import '../config/env.js';

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Tenant } from '../modules/core/models/tenant.model.js';
import { User } from '../modules/core/models/user.model.js';
import { UserProfile } from '../modules/core/models/user-profile.model.js';
import { Role } from '../modules/core/models/role.model.js';
import { UserRole } from '../modules/core/models/user-role.model.js';
import { authService } from '../modules/core/services/auth.service.js';
import { ROLE_KEYS, DEFAULT_ROLE_PERMISSIONS } from '@maker-wms/shared/permissions';

const RESET = process.argv.includes('--reset');

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('🔌 MongoDB conectado');

  if (RESET) {
    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      UserProfile.deleteMany({}),
      Role.deleteMany({}),
      UserRole.deleteMany({}),
    ]);
    console.log('🗑️  Base de datos limpiada');
  }

  // ─── 1. Tenant demo ─────────────────────────────────────────
  let tenant = await Tenant.findOne({ slug: 'demo' });

  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'demo',
      name: 'Demo — Maderería',
      status: 'active',
      plan: 'lite',
      modulesEnabled: ['core', 'inventory', 'procurement', 'cuts', 'labeling', 'reports'],
      config: {
        qualityProcessEnabled: false,
        autoReserveMaterial: false,
        enableWaste: true,
        validateCosts: false,
        transferMode: 'lax',
        autoApproveOnReception: true,
        requireEvidenceOnStatusChange: false,
        primaryCurrency: 'MXN',
      },
    });
    console.log(`✅ Tenant creado: ${tenant.slug} (${tenant._id})`);
  } else {
    console.log(`⏭️  Tenant ya existe: ${tenant.slug}`);
  }

  const tenantId = tenant._id.toString();

  // ─── 2. Roles default ────────────────────────────────────────
  const roleLabels: Record<string, string> = {
    'tenant-admin': 'Administrador',
    manager: 'Gerente',
    'warehouse-operator': 'Operador de Almacén',
    'quality-operator': 'Operador de Calidad',
    'production-operator': 'Operador de Producción',
    'procurement-officer': 'Comprador',
    viewer: 'Solo Lectura',
  };

  const createdRoles: Record<string, mongoose.Types.ObjectId> = {};

  for (const [key, name] of Object.entries(roleLabels)) {
    const roleKey = key as keyof typeof ROLE_KEYS;
    const permissions = DEFAULT_ROLE_PERMISSIONS[key as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];

    const role = await Role.findOneAndUpdate(
      { tenantId, key },
      { tenantId, key, name, permissions, isSystemRole: true },
      { upsert: true, new: true },
    );

    createdRoles[key] = role._id as mongoose.Types.ObjectId;
    console.log(`✅ Rol: ${key} (${permissions.length} permisos)`);
  }

  // ─── 3. Usuario admin ────────────────────────────────────────
  const ADMIN_EMAIL = 'admin@demo.local';
  const ADMIN_PASSWORD = 'admin123';

  let adminUser = await User.findOne({ tenantId, email: ADMIN_EMAIL });

  if (!adminUser) {
    const passwordHash = await authService.hashPassword(ADMIN_PASSWORD);

    adminUser = await User.create({
      tenantId,
      email: ADMIN_EMAIL,
      name: 'Administrador Demo',
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
    });

    await UserProfile.create({
      userId: adminUser._id,
      tenantId,
      jobTitle: 'Administrador del sistema',
    });

    // Asignar rol tenant-admin
    await UserRole.create({
      tenantId,
      userId: adminUser._id,
      roleId: createdRoles['tenant-admin'],
    });

    console.log(`✅ Usuario admin creado: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`⏭️  Usuario admin ya existe: ${ADMIN_EMAIL}`);
  }

  console.log('\n🎉 Seed completado. Para hacer login:');
  console.log(`   Header:   X-Tenant-Slug: demo`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   POST http://localhost:3000/api/v1/auth/login\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});

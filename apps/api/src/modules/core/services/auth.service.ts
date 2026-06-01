import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { env } from '../../../config/env.js';
import { AppError } from '../../../infrastructure/middleware/error-handler.js';
import { ERROR_CODES } from '@maker-wms/shared/constants';
import { auditLogService } from './audit-log.service.js';
import { User } from '../models/user.model.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { UserRole } from '../models/user-role.model.js';
import { UserPermission } from '../models/user-permission.model.js';
import { Role } from '../models/role.model.js';
import type { JwtPayload } from '../../../infrastructure/middleware/require-auth.js';

const SALT_ROUNDS = 12;

export const authService = {

  /** Hashea una contraseña en texto plano */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },

  /** Compara texto plano con hash */
  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },

  /** Construye el payload del JWT resolviendo roles y permisos del usuario */
  async buildJwtPayload(userId: string, tenantId: string, email: string): Promise<JwtPayload> {
    // Obtener roles del usuario
    const userRoles = await UserRole.find({ userId, tenantId }).lean();
    const roleIds = userRoles.map((ur) => ur.roleId);

    const roles = await Role.find({ _id: { $in: roleIds }, tenantId }).lean();
    const roleKeys = roles.map((r) => r.key);

    // Permisos de los roles
    const rolePermissions = new Set(roles.flatMap((r) => r.permissions));

    // Overrides individuales del usuario
    const overrides = await UserPermission.find({ userId, tenantId }).lean();
    for (const override of overrides) {
      if (override.granted) {
        rolePermissions.add(override.permission);
      } else {
        rolePermissions.delete(override.permission);
      }
    }

    return {
      sub: userId,
      tenantId,
      email,
      roles: roleKeys,
      permissions: Array.from(rolePermissions),
    };
  },

  /** Genera access token JWT */
  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  },

  /** Genera refresh token opaco y lo persiste en BD */
  async generateRefreshToken(userId: string, tenantId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 días

    await RefreshToken.create({ userId, tenantId, token, expiresAt });
    return token;
  },

  /** Login: valida credenciales y retorna tokens */
  async login(tenantId: string, email: string, password: string) {
    const user = await User.findOne({ tenantId, email, status: 'active' }).lean();

    if (!user) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Credenciales inválidas');
    }

    const valid = await this.comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Credenciales inválidas');
    }

    // Actualizar lastLoginAt
    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    const payload = await this.buildJwtPayload(
      user._id.toString(),
      tenantId,
      user.email,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(user._id.toString(), tenantId),
    ]);

    await auditLogService.record({
      tenantId,
      userId: user._id.toString(),
      entityType: 'User',
      entityId: user._id.toString(),
      action: 'login',
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name, roles: payload.roles },
    };
  },

  /** Refresh: valida el refresh token y emite nuevos tokens */
  async refresh(refreshToken: string) {
    const stored = await RefreshToken.findOne({
      token: refreshToken,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!stored) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Refresh token inválido o expirado');
    }

    const user = await User.findById(stored.userId).lean();
    if (!user || user.status !== 'active') {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Usuario inactivo');
    }

    // Revocar el token usado (rotation)
    await RefreshToken.findByIdAndUpdate(stored._id, { revokedAt: new Date() });

    const payload = await this.buildJwtPayload(
      user._id.toString(),
      stored.tenantId.toString(),
      user.email,
    );

    const [accessToken, newRefreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(user._id.toString(), stored.tenantId.toString()),
    ]);

    return { accessToken, refreshToken: newRefreshToken };
  },

  /** Logout: revoca el refresh token */
  async logout(refreshToken: string): Promise<void> {
    await RefreshToken.findOneAndUpdate(
      { token: refreshToken, revokedAt: null },
      { revokedAt: new Date() },
    );
  },
};

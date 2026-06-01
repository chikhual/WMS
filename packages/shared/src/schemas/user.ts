import { z } from 'zod';

export const emailSchema = z.string().email().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(100),
  password: passwordSchema,
  roleKeys: z.array(z.string()).min(1).default(['viewer']),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

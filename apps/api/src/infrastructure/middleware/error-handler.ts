import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { ERROR_CODES } from '@maker-wms/shared/constants';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: ERROR_CODES.VALIDATION_ERROR,
      message: 'Datos inválidos',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    error: ERROR_CODES.INTERNAL_ERROR,
    message: 'Error interno del servidor',
  });
};

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

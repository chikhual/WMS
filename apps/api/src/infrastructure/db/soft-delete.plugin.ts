import mongoose, { type Schema, type Query, type Document, type Types } from 'mongoose';

export interface SoftDeleteFields {
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;   // ObjectId, no string — consistente con el schema
  deletionReason: string | null;
}

/**
 * Plugin de Mongoose que agrega soft delete a cualquier schema.
 *
 * Agrega:
 *   - deletedAt, deletedBy, deletionReason al schema
 *   - Filtra automáticamente documentos eliminados en find/count/update
 *   - Método de instancia: doc.softDelete(userId, reason?)
 *   - Método de instancia: doc.restore()
 *   - Método estático: Model.findWithDeleted(filter)
 */
export function softDeletePlugin(schema: Schema) {
  // ─── Campos ────────────────────────────────────────────────
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    deletionReason: { type: String, default: null },
  });

  // ─── Índice para queries eficientes ────────────────────────
  schema.index({ deletedAt: 1 });

  // ─── Filtrar eliminados en todas las queries ────────────────
  //
  // IMPORTANTE: si la query tiene la opción { includeDeleted: true }
  // (seteada por Model.findWithDeleted), el filtro se omite para
  // devolver también los documentos soft-deleted.
  //
  const excludeDeleted = function (this: Query<unknown, Document>) {
    // Respetar solicitud explícita de incluir eliminados
    if (this.getOptions()['includeDeleted'] === true) return;
    // No sobreescribir si el caller ya filtró por deletedAt explícitamente
    if ('deletedAt' in this.getFilter()) return;
    this.where({ deletedAt: null });
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('updateOne', excludeDeleted);
  schema.pre('updateMany', excludeDeleted);

  // ─── Método de instancia: softDelete ───────────────────────
  schema.methods['softDelete'] = async function (
    deletedBy: string,
    deletionReason?: string,
  ) {
    this['deletedAt'] = new Date();
    this['deletedBy'] = deletedBy;
    this['deletionReason'] = deletionReason ?? null;
    return this.save();
  };

  // ─── Método de instancia: restore ──────────────────────────
  schema.methods['restore'] = async function () {
    this['deletedAt'] = null;
    this['deletedBy'] = null;
    this['deletionReason'] = null;
    return this.save();
  };

  // ─── Método estático: findWithDeleted ──────────────────────
  // Devuelve todos los documentos incluyendo los soft-deleted.
  // Usa la opción { includeDeleted: true } que el hook excludeDeleted respeta.
  schema.statics['findWithDeleted'] = function (filter = {}) {
    return this.find(filter).setOptions({ includeDeleted: true });
  };

  // ─── Método estático: findOnlyDeleted ──────────────────────
  // Devuelve únicamente los documentos soft-deleted.
  schema.statics['findOnlyDeleted'] = function (filter = {}) {
    return this.find({ ...filter, deletedAt: { $ne: null } }).setOptions({ includeDeleted: true });
  };
}

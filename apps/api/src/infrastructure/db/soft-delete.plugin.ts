import mongoose, { type Schema, type Query, type Document } from 'mongoose';

export interface SoftDeleteFields {
  deletedAt: Date | null;
  deletedBy: string | null;
  deletionReason: string | null;
}

/**
 * Plugin de Mongoose que agrega soft delete a cualquier schema.
 *
 * Agrega:
 *   - deletedAt, deletedBy, deletionReason al schema
 *   - Filtra automáticamente documentos eliminados en find/count/exists
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
  const excludeDeleted = function (this: Query<unknown, Document>) {
    if (!this.getFilter()['deletedAt']) {
      this.where({ deletedAt: null });
    }
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('exists', excludeDeleted);

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
  schema.statics['findWithDeleted'] = function (filter = {}) {
    return this.find(filter).setOptions({ includeDeleted: true });
  };
}

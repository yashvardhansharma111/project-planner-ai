import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Projects collection. Each project belongs to one owner (the authenticated
 * user who created it). Queries scope by `ownerId` so users see only their own.
 */
const projectSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    industry: { type: String, trim: true },
    description: { type: String, trim: true },
    budgetRange: { type: String, trim: true },
    targetCountries: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'in_review', 'approved', 'locked', 'archived'],
      default: 'draft',
    },
  },
  {
    timestamps: true,
    versionKey: false, // drop __v
    toJSON: {
      virtuals: true, // exposes the `id` getter (hex string of _id)
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        return ret;
      },
    },
  },
);

export type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDocument = HydratedDocument<Project>;
export { Types };

export const ProjectModel = model('Project', projectSchema);

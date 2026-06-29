import {
  Schema,
  model,
  models,
  Types,
  type Model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';

const projectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    industry: { type: String, trim: true },
    description: { type: String, trim: true },
    budgetRange: { type: String, trim: true },
    deadline: { type: Date, default: null },
    targetCountries: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'in_review', 'approved', 'locked', 'archived'],
      default: 'draft',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
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

export const ProjectModel: Model<Project> =
  (models.Project as Model<Project>) || model<Project>('Project', projectSchema);

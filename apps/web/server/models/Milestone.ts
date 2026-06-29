import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';

const milestoneSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
    order: { type: Number, default: 0 },
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

export type Milestone = InferSchemaType<typeof milestoneSchema>;
export type MilestoneDocument = HydratedDocument<Milestone>;

export const MilestoneModel: Model<Milestone> =
  (models.Milestone as Model<Milestone>) || model<Milestone>('Milestone', milestoneSchema);

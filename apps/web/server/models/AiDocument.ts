import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';

/** All document types the platform can generate for a project. */
export const DOC_TYPES = ['prd', 'trd', 'brd', 'srs', 'api_docs', 'db_schema'] as const;
export type DocType = (typeof DOC_TYPES)[number];

const aiDocumentSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    docType: { type: String, enum: DOC_TYPES, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, default: 1 },
    generatedBy: { type: String, default: null },
    tokensUsed: { type: Number, default: null },
    isApproved: { type: Boolean, default: false },
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

aiDocumentSchema.index({ projectId: 1, docType: 1 }, { unique: true });

export type AiDocument = InferSchemaType<typeof aiDocumentSchema>;
export type AiDocumentDocument = HydratedDocument<AiDocument>;

export const AiDocumentModel: Model<AiDocument> =
  (models.AiDocument as Model<AiDocument>) || model<AiDocument>('AiDocument', aiDocumentSchema);

import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';

/** Reserved "industry" for questions shown on every industry's questionnaire. */
export const COMMON_INDUSTRY = '__all__';

const questionSchema = new Schema(
  {
    industry: { type: String, required: true, trim: true, index: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 300 },
    type: { type: String, enum: ['text', 'textarea', 'select', 'multiselect'], default: 'text' },
    options: { type: [String], default: [] },
    placeholder: { type: String, default: '', trim: true },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    dependsOnKey: { type: String, default: null },
    dependsOnValue: { type: String, default: null },
    isActive: { type: Boolean, default: true },
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

questionSchema.index({ industry: 1, key: 1 }, { unique: true });

export type Question = InferSchemaType<typeof questionSchema>;
export type QuestionDocument = HydratedDocument<Question>;

export const QuestionModel: Model<Question> =
  (models.Question as Model<Question>) || model<Question>('Question', questionSchema);

import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Industry-specific questionnaire questions, managed by admins. The guided
 * intake flow reads these (grouped by industry) instead of a hardcoded list.
 *
 * Conditional questions: set `dependsOnKey` to another question's `key` and
 * `dependsOnValue` to the answer that reveals this one.
 */
const questionSchema = new Schema(
  {
    industry: { type: String, required: true, trim: true, index: true },
    // Stable identifier within an industry (used for answers + dependsOn).
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 300 },
    type: {
      type: String,
      enum: ['text', 'textarea', 'select', 'multiselect'],
      default: 'text',
    },
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

// Each key is unique within an industry.
questionSchema.index({ industry: 1, key: 1 }, { unique: true });

export type Question = InferSchemaType<typeof questionSchema>;
export type QuestionDocument = HydratedDocument<Question>;

export const QuestionModel = model('Question', questionSchema);

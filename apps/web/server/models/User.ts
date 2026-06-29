import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Optional: Google-only accounts never set a password.
    passwordHash: { type: String, default: null },
    googleId: { type: String, default: null, index: true },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ['client', 'admin', 'tech'], default: 'client' },
    isActive: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

// Guard against re-defining the model on hot-reload / warm serverless instances.
export const UserModel: Model<User> =
  (models.User as Model<User>) || model<User>('User', userSchema);

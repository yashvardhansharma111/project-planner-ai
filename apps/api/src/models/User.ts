import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Users collection. Passwords are stored only as a bcrypt hash (`passwordHash`);
 * the raw password never touches the database.
 */
const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['client', 'admin', 'tech'],
      default: 'client',
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
    versionKey: false, // drop __v
    toJSON: {
      virtuals: true, // exposes the `id` getter (hex string of _id)
      // Never leak the password hash or internal _id in API responses.
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

export const UserModel = model('User', userSchema);

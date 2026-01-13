import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user'; // DEPRECATED: Not used for access control
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be less than 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'admin',
      required: true,
      // DEPRECATED: Role field is kept for backward compatibility but is not used for access control.
      // Access control is now based on project ownership and collaboration membership.
    },
    emailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    emailVerificationToken: {
      type: String,
      select: false, // Don't return by default
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false, // Don't return by default
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Note: email and username indexes are automatically created by unique: true

export default mongoose.model<IUser>('User', UserSchema);

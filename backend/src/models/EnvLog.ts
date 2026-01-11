import mongoose, { Document, Schema } from 'mongoose';

export type LogAction = 'upload' | 'download' | 'edit' | 'delete' | 'access';

export interface IEnvLog extends Document {
  projectId: mongoose.Types.ObjectId;
  envFileId?: mongoose.Types.ObjectId; // Optional, as some actions might not be file-specific
  environment: 'dev' | 'staging' | 'prod';
  version?: number; // Optional, for file-specific actions
  action: LogAction;
  performedBy: mongoose.Types.ObjectId;
  performedByEmail: string; // Store email for easy reference
  performedByName: string; // Store name for easy reference
  metadata?: {
    oldVersion?: number;
    newVersion?: number;
    fileName?: string;
  };
  createdAt: Date;
}

const EnvLogSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    envFileId: {
      type: Schema.Types.ObjectId,
      ref: 'EnvFile',
      index: true,
    },
    environment: {
      type: String,
      enum: ['dev', 'staging', 'prod'],
      required: true,
      index: true,
    },
    version: {
      type: Number,
      index: true,
    },
    action: {
      type: String,
      enum: ['upload', 'download', 'edit', 'delete', 'access'],
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedByEmail: {
      type: String,
      required: true,
    },
    performedByName: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for efficient queries
EnvLogSchema.index({ projectId: 1, environment: 1, createdAt: -1 });
EnvLogSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model<IEnvLog>('EnvLog', EnvLogSchema);

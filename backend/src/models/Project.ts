import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectMember {
  userId: mongoose.Types.ObjectId;
  permission: 'read' | 'write';
}

export interface IProject extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  members: IProjectMember[];
  createdAt: Date;
}

const ProjectMemberSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permission: {
      type: String,
      enum: ['read', 'write'],
      required: true,
    },
  },
  { _id: false }
);

const ProjectSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: {
      type: [ProjectMemberSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for faster queries
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ 'members.userId': 1 });

export default mongoose.model<IProject>('Project', ProjectSchema);

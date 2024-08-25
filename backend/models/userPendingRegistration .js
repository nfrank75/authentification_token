import mongoose from "mongoose";

const userPendingRegistrationSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    confirmation_email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    confirm_password: {
      type: String,
      required: true,
    },
    otp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OTP',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  });

  export default mongoose.model('UserPendingRegistration', userPendingRegistrationSchema);
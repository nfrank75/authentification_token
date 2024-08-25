import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import User from "../models/user.js";
import OTP from "../models/otp.js";
import UserPendingRegistration from "../models/userPendingRegistration .js";
import { getResetPasswordTemplate } from "../utils/emailTemplates.js";
import ErrorHandler from "../utils/errorHandler.js";
import { delete_file, upload_file } from "../utils/cloudinary.js";
import sendToken from "../utils/sendToken.js";
import sendEmail from "../utils/sendEmail.js";
import generateOTP from "../utils/generateOtp.js";
import sendOTPEmail from "../utils/sendOtpEmail.js";
import crypto from "crypto";



// Register user => /api/v1/register
export const registerUser = catchAsyncErrors(async (req, res, next) => {
  const { 
    username,
    email,
    confirmation_email,
    password,
    confirm_password,
  } = req.body;

  // Generate a new OTP
  const otp = generateOTP();
  const otpExpiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  // Create the OTP code in the OTP table
  const otpRecord = await OTP.create({
    email,
    otp,
    expiration_date: otpExpiration,
  });

  
  // Stocker les informations temporairement
  await UserPendingRegistration.create({
    username,
    email,
    confirmation_email,
    password,
    confirm_password,
    otp: otpRecord._id,
  });

  // Send the OTP email to the user
  await sendOTPEmail(email, otp);

  return res.status(200).json({
    success: true,
    message: 'Please enter the OTP sent to your email',
  });
});

// Verify OTP => /api/v1/verify-otp
export const verifyOTP = catchAsyncErrors(async (req, res, next) => {
  const { email, otp } = req.body;

  const userPendingRegistration = await UserPendingRegistration.findOne({ email });

  // Find the OTP record
  const otpRecord = await OTP.findOne({ email, otp });

  console.log("=====otpRecord===", otpRecord);

  

  if (otpRecord && otpRecord.expiration_date > new Date()) {
    // OTP is valid, create the user

    const { username, email, confirmation_email, password, confirm_password, otp } = userPendingRegistration;

    console.log("===userPendingRegistration===", userPendingRegistration);
    

    // Create the user and associate the OTP
    const user = await User.create({
      username,
      email,
      confirmation_email,
      password,
      confirm_password,
      otp: otpRecord._id,
    });

    
    await userPendingRegistration.deleteOne();

    // Delete the OTP record
    await otpRecord.deleteOne();

    sendToken(user, 201, res);
  } else {
    // Delete the OTP record if it exists
    if (otpRecord) {
      await otpRecord.deleteOne();
    }
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP',
    });
  }
});


// Login user   =>  /api/v1/login
export const loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please enter email & password", 400));
  }

  // Find user in the database
  const user = await User.findOne({ email }).select("+password");
  console.log("---------user---------", user);

  if (!user) {
    return next(new ErrorHandler("This user doest not exist or Invalid email ", 401));
  }

  // Check if password is correct
  const isPasswordMatched = await user.comparePassword(password);
  console.log("====================id ^p", isPasswordMatched);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Wrong password, Try again", 401));
  }

  sendToken(user, 200, res);
});

// Logout user   =>  /api/v1/logout
export const logout = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    message: "Successfully Logged Out",
  });
});

// Upload user avatar   =>  /api/v1/me/upload_avatar
export const uploadAvatar = catchAsyncErrors(async (req, res, next) => {
  const avatarResponse = await upload_file(req.body.avatar, "shopit/avatars");

  // Remove previous avatar
  if (req?.user?.avatar?.url) {
    await delete_file(req?.user?.avatar?.public_id);
  }

  console.log("==============req?.user?.avatar?.url=================");
  console.log(req?.user?.avatar?.url);
  console.log("===============req?.user?.avatar?.url================");

  
  console.log("==============avatarResponse=================");
  console.log(avatarResponse);
  console.log("===============avatarResponse================");

  const user = await User.findByIdAndUpdate(req?.user?._id, {
    avatar: avatarResponse,
  });

  
  console.log("============avatar===================");
  console.log(avatar);
  console.log("=============avatar==================");

  
  console.log("============avatarResponse===================");
  console.log(avatarResponse);
  console.log("=============avatarResponse==================");
  
  console.log("============user===================");
  console.log(user);
  console.log("=============user==================");
  

  res.status(200).json({
    user,
  });
});

// Forgot password   =>  /api/v1/password/forgot
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  // Find user in the database
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHandler("User not found with this email", 404));
  }

  // Get reset password token
  const resetToken = user.getResetPasswordToken();

  await user.save();

  // Create reset password url
  const resetUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  const message = getResetPasswordTemplate(user?.name, resetUrl);

  try {
    await sendEmail({
      email: user.email,
      subject: "ShopIT Password Recovery",
      message,
    });

    res.status(200).json({
      message: `Email sent to: ${user.email}`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    return next(new ErrorHandler(error?.message, 500));
  }
});

// Reset password   =>  /api/v1/password/reset/:token
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  // Hash the URL Token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHandler(
        "Password reset token is invalid or has been expired",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Passwords does not match", 400));
  }

  // Set the new password
  user.password = req.body.password;

  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res);
});

// Get current user profile  =>  /api/v1/me
export const getUserProfile = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req?.user?._id);

  res.status(200).json({
    user,
  });
});

// Update Password  =>  /api/v1/password/update
export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req?.user?._id).select("+password");

  // Check the previous user password
  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Old Password is incorrect", 400));
  }

  user.password = req.body.password;
  user.save();

  res.status(200).json({
    success: true,
  });
});

// Update User Profile  =>  /api/v1/me/update
export const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findByIdAndUpdate(req.user._id, newUserData, {
    new: true,
  });

  res.status(200).json({
    user,
  });
});

// Get all Users - ADMIN  =>  /api/v1/admin/users
export const allUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    users,
  });
});

// Get User Details - ADMIN  =>  /api/v1/admin/users/:id
export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User not found with id: ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    user,
  });
});

// Update User Details - ADMIN  =>  /api/v1/admin/users/:id
export const updateUser = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
  });

  res.status(200).json({
    user,
  });
});

// Delete User - ADMIN  =>  /api/v1/admin/users/:id
export const deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User not found with id: ${req.params.id}`, 404)
    );
  }

  // TODO - Remove user avatar from cloudinary

  await user.deleteOne();

  res.status(200).json({
    success: true,
  });
});

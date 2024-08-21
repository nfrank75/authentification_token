import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import countriesList from "./country_list.js"

const userSchema = new mongoose.Schema(
    {
        surname: {
            type: String,
            required: [true, "Please enter your surname"],
            minlength: [3, "Your name cannot less than 03 characters"],
            maxLength: [50, "Your name cannot exceed 50 characters"],
        },
        firstname: {
            type: String,
            required: true,
            minlength: [3, "Your name cannot less than 03 characters"],
            maxLength: [50, "Your name cannot exceed 50 characters"],
        },
        username: {
            type: String,
            required: [true, "Please enter your username"],
            minlength: [3, "Your username cannot less than 03 characters"],
            maxLength: [50, "Your username cannot exceed 50 characters"],
            unique: true,

        },
        date_of_birthday: {
            type: Date,
            required: true,
            validate: {
                validator: function(v) {
                    // Vérifier que la date de naissance est antérieure à la date actuelle
                    return v < new Date();
                },
                message: props => `${props.value} n'est pas une date de naissance valide!`
            }
        },
        place_of_birthday: {
            type: String,
            required: true,

        },
        email: {
            type: String,
            required: [true, "Please enter your email"],
            unique: true,
            lowercase: true,
            validate: {
                validator: function(v) {
                    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
                },
                message: props => `${props.value} n'est pas une adresse e-mail valide!`
            }
        },
        confirmation_email: {
            type: String,
            required: [true, "Please enter your confirmation email, must be equal to your email field"],
            unique: true,

        },
        password: {
          type: String,
          required: [true, "Please enter your password"],
          minLength: [6, "Your password must be longer than 6 characters"],
          select: false,
        },
        
        confirm_password: {
            type: String,
            required: [true, "Please enter your password"],
            minLength: [6, "Your password must be longer than 6 characters"],
            select: false,
        },
        avatar: {
          public_id: String,
          url: String,
        },
        role: {
          type: String,
          default: "user",
        },
        phone: {
            type: String,
            required: true,
            unique:true,
            validate: {
                validator: function(v) {
                    return /^\+?\d{1,3}[- ]?\(?\d\)?[- ]?\d{1,14}$/.test(v);
                },
                message: props => `${props.value} n'est pas un numéro de téléphone valide!`
            }

        },
        country: {
            type: String,
            required: true,
            enum: countriesList

        },
        nationality: {
            type: String,
            required: true,
            enum: countriesList

        },
        contribuable_number: {
            type: String,
            required: true,
            unique: true,

        },
        preference_language: {
            type: String,

        },
        devise: {
            type: String,
            required: true,
            default: "$",

        },
        pseudonym_sponsor: {
            type: String

        },
        us_person_certification: {
            type: Boolean,
            default: false
        },
        mobile_money_number: {
            type: String,
            required: true,
            unique:true

        },
        bank_account: {
            bank_name: {
              type: String,
              required: [true, "Veuillez entrer le nom de la banque"]
            },
            iban: {
              type: String,
              required: [true, "Veuillez entrer votre numéro IBAN"],
              unique:true
            },
            bic: {
              type: String,
              required: [true, "Veuillez entrer votre code BIC"],
              unique:true
            }
          },
        resetPasswordToken: String,
        resetPasswordExpire: Date,
    },
    { timestamps: true }
  );


// Encrypting / Hashing the Password field before saving in the database
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
      next();
    }
  
    this.password = await bcrypt.hash(this.password, 10);
  });
  
  
  // This funtion getJwtToken return JWT Token, JWT Token has (_id, jwt_secret, jwt_expires_time)
  userSchema.methods.getJwtToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_TIME,
    });
  };
  
  
  // Compare the password entered by the user when login with his password saved in the db when registered
  userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
  }
  
  
  // Reset Password Token & Generate password 
  userSchema.methods.getResetPasswordToken = function () {
  
    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");
  
    // Hash and set to resetPasswordToken field
    this.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
  
    // Set token expire time
    this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  
    return resetToken;
  };
  
  
  export default mongoose.model("User", userSchema);
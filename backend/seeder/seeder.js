import mongoose from "mongoose";
import users from  './data.js';
import User from '../models/user.js';  

const seedUsers = async () => {

    try {
        await mongoose.connect('mongodb://localhost:27017/authentification_token');

        await User.deleteMany();
        console.log('Users are deleted');

        await User.insertMany(users);
        console.log('users are added');

    } catch (error) {
        console.log(error.message);
        process.exit();
    }

};

seedUsers();
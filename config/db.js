import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Ensure legacy unique index on username is removed (usernames can repeat)
        try {
            await conn.connection.collection('users').dropIndex('username_1');
            console.log('Dropped legacy username_1 unique index');
        } catch (err) {
            if (err?.codeName !== 'IndexNotFound') {
                console.warn('Could not drop username_1 index:', err.message);
            }
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;


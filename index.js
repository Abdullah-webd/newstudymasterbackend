import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUI from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import connectDB from './config/db.js';
import { initializeFirebaseAdmin } from './config/firebaseAdmin.js';
import { startTimetableNotifier } from './utils/timetableNotifier.js';

// Route files
// ... (rest of imports)
import auth from './routes/auth.routes.js';
import user from './routes/user.routes.js';
import admin from './routes/admin.routes.js';
import note from './routes/note.routes.js';
import question from './routes/question.routes.js';
import chat from './routes/chat.routes.js';
import activity from './routes/activity.routes.js';
import exam from './routes/exam.routes.js';
import quiz from './routes/quiz.routes.js';
import timetable from './routes/timetable.routes.js';
import dashboard from './routes/dashboard.routes.js';
import community from './routes/community.routes.js';
import follow from './routes/follow.routes.js';
import profile from './routes/profile.routes.js';
import settings from './routes/settings.routes.js';


import { inngestServe } from './inngest/handler.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();
initializeFirebaseAdmin();

const app = express();

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000',"https://www.studymaster.live, https://studymaster-rho.vercel.app"],
    credentials: true
}));

// Cross-Origin-Opener-Policy for Google Login
app.use((req, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
});

// Body parser
app.use(express.json());

// Swagger Options
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'StudyMaster API',
            version: '1.0.0',
            description: 'API documentation for StudyMaster backend',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 5000}`,
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/user', user);
app.use('/api/v1/admin', admin);
app.use('/api/v1/notes', note);
app.use('/api/v1/questions', question);
app.use('/api/v1/chats', chat);
app.use('/api/v1/activity', activity);
app.use('/api/v1/exams', exam);
app.use('/api/v1/quizzes', quiz);
app.use('/api/v1/timetable', timetable);
app.use('/api/v1/dashboard', dashboard);
app.use('/api/v1/community', community);
app.use('/api/v1/follow', follow);
app.use('/api/v1/profile', profile);
app.use('/api/v1/settings', settings);


app.use('/api/inngest', inngestServe);

// Basic route
app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in development mode on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    startTimetableNotifier();
});

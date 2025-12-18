import { betterAuth } from "better-auth";
import { mongodbAdapter} from "better-auth/adapters/mongodb";
import { connectToDatabase} from "@/database/mongoose";
import { nextCookies} from "better-auth/next-js";

let authInstance: ReturnType<typeof betterAuth> | null = null;

export const getAuth = async () => {
    if(authInstance) return authInstance;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if(!db) throw new Error('MongoDB connection not found');

    // Get base URL - use Vercel URL if available, otherwise use env or fallback
    const baseURL = process.env.BETTER_AUTH_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
                   process.env.NEXT_PUBLIC_APP_URL ||
                   'http://localhost:3000';

    // Validate required environment variables
    if (!process.env.BETTER_AUTH_SECRET) {
        console.warn('BETTER_AUTH_SECRET is not set. Authentication may not work correctly.');
    }

    authInstance = betterAuth({
        database: mongodbAdapter(db as any),
        secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret-change-in-production',
        baseURL: baseURL,
        emailAndPassword: {
            enabled: true,
            disableSignUp: false,
            requireEmailVerification: false,
            minPasswordLength: 8,
            maxPasswordLength: 128,
            autoSignIn: true,
        },
        plugins: [nextCookies()],
    });

    return authInstance;
}

// Lazy initialization - don't await at module level to avoid build issues
export const auth = {
    api: {
        getSession: async (options: any) => {
            const authInstance = await getAuth();
            return authInstance.api.getSession(options);
        },
        signIn: async (options: any) => {
            const authInstance = await getAuth();
            return authInstance.api.signIn(options);
        },
        signInEmail: async (options: any) => {
            const authInstance = await getAuth();
            return authInstance.api.signInEmail(options);
        },
        signUp: async (options: any) => {
            const authInstance = await getAuth();
            return authInstance.api.signUp(options);
        },
        signUpEmail: async (options: any) => {
            const authInstance = await getAuth();
            return authInstance.api.signUpEmail(options);
        },
        signOut: async (options: any) => {
            const authInstance = await getAuth();
            return authInstance.api.signOut(options);
        },
    },
};

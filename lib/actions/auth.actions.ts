'use server';

import {auth} from "@/lib/better-auth/auth";
import {inngest} from "@/lib/inngest/client";
import {headers} from "next/headers";

export const signUpWithEmail = async ({ email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry }: SignUpFormData) => {
    try {
        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } })

        if(response) {
            await inngest.send({
                name: 'app/user.created',
                data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry }
            })
        }

        return { success: true, data: response }
    } catch (e: any) {
        console.log('Sign up failed', e)
        
        // Extract specific error messages
        let errorMessage = 'Sign up failed. Please try again.';
        
        if (e?.message) {
            const message = e.message.toLowerCase();
            if (message.includes('already exists') || message.includes('duplicate') || message.includes('email')) {
                errorMessage = 'An account with this email already exists. Please sign in instead.';
            } else if (message.includes('password') || message.includes('weak')) {
                errorMessage = 'Password is too weak. Please use a stronger password (min 8 characters).';
            } else if (message.includes('email') || message.includes('invalid')) {
                errorMessage = 'Invalid email address. Please check and try again.';
            } else if (message.includes('required')) {
                errorMessage = 'Please fill in all required fields.';
            }
        }
        
        return { success: false, error: errorMessage }
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const response = await auth.api.signInEmail({ body: { email, password } })

        return { success: true, data: response }
    } catch (e: any) {
        console.log('Sign in failed', e)
        
        // Extract specific error messages
        let errorMessage = 'Sign in failed. Please check your credentials and try again.';
        
        if (e?.message) {
            const message = e.message.toLowerCase();
            if (message.includes('invalid') && (message.includes('password') || message.includes('credentials'))) {
                errorMessage = 'Incorrect email or password. Please check your credentials and try again.';
            } else if (message.includes('not found') || message.includes('does not exist')) {
                errorMessage = 'No account found with this email. Please sign up first.';
            } else if (message.includes('email') || message.includes('invalid')) {
                errorMessage = 'Invalid email address. Please check and try again.';
            } else if (message.includes('required')) {
                errorMessage = 'Please fill in all required fields.';
            } else if (message.includes('locked') || message.includes('disabled')) {
                errorMessage = 'This account has been locked. Please contact support.';
            }
        }
        
        return { success: false, error: errorMessage }
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.log('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}

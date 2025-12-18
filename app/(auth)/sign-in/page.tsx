'use client';

import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import {signInWithEmail} from "@/lib/actions/auth.actions";
import {toast} from "sonner";
import {useRouter} from "next/navigation";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const SignIn = () => {
    const router = useRouter()
    const [authError, setAuthError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
    });

    // Watch form values for real-time validation
    const emailValue = watch('email');
    const passwordValue = watch('password');

    // Clear error when user starts typing
    useEffect(() => {
        if (authError && (emailValue || passwordValue)) {
            setAuthError(null);
        }
    }, [emailValue, passwordValue, authError]);

    const onSubmit = async (data: SignInFormData) => {
        setAuthError(null);
        setIsSubmitting(true);
        
        try {
            const result = await signInWithEmail(data);
            
            if(result.success) {
                toast.success('Welcome back!', {
                    description: 'You have been signed in successfully.'
                });
                router.push('/');
            } else {
                const errorMsg = result.error || 'Sign in failed. Please try again.';
                setAuthError(errorMsg);
                toast.error('Sign in failed', {
                    description: errorMsg
                });
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Failed to sign in. Please try again.';
            setAuthError(errorMsg);
            toast.error('Sign in failed', {
                description: errorMsg
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <h1 className="form-title">Welcome back</h1>

            {authError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{authError}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="Email"
                    placeholder="contact@signalist.com"
                    register={register}
                    error={errors.email}
                    validation={{ 
                        required: 'Email is required', 
                        pattern: {
                            value: /^[\w.]+@[\w.]+\.\w+$/,
                            message: 'Please enter a valid email address'
                        }
                    }}
                />

                <InputField
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ 
                        required: 'Password is required', 
                        minLength: {
                            value: 8,
                            message: 'Password must be at least 8 characters'
                        }
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Signing In...' : 'Sign In'}
                </Button>

                <FooterLink text="Don't have an account?" linkText="Create an account" href="/sign-up" />
            </form>
        </>
    );
};
export default SignIn;

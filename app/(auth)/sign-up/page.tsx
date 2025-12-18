'use client';

import {useForm} from "react-hook-form";
import {useState, useEffect} from "react";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import {INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS} from "@/lib/constants";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import {signUpWithEmail} from "@/lib/actions/auth.actions";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const SignUp = () => {
    const router = useRouter()
    const [authError, setAuthError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
        watch,
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            country: 'US',
            investmentGoals: 'Growth',
            riskTolerance: 'Medium',
            preferredIndustry: 'Technology'
        },
        mode: 'onBlur'
    });

    // Watch form values for real-time validation
    const emailValue = watch('email');
    const passwordValue = watch('password');
    const fullNameValue = watch('fullName');

    // Clear error when user starts typing
    useEffect(() => {
        if (authError && (emailValue || passwordValue || fullNameValue)) {
            setAuthError(null);
        }
    }, [emailValue, passwordValue, fullNameValue, authError]);

    const onSubmit = async (data: SignUpFormData) => {
        setAuthError(null);
        setIsSubmitting(true);
        
        try {
            const result = await signUpWithEmail(data);
            
            if(result.success) {
                toast.success('Account created!', {
                    description: 'Welcome to Signalist! Redirecting to dashboard...'
                });
                router.push('/');
            } else {
                const errorMsg = result.error || 'Sign up failed. Please try again.';
                setAuthError(errorMsg);
                toast.error('Sign up failed', {
                    description: errorMsg
                });
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Failed to create an account. Please try again.';
            setAuthError(errorMsg);
            toast.error('Sign up failed', {
                description: errorMsg
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <h1 className="form-title">Sign Up & Personalize</h1>

            {authError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{authError}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="fullName"
                    label="Full Name"
                    placeholder="John Doe"
                    register={register}
                    error={errors.fullName}
                    validation={{ 
                        required: 'Full name is required', 
                        minLength: {
                            value: 2,
                            message: 'Full name must be at least 2 characters'
                        }
                    }}
                />

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
                    placeholder="Enter a strong password"
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

                <CountrySelectField
                    name="country"
                    label="Country"
                    control={control}
                    error={errors.country}
                    required
                />

                <SelectField
                    name="investmentGoals"
                    label="Investment Goals"
                    placeholder="Select your investment goal"
                    options={INVESTMENT_GOALS}
                    control={control}
                    error={errors.investmentGoals}
                    required
                />

                <SelectField
                    name="riskTolerance"
                    label="Risk Tolerance"
                    placeholder="Select your risk level"
                    options={RISK_TOLERANCE_OPTIONS}
                    control={control}
                    error={errors.riskTolerance}
                    required
                />

                <SelectField
                    name="preferredIndustry"
                    label="Preferred Industry"
                    placeholder="Select your preferred industry"
                    options={PREFERRED_INDUSTRIES}
                    control={control}
                    error={errors.preferredIndustry}
                    required
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Creating Account...' : 'Start Your Investing Journey'}
                </Button>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    )
}
export default SignUp;

import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {NextRequest} from "next/server";

export default async function HomePage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const session = await auth.api.getSession({ headers: await headers() });

    // Check if this is a Deriv redirect with account/token parameters
    // Deriv sends: ?acct1=...&token1=...&cur1=...&acct2=...&token2=...&cur2=...
    const hasDerivParams = searchParams.acct1 || searchParams.token1;
    
    if (hasDerivParams) {
        if (!session?.user) {
            // User not authenticated, redirect to sign in first
            const params = new URLSearchParams();
            Object.entries(searchParams).forEach(([key, value]) => {
                if (value && (key.startsWith('acct') || key.startsWith('token') || key.startsWith('cur'))) {
                    params.append(key, Array.isArray(value) ? value[0] : value);
                }
            });
            redirect(`/sign-in?redirect=/api/auto-trading/deriv/redirect?${params.toString()}`);
            return null;
        }
        
        // Redirect to the Deriv redirect handler API route
        const params = new URLSearchParams();
        Object.entries(searchParams).forEach(([key, value]) => {
            if (value) {
                params.append(key, Array.isArray(value) ? value[0] : value);
            }
        });
        redirect(`/api/auto-trading/deriv/redirect?${params.toString()}`);
        return null;
    }

    if(session?.user) {
        redirect('/dashboard');
    } else {
        // Show landing page for non-authenticated users
        redirect('/landing');
    }
}

'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            router.push("/connect");
        } catch (err: any) {
            console.error(err);
            setError("Failed to login with Google.");
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>DB-Lighthouse AI</CardTitle>
                    <CardDescription>Login to optimize your database.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleLogin} className="w-full">
                        Login with Google
                    </Button>
                    {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                </CardContent>
            </Card>
        </div>
    );
}

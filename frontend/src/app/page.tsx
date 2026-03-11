'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-white">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-zinc-800 bg-zinc-950/75 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-zinc-800/50 lg:p-4">
          DB-Lighthouse AI
        </p>
      </div>

      <div className="relative flex flex-col place-items-center gap-8 mt-16">
        <h1 className="text-5xl font-bold text-center bg-gradient-to-r from-violet-400 to-indigo-400 text-transparent bg-clip-text">
          The Lighthouse for Your Database
        </h1>
        <p className="text-xl text-zinc-400 text-center max-w-2xl">
          Optimize storage, visualize relationships, and get AI-powered insights for your PostgreSQL database.
        </p>

        <div className="flex gap-4 mt-8">
          {loading ? (
            <Button size="lg" disabled className="bg-violet-700 py-6 px-8 text-lg">
              <Loader2 className="animate-spin mr-2" /> Loading...
            </Button>
          ) : user ? (
            /* Signed in — show Get Started */
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-6 px-8 text-lg"
              onClick={() => router.push("/connect")}
            >
              Get Started →
            </Button>
          ) : (
            /* Not signed in — show Google login */
            <Button
              size="lg"
              className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-6 px-8 text-lg flex items-center gap-3"
              onClick={signInWithGoogle}
            >
              {/* Google "G" logo */}
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Sign in with Google
            </Button>
          )}

          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="lg" className="border-zinc-700 hover:bg-zinc-800 text-white font-bold py-6 px-8 text-lg">
              View on GitHub
            </Button>
          </a>
        </div>

        {user && (
          <p className="text-sm text-zinc-500 mt-2">
            Signed in as <span className="text-violet-400">{user.displayName}</span>
          </p>
        )}
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left mt-24 gap-4">
        <FeatureCard title="Connect" desc="Securely connect to your local or remote PostgreSQL database." />
        <FeatureCard title="Visualize" desc="Interactive node-graph visualization of your schema relationships." />
        <FeatureCard title="Optimize" desc="Heuristic analysis to detect storage inefficiencies." />
        <FeatureCard title="Ask AI" desc="Chat with a local LLM about your schema in plain English." />
      </div>
    </main>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/30">
      <h2 className="mb-3 text-2xl font-semibold">
        {title}{" "}
        <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
      </h2>
      <p className="m-0 max-w-[30ch] text-sm opacity-50">{desc}</p>
    </div>
  );
}

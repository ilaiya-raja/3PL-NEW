'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_10%,hsl(190_50%_80%/0.55),transparent_55%),radial-gradient(700px_420px_at_85%_0%,hsl(210_35%_88%/0.8),transparent_50%),linear-gradient(165deg,hsl(210_30%_96%)_0%,hsl(200_28%_92%)_45%,hsl(178_25%_90%)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-portal lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16 lg:py-16">
          <div>
            <p className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Client Portal
            </p>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-muted-foreground">
              Warehouse operations
            </p>
          </div>

          <div className="mt-16 max-w-md lg:mt-0">
            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Your stock, orders, and inbound — in one place.
            </h1>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
              Sign in to track inventory, place outbound orders, and submit ASNs
              with your 3PL partner.
            </p>
          </div>

          <p className="mt-12 hidden text-xs text-muted-foreground lg:block">
            Secure access for authorized client users only.
          </p>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-14 lg:py-16">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-6 border border-border/80 bg-card p-7 shadow-none backdrop-blur-sm sm:p-9"
          >
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Sign in
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Use the credentials issued by your warehouse account manager.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-background/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-background/70"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full text-sm font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

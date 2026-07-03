"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, Scissors, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Validation ──────────────────────────────────────────
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupForm = z.infer<typeof signupSchema>;

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/signup");
        const json = await res.json();
        if (json.success) {
          setSignupEnabled(json.enabled);
        } else {
          setSignupEnabled(false);
        }
      } catch {
        setSignupEnabled(false);
      }
    })();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Failed to create account. Please try again.");
        return;
      }

      toast.success(`Account created! Welcome, ${json.data.name}!`);
      router.push(redirect);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: Branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #2D1B1F 0%, #1A0F12 40%, #3D2229 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-[-60px] right-[-60px] w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #B76E79, transparent)" }} />
        <div className="absolute bottom-[-40px] left-[-40px] w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #C4956A, transparent)" }} />
        <div className="absolute top-1/2 left-[-30px] w-48 h-48 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #B76E79, transparent)" }} />

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: "linear-gradient(135deg, #B76E79 0%, #C4956A 100%)" }}>
            <Scissors className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>

          <h1 className="text-4xl font-display font-bold text-white mb-2">
            Lumi
          </h1>
          <p className="text-lg mb-1"
            style={{ color: "#D4A0A7" }}>
            Management Suite
          </p>

          <div className="w-16 h-0.5 mx-auto my-6 rounded-full"
            style={{ background: "linear-gradient(90deg, #B76E79, #C4956A)" }} />

          <p className="text-sm leading-relaxed"
            style={{ color: "#9A7A80" }}>
            Create an administrator account to set up your beauty lounge, manage clients, bookings, and cash registers.
          </p>

          {/* Feature list */}
          <div className="mt-10 space-y-3 text-left">
            {[
              "Setup custom services & pricing",
              "Manage stylist commissions & logs",
              "Real-time product stock alerts",
              "Interactive client loyalty tiers",
              "GST-compliant automated invoicing",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#B76E79" }} />
                <span className="text-sm" style={{ color: "#9A7A80" }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-8 flex items-center gap-2"
          style={{ color: "#5A3A40" }}>
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-xs">Beauty Management Reimagined</span>
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* ── Right Panel: Sign Up Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12"
        style={{ background: "#FAFAF8" }}>
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #B76E79, #C4956A)" }}>
              <Scissors className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-display font-bold text-foreground text-lg leading-none">Lumi</p>
              <p className="text-xs text-muted-foreground">Management Suite</p>
            </div>
          </div>

          {signupEnabled === null ? (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <span className="text-xs font-semibold">Checking security policies...</span>
            </div>
          ) : !signupEnabled ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-1">
                  Registration Locked
                </h2>
                <p className="text-sm text-muted-foreground">
                  Public registrations are disabled on this instance
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 text-amber-800 text-xs space-y-2">
                <p className="font-semibold text-sm">Security Restriction</p>
                <p className="leading-relaxed">
                  An administrator account has already been registered. For security reasons, public registration is now disabled.
                </p>
                <p className="leading-relaxed">
                  To create a new staff account, please log in with your Admin account, navigate to <strong>Settings &rarr; User Accounts</strong>, and create the profile from there.
                </p>
              </div>

              <Link href="/login" className="btn-primary w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm">
                Go to Sign In
              </Link>
            </div>
          ) : (
            <>
              {/* Heading */}
              <div className="mb-8">
                <h2 className="text-2xl font-display font-bold text-foreground mb-1">
                  Create an account
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign up as an administrator to begin
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Full Name
                  </label>
                  <input
                    {...register("name")}
                    type="text"
                    autoComplete="name"
                    placeholder="John Doe"
                    className={cn(
                      "input-luxury",
                      errors.name && "border-red-400 focus:ring-red-300"
                    )}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Email address
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@salon.com"
                    className={cn(
                      "input-luxury",
                      errors.email && "border-red-400 focus:ring-red-300"
                    )}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={cn(
                        "input-luxury pr-11",
                        errors.password && "border-red-400 focus:ring-red-300"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Sign up"
                  )}
                </button>
              </form>

              {/* Redirect to login */}
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-500 transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Lumi. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "#FAFAF8" }} />}>
      <SignupContent />
    </Suspense>
  );
}

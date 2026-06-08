"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: data.get("username"),
      password: data.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid username or password.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 flex-col justify-between p-12">
        <div>
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-8">
            <div className="w-5 h-5 rounded bg-white" />
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Production<br />Tracking Dashboard
          </h1>
          <p className="text-gray-400 mt-4 text-sm leading-relaxed">
            Track your orders through every production stage.<br />
            Real-time updates, full audit trail.
          </p>
        </div>
        <div className="space-y-3">
          {["Drawing", "Carpentry", "Painting", "Upholstery", "Packing"].map((stage, i) => (
            <div key={stage} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${i < 3 ? "bg-green-400" : "bg-gray-600"}`} />
              <span className="text-sm text-gray-400">{stage}</span>
              {i < 3 && <span className="text-xs text-green-400 ml-auto">Done</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username" name="username" required autoFocus
                className="h-11"
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password" name="password" type="password" required
                className="h-11"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 bg-gray-900 hover:bg-gray-800" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Image from "next/image";

// Color scheme matching mobile app
const colors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login, register, isLoading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegistering) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }

      // Redirect to dashboard on success
      router.push("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Authentication failed",
      );
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colors.background }}
    >
      <div className="w-full max-w-md">
        {/* Logo and Slogan */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image
              src="/frederick-logo.svg"
              alt="Frederick Logo"
              width={120}
              height={120}
              className="w-48 h-48"
            />
          </div>
          <h2
            className="text-xl font-semibold tracking-wide"
            style={{ color: colors.text }}
          >
            Built on what matters
          </h2>
        </div>

        {/* Login Card */}
        <Card
          className="border-0 shadow-2xl"
          style={{
            backgroundColor: colors.cardBackground,
            borderRadius: "20px",
            border: `1px solid ${colors.divider}`,
          }}
        >
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h1
                className="text-2xl font-semibold mb-2"
                style={{ color: colors.cardText }}
              >
                {isRegistering ? "Create Account" : "Welcome back"}
              </h1>
              <p
                className="text-sm"
                style={{ color: colors.cardTextSecondary }}
              >
                {isRegistering
                  ? "Enter your details to create your account"
                  : "Enter your credentials to access your account"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <div
                    className="flex items-center px-3 py-2 rounded-xl border"
                    style={{
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.buttonBorder,
                    }}
                  >
                    <User
                      size={20}
                      className="mr-3"
                      style={{ color: colors.cardTextSecondary }}
                    />
                    <Input
                      type="text"
                      placeholder="Display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required={isRegistering}
                      className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      style={{ color: colors.cardText }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div
                  className="flex items-center px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.buttonBorder,
                  }}
                >
                  <Mail
                    size={20}
                    className="mr-3"
                    style={{ color: colors.cardTextSecondary }}
                  />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ color: colors.cardText }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div
                  className="flex items-center px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.buttonBorder,
                  }}
                >
                  <Lock
                    size={20}
                    className="mr-3"
                    style={{ color: colors.cardTextSecondary }}
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                    style={{ color: colors.cardText }}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {showPassword ? (
                      <EyeOff
                        size={20}
                        style={{ color: colors.cardTextSecondary }}
                      />
                    ) : (
                      <Eye
                        size={20}
                        style={{ color: colors.cardTextSecondary }}
                      />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="p-3 text-sm rounded-xl border"
                  style={{
                    backgroundColor: colors.errorBackground,
                    borderColor: colors.errorBorder,
                    color: colors.errorText,
                  }}
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-base tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
                style={{
                  backgroundColor: colors.accent,
                  color: colors.cardText,
                  border: `1px solid ${colors.accent}`,
                }}
              >
                {isLoading
                  ? isRegistering
                    ? "Creating account..."
                    : "Signing in..."
                  : isRegistering
                    ? "Create Account"
                    : "Login"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p
                className="text-sm"
                style={{ color: colors.cardTextSecondary }}
              >
                {isRegistering
                  ? "Already have an account?"
                  : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  disabled={isLoading}
                  className="font-semibold hover:underline transition-colors"
                  style={{ color: colors.buttonText }}
                >
                  {isRegistering ? "Sign in" : "Sign up"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

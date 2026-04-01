import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [oauthProcessing, setOauthProcessing] = useState(false);
  const { toast } = useToast();

  // Handle OAuth callback - check for hash fragments or query params indicating a callback
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    
    // Check if this is an OAuth callback (has access_token in hash or error)
    if (hash.includes("access_token") || hash.includes("error_description") || params.get("error")) {
      setOauthProcessing(true);
      
      if (hash.includes("error_description")) {
        const errorDesc = decodeURIComponent(hash.split("error_description=")[1]?.split("&")[0] || "Authentication failed");
        toast({ title: "Sign in failed", description: errorDesc, variant: "destructive" });
        setOauthProcessing(false);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      if (params.get("error")) {
        toast({ title: "Sign in failed", description: params.get("error_description") || "Authentication failed", variant: "destructive" });
        setOauthProcessing(false);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      // The supabase client should pick up the hash automatically
      // Give it a moment to process
      const timer = setTimeout(() => {
        setOauthProcessing(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast({ title: "Couldn't sign in", description: error.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Sign in error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim()) return;
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: displayName.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Couldn't sign up", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    } catch (err: any) {
      toast({ title: "Sign up error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Reset link sent", description: "Check your email for the reset link." });
        setShowForgot(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setForgotLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        toast({ title: "Google sign-in failed", description: String(result.error), variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message || "Something went wrong", variant: "destructive" });
    }
    setGoogleLoading(false);
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        toast({ title: "Apple sign-in failed", description: String(result.error), variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Apple sign-in failed", description: err.message || "Something went wrong", variant: "destructive" });
    }
    setAppleLoading(false);
  };

  // OAuth processing state
  if (oauthProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Completing sign in...</p>
        </div>
      </div>
    );
  }

  // Forgot password overlay
  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
            <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com" className="h-11 rounded-xl bg-card border-border" required autoFocus />
            </div>
            <Button type="submit" disabled={forgotLoading}
              className="w-full h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-sm font-medium">
              {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </Button>
          </form>
          <button onClick={() => setShowForgot(false)} className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">DuoSpace</h1>
          <p className="text-sm text-muted-foreground">A private space for two</p>
        </div>

        {/* Social login */}
        <div className="space-y-2">
          <Button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            variant="outline"
            className="w-full h-12 rounded-xl gap-3 text-sm font-medium"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </Button>
          <Button
            onClick={handleAppleLogin}
            disabled={appleLoading}
            variant="outline"
            className="w-full h-12 rounded-xl gap-3 text-sm font-medium"
          >
            {appleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            )}
            Continue with Apple
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground">or use email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="w-full bg-muted/50 rounded-xl h-10">
            <TabsTrigger value="login" className="flex-1 rounded-lg text-xs">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1 rounded-lg text-xs">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="h-11 rounded-xl bg-card border-border" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-[11px] text-muted-foreground uppercase tracking-wider">Password</Label>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="h-11 rounded-xl bg-card border-border" required />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-sm font-medium">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
              <button type="button" onClick={() => setShowForgot(true)}
                className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[11px] text-muted-foreground uppercase tracking-wider">Your Name</Label>
                <Input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name" className="h-11 rounded-xl bg-card border-border" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="h-11 rounded-xl bg-card border-border" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-[11px] text-muted-foreground uppercase tracking-wider">Password</Label>
                <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters" className="h-11 rounded-xl bg-card border-border" required />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-sm font-medium">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[10px] text-muted-foreground">
          End-to-end encrypted • Your data stays yours
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Couldn't sign in", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast({ title: "Couldn't sign up", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a confirmation link." });
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Google sign-in failed", description: String(error), variant: "destructive" });
    }
  };

  const handleAppleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Apple sign-in failed", description: String(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif tracking-tight">DuoSpace</h1>
          <p className="text-sm text-muted-foreground">A private space for two</p>
        </div>

        {/* Social login buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-12 rounded-xl gap-3 text-sm font-medium"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
          <Button
            onClick={handleAppleLogin}
            variant="outline"
            className="w-full h-12 rounded-xl gap-3 text-sm font-medium"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="w-full bg-muted/50 rounded-xl">
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
                {loading ? "Signing in..." : "Sign In"}
              </Button>
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
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[11px] text-muted-foreground">
          End-to-end encrypted • Your data stays yours
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;

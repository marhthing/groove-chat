import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND_NAME } from "@/lib/constants";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const welcomeMessage = `Welcome to ${BRAND_NAME}, your surest companion on the journey to discovering amazing conversations. We're here to make every interaction meaningful, insightful, and truly unforgettable. Let's get started on this incredible adventure together!`;

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);

      // Check if onboarding is already completed
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, first_name, last_name, age")
        .eq("id", session.user.id)
        .single();

      if (profile?.onboarding_completed) {
        navigate("/chat");
      } else if (profile?.first_name && profile?.last_name && profile?.age) {
        // All info collected, show welcome screen
        setStep(3);
      } else if (profile?.first_name && profile?.last_name) {
        // Name collected, need age
        setStep(2);
      }
      // Otherwise stay on step 1 (default)
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    if (step === 3) {
      let index = 0;
      const interval = setInterval(() => {
        if (index <= welcomeMessage.length) {
          setTypedText(welcomeMessage.slice(0, index));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userId) throw new Error("User not found");

      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName, last_name: lastName })
        .eq("id", userId);

      if (error) throw error;

      setStep(2);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userId) throw new Error("User not found");

      const { error } = await supabase
        .from("profiles")
        .update({ age: parseInt(age) })
        .eq("id", userId);

      if (error) throw error;

      setStep(3);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);

    try {
      // Check if email is verified
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email_confirmed_at) {
        setShowVerificationDialog(true);
        setLoading(false);
        return;
      }

      // Mark onboarding as completed
      if (!userId) throw new Error("User not found");

      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);

      if (error) throw error;

      navigate("/chat");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Welcome! Let's get to know you</CardTitle>
              <CardDescription>Tell us your name</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Doe"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : "Next"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Nice to meet you, {firstName}!</CardTitle>
              <CardDescription>How old are you?</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAgeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                    min="13"
                    max="120"
                    placeholder="25"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : "Next"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>All Set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="min-h-[150px] p-4 bg-muted rounded-lg">
                <p className="text-foreground leading-relaxed">
                  {typedText}
                  {typedText.length < welcomeMessage.length && (
                    <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                  )}
                </p>
              </div>
              <Button 
                onClick={handleStart} 
                className="w-full" 
                disabled={loading || typedText.length < welcomeMessage.length}
              >
                {loading ? "Loading..." : "Start"}
              </Button>
            </CardContent>
          </>
        )}
      </Card>

      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Your Account</DialogTitle>
            <DialogDescription>
              An email was sent to your inbox. Please verify your email address before continuing.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowVerificationDialog(false)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Onboarding;

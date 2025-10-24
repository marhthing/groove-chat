import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeTheme = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('theme')
              .eq('id', user.id)
              .single();
            
            if (!error && profile?.theme) {
              setThemeState(profile.theme as Theme);
            } else {
              setThemeState("light");
            }
          } catch (dbError) {
            console.log("Theme column might not exist yet, using default");
            setThemeState("light");
          }
        } else {
          const stored = localStorage.getItem("theme") as Theme;
          setThemeState(stored || "light");
        }
      } catch (error) {
        console.error("Error initializing theme:", error);
        setThemeState("light");
      } finally {
        setIsInitialized(true);
      }
    };

    initializeTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('theme')
            .eq('id', session.user.id)
            .single();
          
          if (!error && profile?.theme) {
            setThemeState(profile.theme as Theme);
          } else {
            setThemeState("light");
          }
        } catch (dbError) {
          console.log("Theme column might not exist yet, using default");
          setThemeState("light");
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        const stored = localStorage.getItem("theme") as Theme;
        setThemeState(stored || "light");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme, isInitialized]);

  const setTheme = useCallback(async (newTheme: Theme) => {
    console.log("Setting theme to:", newTheme);
    setThemeState(newTheme);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      try {
        console.log("Updating theme in database for user:", user.id);
        const { error } = await supabase
          .from('profiles')
          .update({ theme: newTheme })
          .eq('id', user.id);
        
        if (error) {
          console.error("Error saving theme to database:", error);
        } else {
          console.log("Theme saved to database successfully");
        }
      } catch (dbError) {
        console.error("Database error when saving theme:", dbError);
      }
    } else {
      console.log("No user logged in, theme saved to localStorage only");
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

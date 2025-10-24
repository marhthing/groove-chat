import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("light");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', user.id)
          .single();
        
        if (profile?.theme) {
          setThemeState(profile.theme as Theme);
        } else {
          setThemeState("light");
        }
      } else {
        const stored = localStorage.getItem("theme") as Theme;
        setThemeState(stored || "light");
      }
      
      setIsLoading(false);
    };

    initializeTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.theme) {
          setThemeState(profile.theme as Theme);
        } else {
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
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    
    if (!isLoading) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, isLoading]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    
    if (userId) {
      await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', userId);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { is_authenticated, login, register, logout } from "@/api/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login_user: (username: string, password: string) => Promise<void>;
  create_user: (
    username: string,
    email: string,
    password: string,
    cPassword: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const route = useRouter();

  const get_authenticated = async () => {
    try {
      const success = await is_authenticated();
      setIsAuthenticated(success);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login_user = async (username: string, password: string) => {
    const success = await login(username, password);
    if (success) {
      setIsAuthenticated(true);
      alert("login okay");
      route.push("/dashboard/home");
    } else {
      alert("login failed");
    }
  };

  const create_user = async (
    username: string,
    email: string,
    password: string,
    cPassword: string
  ) => {
    if (password === cPassword) {
      try {
        const success = await register(username, email, password);
        if (success) {
          alert("create okay");
        }
      } catch (error) {
        alert("Error create account");
      }
    } else {
      alert("Passwords do not match");
    }
  };

  const signOut = async () => {
    try {
      const success = await logout();
      if (success) {
        setIsAuthenticated(false);
        route.push("/");
      } else {
        console.error("Logout API call failed");
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  useEffect(() => {
    get_authenticated();
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, loading, login_user, create_user, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
};

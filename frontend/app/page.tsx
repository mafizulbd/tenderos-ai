"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthPage } from "./components/AuthPage";
import { useApp } from "./context/AppContext";

export default function Home() {
  const { token, user, login } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (token && user) router.replace("/dashboard");
  }, [token, user, router]);

  if (token && user) return null;

  return <AuthPage onLogin={login} />;
}

"use client";

import { ProfilePanel } from "../../components/ProfilePanel";
import { useApp } from "../../context/AppContext";

export default function ProfilePage() {
  const { token, user, setUser } = useApp();
  if (!user) return null;

  return <ProfilePanel user={user} token={token} onUpdate={setUser} />;
}

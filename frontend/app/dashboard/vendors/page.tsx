"use client";

import { VendorLibrary } from "../../components/VendorLibrary";
import { useApp } from "../../context/AppContext";

export default function VendorsPage() {
  const { token, organization, user } = useApp();
  if (!user) return null;

  return <VendorLibrary token={token} organization={organization} currentUserId={user.id} />;
}

"use client";

import { ContractLibrary } from "../../components/ContractLibrary";
import { useApp } from "../../context/AppContext";

export default function ContractsPage() {
  const { token, organization, user } = useApp();
  if (!user) return null;

  return <ContractLibrary token={token} organization={organization} currentUserId={user.id} />;
}

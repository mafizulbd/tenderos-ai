"use client";

import { TeamPanel } from "../../components/TeamPanel";
import { useApp } from "../../context/AppContext";

export default function TeamPage() {
  const { token, organization, setOrganization } = useApp();

  return <TeamPanel token={token} organization={organization} onOrganizationUpdated={setOrganization} />;
}

"use client";

import DocumentValidator from "../../components/DocumentValidator";
import { useApp } from "../../context/AppContext";

export default function DocValidatorPage() {
  const { token } = useApp();
  return <DocumentValidator token={token} />;
}

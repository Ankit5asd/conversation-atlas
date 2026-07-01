import { useState } from "react";
import type { AtlasResult } from "./engine";
import { Upload } from "./ui/components/Upload";
import { Dashboard } from "./ui/components/Dashboard";

export default function App() {
  const [result, setResult] = useState<AtlasResult | null>(null);

  if (!result) return <Upload onResult={(r) => setResult(r)} />;
  return <Dashboard result={result} onReset={() => setResult(null)} />;
}

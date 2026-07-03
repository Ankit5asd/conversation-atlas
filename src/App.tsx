import { useState } from "react";
import type { AtlasResult } from "./engine";
import { Upload } from "./ui/components/Upload";
import { Dashboard } from "./ui/components/Dashboard";

export default function App() {
  const [state, setState] = useState<{ result: AtlasResult; demo: boolean } | null>(null);

  if (!state) {
    return <Upload onResult={(r) => setState({ result: r, demo: false })} onDemo={(r) => setState({ result: r, demo: true })} />;
  }
  return (
    <Dashboard
      result={state.result}
      demoMode={state.demo}
      onReset={() => setState(null)}
      onEnriched={(r) => setState({ result: r, demo: state.demo })}
    />
  );
}

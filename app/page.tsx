import { ControlPanel } from "@/components/control-panel"
import { PreviewPanel } from "@/components/preview-panel"
import { PuzzleProvider } from "@/components/puzzle-context"

export default function Page() {
  return (
    <PuzzleProvider>
      <main className="flex h-dvh w-full flex-col overflow-hidden bg-background lg:flex-row">
        <ControlPanel />
        <section className="min-h-0 flex-1 bg-card">
          <PreviewPanel />
        </section>
      </main>
    </PuzzleProvider>
  )
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { generatePeekHtmlForDisplay } from '@/lib/ui.js'

export default function PeekTabs({ peeks, onActivate }) {
  if (!peeks || peeks.length === 0) {
    return (
      <div id="peekOutputsDisplayArea" className="peek-output-area-container">
        <div className="output-box-placeholder">Peek results will appear here when a script is run.</div>
      </div>
    )
  }

  return (
    <Tabs defaultValue={peeks[0].id} className="w-full">
      <TabsList id="peekTabsContainer">
        {peeks.map((peek) => (
          <TabsTrigger key={peek.id} value={peek.id} onClick={() => onActivate?.(peek.line)}>
            {`PEEK (VAR "${peek.varName}", L${peek.line})`}
          </TabsTrigger>
        ))}
      </TabsList>
      {peeks.map((peek) => (
        <TabsContent key={peek.id} value={peek.id} className="peek-content">
          <div dangerouslySetInnerHTML={{ __html: generatePeekHtmlForDisplay(peek.dataset, peek.varName, peek.line) }} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

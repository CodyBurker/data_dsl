import { useRef, useState } from 'react'
import Editor from '@/components/Editor'
import PeekTabs from '@/components/PeekTabs'
import LogPanel from '@/components/LogPanel'
import RunButton from '@/components/RunButton'
import ClearButton from '@/components/ClearButton'
import { Parser } from '@/lib/parser.js'
import { tokenizeForParser } from '@/lib/tokenizer.js'
import { Interpreter } from '@/lib/interpreter.js'
import './App.css'

const DEFAULT_SCRIPT = `VAR "data"
THEN LOAD_CSV FILE "example.csv"
THEN PEEK`

function App() {
  const [script, setScript] = useState(DEFAULT_SCRIPT)
  const [astOutput, setAstOutput] = useState('AST will appear here...')
  const [logs, setLogs] = useState([])
  const [peeks, setPeeks] = useState([])
  const [activeLine, setActiveLine] = useState(null)
  const interpreterRef = useRef(null)

  const appendLog = (msg) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])

  const runScript = async () => {
    setLogs([])
    setPeeks([])
    setActiveLine(null)
    try {
      const tokens = tokenizeForParser(script)
      const ast = new Parser(tokens).parse()
      setAstOutput(JSON.stringify(ast, null, 2))

      if (!interpreterRef.current) {
        interpreterRef.current = new Interpreter({})
      }
      const interp = interpreterRef.current
      interp.log = (m) => appendLog(m)
      interp.peekOutputs = []
      await interp.run(ast)
      setPeeks([...interp.peekOutputs])
    } catch (e) {
      setAstOutput(`Error: ${e.message}`)
      appendLog(`Error: ${e.message}`)
    }
  }

  const clearOutputs = () => {
    setLogs([])
    setPeeks([])
    setAstOutput('AST will appear here...')
    interpreterRef.current?.clearInternalState()
  }

  return (
    <div className="p-4 w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <Editor script={script} onChange={setScript} activeLine={activeLine} />
        <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-4">
          <ClearButton onClick={clearOutputs} />
          <RunButton onClick={runScript} />
        </div>
      </div>
      <div className="mb-6">
        <PeekTabs peeks={peeks} onActivate={(line) => setActiveLine(line)} />
      </div>
      <div className="mb-6">
        <details className="output-collapsible rounded-lg border border-gray-300">
          <summary className="cursor-pointer p-3 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-t-lg">
            View AST / Parse Error
          </summary>
          <pre id="astOutput" className="output-box output-box-collapsible-content">
            {astOutput}
          </pre>
        </details>
      </div>
      <LogPanel logs={logs} />
    </div>
  )
}

export default App

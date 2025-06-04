import { useEffect, useRef } from 'react'
import { applySyntaxHighlighting } from '@/lib/ui.js'

export default function Editor({ script, onChange, activeLine }) {
  const textareaRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.innerHTML = applySyntaxHighlighting(script, activeLine)
    }
  }, [script, activeLine])

  useEffect(() => {
    const textarea = textareaRef.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return
    const sync = () => {
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }
    textarea.addEventListener('scroll', sync)
    new ResizeObserver(() => {
      overlay.style.height = textarea.clientHeight + 'px'
      overlay.style.width = textarea.clientWidth + 'px'
    }).observe(textarea)
    return () => textarea.removeEventListener('scroll', sync)
  }, [])

  return (
    <div className="code-editor-container editor-prominent relative">
      <textarea
        id="pipeDataInput"
        ref={textareaRef}
        value={script}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="relative z-10 bg-transparent text-transparent caret-indigo-600 p-3 border rounded w-full"
      />
      <pre
        id="highlightingOverlay"
        ref={overlayRef}
        aria-hidden="true"
        className="absolute top-0 left-0 z-0 pointer-events-none p-3 border rounded overflow-hidden whitespace-pre w-full"
      />
    </div>
  )
}

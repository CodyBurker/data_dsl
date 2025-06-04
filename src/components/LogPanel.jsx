export default function LogPanel({ logs }) {
  const html = logs.length ? logs.join('<br>') : 'Logs will appear here...<br>'
  return (
    <details className="output-collapsible rounded-lg border border-gray-300">
      <summary className="cursor-pointer p-3 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-t-lg">
        View Interpreter Logs
      </summary>
      <div id="logOutput" className="output-box output-box-collapsible-content" dangerouslySetInnerHTML={{ __html: html }} />
    </details>
  )
}

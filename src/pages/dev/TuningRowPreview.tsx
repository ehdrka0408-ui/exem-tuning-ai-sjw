import previewHtml from '../../tuning-row-preview.html?raw'

export default function TuningRowPreview() {
  return (
    <iframe
      title="Tuning Row Preview"
      srcDoc={previewHtml}
      style={{
        width: '100%',
        height: 'calc(100vh / 1.1 - 64px)',
        border: 'none',
        display: 'block',
      }}
    />
  )
}

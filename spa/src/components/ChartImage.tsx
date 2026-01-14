import { useState } from 'react'

export interface ChartImageProps {
  base64: string
  alt: string
  chartData?: {
    labels: string[]
    datasets: Array<{ label: string; data: number[] }>
  }
}

export function ChartImage({ base64, alt, chartData }: ChartImageProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [showDataTable, setShowDataTable] = useState(false)

  const imageSrc = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`

  console.log('ChartImage rendering, base64 length:', base64.length, 'chartData:', chartData)

  const handleClick = () => {
    setIsExpanded(!isExpanded)
  }

  const handleLoad = () => {
    console.log('Image loaded successfully')
    setIsLoaded(true)
  }

  const handleError = () => {
    console.error('Image failed to load, base64 preview:', base64.substring(0, 100))
    setHasError(true)
  }

  const handleDownload = () => {
    try {
      // Convert base64 to blob
      const base64Data = base64.startsWith('data:') 
        ? base64.split(',')[1] 
        : base64
      
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `chart-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download chart:', error)
    }
  }

  if (hasError) {
    return (
      <div className="chart-error">
        Failed to load chart image. Base64 length: {base64.length}
      </div>
    )
  }

  return (
    <div className={`chart-image-container ${isExpanded ? 'expanded' : ''}`}>
      {!isLoaded && (
        <div className="chart-loading">
          <span>Loading chart...</span>
        </div>
      )}
      <div className="chart-image-wrapper">
        <img
          src={imageSrc}
          alt={alt}
          className={`chart-image ${isLoaded ? 'loaded' : 'loading'}`}
          onClick={handleClick}
          onLoad={handleLoad}
          onError={handleError}
        />
        {isLoaded && (
          <div className="chart-action-buttons">
            <button
              className="chart-download-button"
              onClick={(e) => {
                e.stopPropagation()
                handleDownload()
              }}
              aria-label="Download chart"
              title="Download chart as PNG"
            >
              ⬇ Download
            </button>
            {chartData && chartData.labels && chartData.labels.length > 0 && chartData.datasets && chartData.datasets.length > 0 ? (
              <button
                className="chart-dataset-button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDataTable(!showDataTable)
                }}
                aria-label="Toggle data table"
                title="Show/hide data table"
              >
                {showDataTable ? '▼' : '▶'} Data Set
              </button>
            ) : null}
          </div>
        )}
        {showDataTable && chartData && (
          <div className="chart-data-table-container">
            <table className="chart-data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  {chartData.datasets.map((dataset, idx) => (
                    <th key={idx}>{dataset.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.labels.map((label, labelIdx) => (
                  <tr key={labelIdx}>
                    <td className="data-label-cell">{label}</td>
                    {chartData.datasets.map((dataset, datasetIdx) => (
                      <td key={datasetIdx} className="data-value-cell">
                        {dataset.data[labelIdx] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="chart-overlay" onClick={handleClick}>
          <div className="chart-overlay-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={imageSrc} 
              alt={alt} 
              className="chart-image-full"
              onLoad={handleLoad}
              onError={handleError}
            />
            <div className="chart-overlay-actions">
              <button className="download-button" onClick={handleDownload}>
                Download PNG
              </button>
              <button className="close-button" onClick={handleClick}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
